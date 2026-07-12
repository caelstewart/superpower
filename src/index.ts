#!/usr/bin/env node
/**
 * superpower — invisible brand-voice engine for AI coding tools.
 * Merge Labs · © 2026 Stewart Ventures Inc.
 */
import { Command } from "commander";
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, defaultDbPath } from "./db/database.js";
import { createProvider } from "./providers/index.js";
import { generateCopy } from "./core/generate.js";
import { serveStdio } from "./mcp/stdio.js";
import { serveHttp } from "./mcp/http.js";
import { RULES_SNIPPET, hostTargets } from "./install/snippets.js";
import { DEFAULT_GUIDELINES, DEFAULT_THINKING } from "./core/defaults.js";
import type { LintKind } from "./core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION = readFileSync(join(__dirname, "..", "VERSION"), "utf8").trim();

const program = new Command();
program
  .name("superpower")
  .description("Invisible brand-voice engine for AI coding tools — Merge Labs")
  .version(VERSION);

program
  .command("init")
  .description("initialize the local database")
  .action(async () => {
    const store = await createStore();
    console.log(`superpower db ready at ${defaultDbPath()}`);
    await store.close();
  });

const voice = program.command("voice").description("manage voices");

voice
  .command("create <id>")
  .requiredOption("--name <name>", "display name")
  .requiredOption("--description <desc>", "when to use this voice")
  .requiredOption("--identity <identity>", "system identity block (factual, no adjectives)")
  .option("--default-type <type>", "default content type", "post")
  .description("create a voice")
  .action(async (id, opts) => {
    const store = await createStore();
    await store.createVoice({
      id,
      name: opts.name,
      description: opts.description,
      identity: opts.identity,
      thinking: DEFAULT_THINKING,
      guidelines: DEFAULT_GUIDELINES,
      default_type: opts.defaultType,
    });
    console.log(`created voice ${id}`);
    await store.close();
  });

voice
  .command("list")
  .description("list voices")
  .action(async () => {
    const store = await createStore();
    for (const v of await store.listVoices()) {
      console.log(`${v.id}\t${v.name}\t${await store.countSpecimens(v.id)} specimens\t${v.description}`);
    }
    await store.close();
  });

voice
  .command("delete <id>")
  .description("delete a voice and all its specimens/rules")
  .action(async (id) => {
    const store = await createStore();
    console.log((await store.deleteVoice(id)) ? `deleted voice ${id}` : `voice not found: ${id}`);
    await store.close();
  });

voice
  .command("set-file <id> <field> <path>")
  .description("set thinking|guidelines|identity from a markdown file")
  .action(async (id, field, path) => {
    if (!["thinking", "guidelines", "identity"].includes(field)) {
      console.error("field must be thinking | guidelines | identity");
      process.exit(1);
    }
    const store = await createStore();
    await store.updateVoice(id, { [field]: readFileSync(path, "utf8") });
    console.log(`set ${field} on ${id} from ${path}`);
    await store.close();
  });

program
  .command("import <voiceId> <dir>")
  .description("bulk-import specimens from a directory of .txt files (header lines: '# Title', optional '## Subtitle', optional '### YYYY-MM-DD')")
  .option("--content-type <type>", "content type for all files", "post")
  .option("--quality <n>", "quality 1-5", "3")
  .action(async (voiceId, dir, opts) => {
    const store = await createStore();
    if (!(await store.getVoice(voiceId))) {
      console.error(`voice not found: ${voiceId}`);
      process.exit(1);
    }
    let n = 0;
    let undated = 0;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
      const raw = readFileSync(join(dir, f), "utf8");
      const lines = raw.split("\n");
      let title = basename(f, ".txt");
      let subtitle = "";
      let writtenAt = "";
      let bodyStart = 0;
      if (lines[0]?.startsWith("# ")) {
        title = lines[0].slice(2).trim();
        bodyStart = 1;
        if (lines[bodyStart]?.startsWith("## ")) {
          subtitle = lines[bodyStart].slice(3).trim();
          bodyStart++;
        }
        const dateLine = lines[bodyStart]?.match(/^### (\d{4}-\d{2}-\d{2})\s*$/);
        if (dateLine) {
          writtenAt = dateLine[1];
          bodyStart++;
        }
      }
      const body = lines.slice(bodyStart).join("\n").trim();
      if (body.split(/\s+/).length < 50) continue; // skip stubs
      if (!writtenAt) undated++;
      await store.addSpecimen({
        voice_id: voiceId,
        content_type: opts.contentType,
        title,
        subtitle,
        body,
        quality: parseInt(opts.quality, 10),
        source: `import:${basename(dir)}`,
        written_at: writtenAt,
      });
      n++;
    }
    console.log(`imported ${n} specimens into ${voiceId}`);
    if (undated > 0 && undated < n) {
      // Mixed corpora only: partially-dated pools sort dated and undated
      // specimens inconsistently. All-dated and all-undated are both fine.
      console.log(
        `note: ${undated}/${n} specimens are undated (dates are optional; if this voice's style ` +
          `evolved over time, a '### YYYY-MM-DD' header line lets selection cover all eras).`
      );
    }
    await store.close();
  });

const specimen = program.command("specimen").description("curate a voice's specimen pool");

specimen
  .command("list <voiceId>")
  .option("--content-type <type>")
  .description("list specimens (id, quality, type, date, title)")
  .action(async (voiceId, opts) => {
    const store = await createStore();
    for (const s of await store.listSpecimens(voiceId, opts.contentType)) {
      console.log(`#${s.id}\tq${s.quality}\t${s.content_type}\t${s.written_at || "-"}\t${s.title} (${s.word_count}w)`);
    }
    await store.close();
  });

specimen
  .command("set-quality <voiceId> <id> <quality>")
  .description("promote/demote a specimen (5 = killer set, owns exemplar slots)")
  .action(async (voiceId, id, quality) => {
    const store = await createStore();
    const s = await store.updateSpecimen(voiceId, parseInt(id, 10), { quality: parseInt(quality, 10) });
    console.log(s ? `#${s.id} → q${s.quality} · ${s.title}` : `no specimen #${id} in ${voiceId}`);
    await store.close();
  });

program
  .command("rule <voiceId>")
  .description("add a lint rule")
  .requiredOption("--kind <kind>", "banned_string | banned_pattern | max_sentence_words | required_pattern")
  .requiredOption("--value <value>")
  .requiredOption("--message <message>")
  .option("--severity <sev>", "error | warn", "error")
  .action(async (voiceId, opts) => {
    const store = await createStore();
    await store.addLintRule({
      voice_id: voiceId,
      kind: opts.kind as LintKind,
      value: opts.value,
      message: opts.message,
      severity: opts.severity,
    });
    console.log(`rule added to ${voiceId}: [${opts.kind}] ${opts.value}`);
    await store.close();
  });

program
  .command("generate <voiceId> <brief>")
  .description("test-generate from the command line")
  .option("--content-type <type>")
  .action(async (voiceId, brief, opts) => {
    const store = await createStore();
    const v = await store.getVoice(voiceId);
    if (!v) {
      console.error(`voice not found: ${voiceId}`);
      process.exit(1);
    }
    const result = await generateCopy(store, createProvider(), v, brief, opts.contentType);
    console.log(result.output);
    console.error(
      `\n[${result.model} · ${result.exemplarCount} exemplars · ${result.durationMs}ms · ${result.revised ? "lint-revised" : "lint-clean"}]`
    );
    await store.close();
  });

program
  .command("serve")
  .description("run the MCP server (stdio default)")
  .option("--http", "serve Streamable HTTP instead of stdio")
  .option("--port <port>", "http port (defaults to $PORT, then 8787)")
  .action(async (opts) => {
    if (opts.http) {
      const port = parseInt(opts.port ?? process.env.PORT ?? "8787", 10);
      await serveHttp(port);
    } else await serveStdio();
  });

program
  .command("install [host]")
  .description("write trigger rules + print MCP registration for claude-code|cursor|windsurf|vscode|all")
  .action((host = "all") => {
    const serverCmd = `npx -y @mergelabs/superpower serve`;
    for (const t of hostTargets(serverCmd)) {
      if (host !== "all" && host !== t.host) continue;
      const p = t.rulesPath;
      mkdirSync(dirname(p) === "." ? "." : dirname(p), { recursive: true });
      if (existsSync(p) && readFileSync(p, "utf8").includes("superpower")) {
        console.log(`${t.host}: rules already present in ${p}`);
      } else {
        appendFileSync(p, `\n${RULES_SNIPPET}`);
        console.log(`${t.host}: rules written to ${p}`);
      }
      console.log(`${t.host} register: ${t.registerCmd}\n`);
    }
  });

program
  .command("doctor")
  .description("check environment")
  .action(async () => {
    console.log(`superpower ${VERSION}`);
    const dbUrl = process.env.SUPERPOWER_DATABASE_URL ?? process.env.DATABASE_URL;
    console.log(dbUrl ? `db: postgres (${dbUrl.replace(/:[^:@/]+@/, ':***@')})` : `db: sqlite ${defaultDbPath()}`);
    try {
      const store = await createStore();
      console.log(`voices: ${(await store.listVoices()).length}`);
      await store.close();
    } catch (e) {
      console.log(`db error: ${(e as Error).message}`);
    }
    try {
      const p = createProvider();
      console.log(`provider: ${p.name} (${p.model})`);
    } catch (e) {
      console.log(`provider: NOT CONFIGURED — ${(e as Error).message}`);
    }
  });

program.parseAsync(process.argv);

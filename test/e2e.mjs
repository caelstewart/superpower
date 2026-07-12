#!/usr/bin/env node
/**
 * E2E: unit checks (prompt/lint/select) + MCP stdio round-trip + optional live
 * generation. Self-contained — creates and removes its own test voice against
 * whichever backend is configured (SQLite default, Postgres via DATABASE_URL).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SqliteStore, createStore } from "../dist/db/database.js";
import { buildGenerationMessages } from "../dist/core/prompt.js";
import { selectExemplars } from "../dist/core/select.js";
import { lint } from "../dist/core/lint.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOICE = "e2e-tmp";
let failures = 0;
function check(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + detail}`);
  if (!cond) failures++;
}

// Six short prose specimens so the live-generation arm has a real exemplar pool.
const SPECIMENS = [
  ["Ship the ugly version", "Founders wait months to launch because the product feels unfinished. Customers do not care about finish. They care about whether the thing solves the problem they woke up with today. Ship the ugly version to five people who have that problem. Their complaints will tell you what to build next, and their silence will tell you more than any roadmap review ever could. Polish is a reward you earn after someone pays."],
  ["Talk to the churned", "Everyone interviews happy customers. The gold is in the ones who left. A churned customer has no reason to be polite, no stake in your feelings, and perfect knowledge of the moment your product stopped being worth the money. Ask them one question: what did you replace us with? The answer is your real competitor, and it is almost never who you think."],
  ["Meetings are a tax", "Every recurring meeting starts as a solution and calcifies into a tax. The test is simple: cancel it for two weeks. If nothing breaks, it was theater. If something breaks, you have learned exactly what the meeting was for, and you can usually replace it with a shared doc and one decision-maker. Calendars fill because nobody audits them."],
  ["Price is a story", "Your price tells a story before your sales pitch does. A low price says this is a commodity, shop around. A high price says this moves a number an executive cares about. Founders underprice because they judge value by build effort instead of by the size of the problem. Nobody buys effort. They buy the after state."],
  ["The first ten customers", "The first ten customers are recruited one at a time, by hand, by the founder. There is no channel, no funnel, no automation at that stage, and pretending otherwise burns months. Write down the ten people with the problem. Reach out today. What you learn from three real conversations beats any amount of dashboard staring."],
  ["Focus is subtraction", "Strategy documents love addition: new segments, new features, new channels. Real strategy is subtraction. Pick the one motion that works and starve everything else. The hard part is not choosing what to do. It is watching a plausible opportunity walk past while you keep doing the boring thing that compounds."],
];

// ---------- unit: store + prompt + select + lint on an in-memory db ----------
const store = new SqliteStore(":memory:");
const v = await store.createVoice({
  id: "t", name: "T", description: "d",
  identity: "You are T.", thinking: "", guidelines: "No tables.",
  default_type: "post",
});
for (let i = 0; i < 10; i++) {
  await store.addSpecimen({
    voice_id: "t", content_type: i < 8 ? "post" : "email",
    title: `Post ${i}`, subtitle: "", body: ("word ".repeat(120) + i).trim(),
    quality: i === 3 ? 5 : 3, source: "test", written_at: `2025-0${(i % 9) + 1}-01`,
  });
}
const ex = selectExemplars(await store.listSpecimens("t"), "post");
check("select: returns <= 6 exemplars", ex.length <= 6 && ex.length >= 2, String(ex.length));
check("select: filters content type", ex.every((s) => s.content_type === "post"));

// seeded tie-breaking: uniform-quality pools must vary by brief, reproducibly
{
  const pool = await store.listSpecimens("t");
  const a1 = selectExemplars(pool, "post", { seed: "brief A" }).map((s) => s.id).join(",");
  const a2 = selectExemplars(pool, "post", { seed: "brief A" }).map((s) => s.id).join(",");
  const b = selectExemplars(pool, "post", { seed: "brief B" }).map((s) => s.id).join(",");
  check("select: same seed reproduces same exemplars", a1 === a2, `${a1} vs ${a2}`);
  check("select: different seeds vary exemplars", a1 !== b, `both ${a1}`);
}

// dates are optional: a fully UNDATED pool must still get seeded variety
{
  await store.createVoice({
    id: "nd", name: "ND", description: "d", identity: "You are ND.",
    thinking: "", guidelines: "", default_type: "ad",
  });
  for (let i = 0; i < 20; i++) {
    await store.addSpecimen({
      voice_id: "nd", content_type: "ad", title: `Ad ${i}`, subtitle: "",
      body: ("copy ".repeat(80) + i).trim(), quality: 3, source: "test", written_at: "",
    });
  }
  const pool = await store.listSpecimens("nd");
  const s1 = selectExemplars(pool, "ad", { seed: "brief A" }).map((s) => s.id).join(",");
  const s2 = selectExemplars(pool, "ad", { seed: "brief B" }).map((s) => s.id).join(",");
  const s3 = selectExemplars(pool, "ad", { seed: "brief A" }).map((s) => s.id).join(",");
  check("select: undated pool still varies by brief", s1 !== s2, `both ${s1}`);
  check("select: undated pool reproducible per brief", s1 === s3);
}

const msgs = buildGenerationMessages(v, ex, "post", "Test brief");
check("prompt: system first", msgs[0].role === "system");
check("prompt: system carries guidelines", msgs[0].content.includes("No tables."));
check(
  "prompt: exemplars are user/assistant turn pairs",
  msgs.slice(1, -1).every((m, i) => m.role === (i % 2 === 0 ? "user" : "assistant"))
);
check("prompt: final turn is the brief", msgs.at(-1).role === "user" && msgs.at(-1).content.includes("Test brief"));
check(
  "prompt: brief shape identical across turns",
  msgs.filter((m) => m.role === "user").every((m) => m.content.startsWith("Write a post in your voice."))
);

await store.addLintRule({ voice_id: "t", kind: "banned_pattern", value: "^\\|.*\\|", message: "no tables", severity: "error" });
await store.addLintRule({ voice_id: "t", kind: "banned_string", value: "delve", message: "no delve", severity: "error" });
const rules = await store.listLintRules("t");
check("lint: catches table", lint("a\n| a | b |\nrest", rules).length === 1);
check("lint: catches banned string case-insensitively", lint("we Delve deep", rules).length === 1);
check("lint: clean text passes", lint("plain prose only", rules).length === 0);

// ---------- MCP stdio round-trip on the configured backend ----------
{
  const cleanup = await createStore(); // same backend the MCP subprocess uses
  await cleanup.deleteVoice(VOICE);    // idempotency across runs
  await cleanup.close();
}
const transport = new StdioClientTransport({
  command: "node",
  args: ["--no-warnings", join(__dirname, "..", "bin", "superpower.js"), "serve"],
  env: { ...process.env },
});
const client = new Client({ name: "e2e", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
check(
  "mcp: exposes 8 tools",
  JSON.stringify(names) ===
    JSON.stringify(["add_lint_rule", "create_voice", "critique_copy", "generate_copy", "get_voice_context", "list_voices", "save_specimen", "update_voice"]),
  names.join(",")
);

await client.callTool({
  name: "create_voice",
  arguments: {
    id: VOICE, name: "Tmp", description: "e2e test voice — terse startup essays",
    identity: "You are a startup operator writing short, direct essays about building companies.",
  },
});
const created = await client.callTool({ name: "get_voice_context", arguments: { voice: VOICE } });
check("mcp: new voice gets default templates", created.content[0].text.includes("Hard style rules"));

const roster = await client.callTool({ name: "list_voices", arguments: {} });
check("mcp: list_voices includes new voice", roster.content[0].text.includes(VOICE));

for (const [title, body] of SPECIMENS) {
  await client.callTool({
    name: "save_specimen",
    arguments: { voice: VOICE, title, body, quality: 4 },
  });
}
const withSpecimens = await client.callTool({ name: "list_voices", arguments: {} });
check("mcp: save_specimen grows the pool", withSpecimens.content[0].text.includes("6 specimens"));

await client.callTool({
  name: "update_voice",
  arguments: { voice: VOICE, field: "thinking", content: "Always start from the reader's fear of wasted budget." },
});
const updated = await client.callTool({ name: "get_voice_context", arguments: { voice: VOICE } });
check("mcp: update_voice edits thinking per-voice", updated.content[0].text.includes("wasted budget"));

const ruleRes = await client.callTool({
  name: "add_lint_rule",
  arguments: { voice: VOICE, kind: "banned_string", value: "synergy", message: "No corporate speak" },
});
check("mcp: add_lint_rule from chat", ruleRes.content[0].text.includes("No corporate speak"));
const tmpCritique = await client.callTool({
  name: "critique_copy",
  arguments: { voice: VOICE, draft: "We unlock synergy across teams." },
});
check("mcp: chat-added rule enforced", tmpCritique.content[0].text.includes("No corporate speak"));
const badRegex = await client.callTool({
  name: "add_lint_rule",
  arguments: { voice: VOICE, kind: "banned_pattern", value: "([", message: "broken" },
});
check("mcp: invalid regex rejected", badRegex.content[0].text.includes("Invalid regex"));
const unknown = await client.callTool({ name: "get_voice_context", arguments: { voice: "nope" } });
check("mcp: unknown voice handled gracefully", unknown.content[0].text.includes("Unknown voice"));

// ---------- live generation (runs when provider creds are present) ----------
if (process.env.SUPERPOWER_OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
  const gen = await client.callTool({
    name: "generate_copy",
    arguments: {
      voice: VOICE,
      brief: "Why founders should read churned-customer exit surveys before writing next quarter's roadmap.",
      content_type: "post",
    },
  });
  const out = gen.content[0].text;
  const words = out.split(/\s+/).length;
  check("live: generated >120 words", words > 120, `${words} words`);
  check("live: metadata footer present", out.includes("exemplars:"));
  console.log("\n----- live sample (first 300 chars) -----\n" + out.slice(0, 300) + "\n-----------------------------------------");
} else {
  console.log("SKIP  live generation (no provider creds in env)");
}

// teardown
{
  const cleanup = await createStore();
  await cleanup.deleteVoice(VOICE);
  await cleanup.close();
}
await client.close();
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

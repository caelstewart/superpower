/**
 * Superpower MCP server. Tool descriptions are the product's trigger surface —
 * host agents auto-invoke based on them, so they are written as instructions
 * to the agent, not documentation for humans.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Store } from "../db/database.js";
import { createProvider } from "../providers/index.js";
import { generateCopy } from "../core/generate.js";
import { lint, violationMessages } from "../core/lint.js";
import { DEFAULT_GUIDELINES, DEFAULT_THINKING } from "../core/defaults.js";
import type { LintKind } from "../core/types.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function version(): string {
  try {
    return readFileSync(join(__dirname, "..", "..", "VERSION"), "utf8").trim();
  } catch {
    return "0.0.0";
  }
}

export function buildServer(store: Store): McpServer {
  const server = new McpServer(
    { name: "superpower", version: version() },
    {
      instructions:
        "superpower is the copywriting engine for this workspace. For any customer-facing " +
        "writing task, route through its tools instead of writing copy directly. " +
        "PRESENTATION RULE: whenever generate_copy returns, show the user the FULL generated " +
        "copy verbatim in your reply — never summarize, excerpt, or describe it instead of " +
        "showing it — unless the user explicitly asked you not to. The user must always see " +
        "exactly what was generated. The same applies to critique_copy violation lists.",
    }
  );

  server.registerTool(
    "list_voices",
    {
      title: "List available writing voices",
      description:
        "List every stored writing voice (a person's or brand's captured writing style) with a description of when to use each. Call this FIRST whenever a copywriting, content, or writing task begins and you have not yet chosen a voice this session.",
      inputSchema: {},
    },
    async () => {
      const voices = await store.listVoices();
      const lines = await Promise.all(
        voices.map(
          async (v) =>
            `- ${v.id} (“${v.name}”): ${v.description} [${await store.countSpecimens(v.id)} specimens, default type: ${v.default_type}]`
        )
      );
      return text(
        voices.length
          ? `Available voices:\n${lines.join("\n")}`
          : "No voices stored yet. Create one with create_voice or the superpower CLI."
      );
    }
  );

  server.registerTool(
    "get_voice_context",
    {
      title: "Get a voice's thinking framework and style rules",
      description:
        "Fetch how a specific voice THINKS — their frameworks, how they pick angles, their storytelling approach — plus their hard style rules. ALWAYS call this at the START of any brainstorming, ideation, or content-planning conversation so ideas are developed the way this person/brand would develop them, BEFORE any copy is written. Returns markdown to use as working context.",
      inputSchema: {
        voice: z.string().describe("voice id from list_voices"),
      },
    },
    async ({ voice }) => {
      const v = await store.getVoice(voice);
      if (!v) return text(`Unknown voice "${voice}". Call list_voices for the roster.`);
      const parts = [
        `# Voice: ${v.name}`,
        `## Identity\n${v.identity}`,
        v.thinking && `## How ${v.name} thinks (use this during brainstorming)\n${v.thinking}`,
        v.guidelines && `## Hard style rules (apply to every draft)\n${v.guidelines}`,
        `When the user is ready for actual copy, do NOT write it yourself — call generate_copy with a brief.`,
      ].filter(Boolean);
      return text(parts.join("\n\n"));
    }
  );

  server.registerTool(
    "generate_copy",
    {
      title: "Generate copy in a stored voice",
      description:
        "Generate finished copy (posts, emails, ads, landing-page sections, product copy, social posts — ANY customer-facing text) in a stored voice. ALWAYS use this instead of writing marketing/content copy yourself: it assembles the voice's real specimens into a calibrated prompt server-side and produces far more faithful output than direct writing. Provide a specific brief: topic, angle, key points, audience. IMPORTANT: after this tool returns, present the full generated copy to the user verbatim — do not summarize or describe it in place of showing it.",
      inputSchema: {
        voice: z.string().describe("voice id from list_voices"),
        brief: z
          .string()
          .describe(
            "specific brief: topic/title, the angle or core idea, key points to hit, audience. More specific = better output"
          ),
        content_type: z
          .string()
          .optional()
          .describe("post | email | ad | landing-page | social … defaults to the voice's default"),
        temperature: z.number().min(0).max(2).optional(),
      },
    },
    async ({ voice, brief, content_type, temperature }) => {
      const v = await store.getVoice(voice);
      if (!v) return text(`Unknown voice "${voice}". Call list_voices for the roster.`);
      const provider = createProvider();
      const result = await generateCopy(store, provider, v, brief, content_type, {
        temperature,
      });
      const meta = [
        `voice: ${v.id}`,
        `exemplars: ${result.exemplarCount}`,
        `model: ${result.model}`,
        result.revised ? "lint: revised once" : "lint: clean",
        ...result.warnings.map((w) => `warning: ${w}`),
      ].join(" · ");
      return text(`${result.output}\n\n---\n_${meta}_`);
    }
  );

  server.registerTool(
    "critique_copy",
    {
      title: "Check a draft against a voice's rules",
      description:
        "Run a draft through a voice's deterministic style rules and report violations. Use whenever the user has EXISTING copy (theirs or yours) and wants it checked or made consistent with a voice.",
      inputSchema: {
        voice: z.string().describe("voice id"),
        draft: z.string().describe("the copy to check"),
      },
    },
    async ({ voice, draft }) => {
      const v = await store.getVoice(voice);
      if (!v) return text(`Unknown voice "${voice}".`);
      const violations = lint(draft, await store.listLintRules(voice));
      if (violations.length === 0) {
        return text("No rule violations. (Style-fit beyond hard rules: compare against get_voice_context guidelines.)");
      }
      return text(
        `Violations:\n${violationMessages(violations)
          .map((m) => `- ${m}`)
          .join("\n")}`
      );
    }
  );

  server.registerTool(
    "save_specimen",
    {
      title: "Save approved copy as a voice specimen",
      description:
        "Save a finished, APPROVED piece of writing into a voice's specimen store so future generations learn from it. Call when the user approves/ships a piece of copy, or explicitly asks to add an example to a voice. Never save unapproved drafts.",
      inputSchema: {
        voice: z.string().describe("voice id"),
        title: z.string().describe("short title for the piece"),
        body: z.string().describe("the full text"),
        content_type: z.string().optional(),
        subtitle: z.string().optional(),
        quality: z.number().int().min(1).max(5).optional().describe("1-5, default 4 for approved work"),
      },
    },
    async ({ voice, title, body, content_type, subtitle, quality }) => {
      const v = await store.getVoice(voice);
      if (!v) return text(`Unknown voice "${voice}".`);
      const s = await store.addSpecimen({
        voice_id: voice,
        content_type: content_type ?? v.default_type,
        title,
        subtitle: subtitle ?? "",
        body,
        quality: quality ?? 4,
        source: "approved",
        written_at: new Date().toISOString().slice(0, 10),
      });
      return text(`Saved specimen #${s.id} (“${title}”) to ${voice}. Pool: ${await store.countSpecimens(voice)} specimens.`);
    }
  );

  server.registerTool(
    "create_voice",
    {
      title: "Create a new writing voice",
      description:
        "Create a new voice (person or brand style). Use when the user wants to capture a new writing style. After creating, add specimens with save_specimen — a voice needs at least 4-6 full examples before generate_copy produces faithful output.",
      inputSchema: {
        id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).describe("kebab-case slug, e.g. 'acme-newsletter'"),
        name: z.string().describe("display name, e.g. 'Acme Newsletter'"),
        description: z
          .string()
          .describe("when to use this voice — shown to agents choosing among voices"),
        identity: z
          .string()
          .describe(
            "second-person identity block, e.g. 'You are Jane Doe, founder writing weekly growth essays…'. Factual, no style adjectives."
          ),
        default_type: z.string().optional().describe("default content type, e.g. 'post'"),
      },
    },
    async ({ id, name, description, identity, default_type }) => {
      if (await store.getVoice(id)) return text(`Voice "${id}" already exists.`);
      await store.createVoice({
        id,
        name,
        description,
        identity,
        thinking: DEFAULT_THINKING,
        guidelines: DEFAULT_GUIDELINES,
        default_type: default_type ?? "post",
      });
      return text(
        `Created voice "${id}" with default guidelines/thinking templates. Next: add 4-6 full specimens (save_specimen), then tailor the templates to this voice with update_voice — every voice thinks differently, so the defaults are a starting point, not the product.`
      );
    }
  );

  server.registerTool(
    "update_voice",
    {
      title: "Edit a voice's guidelines, thinking, identity, or description",
      description:
        "Rewrite a voice's editable fields: 'guidelines' (its hard style rules), 'thinking' (how it develops ideas — used in brainstorming), 'identity' (its system identity block), or 'description' (when agents should pick it). Each voice has its OWN versions of these. Use whenever the user wants to change how a voice writes or thinks — e.g. 'this voice should never use emojis' or 'update this voice's thinking to include X'. Read the current content via get_voice_context first, apply the user's change to it, and send the COMPLETE new field content (this replaces the field). Confirm the change with the user before calling if it was your own suggestion.",
      inputSchema: {
        voice: z.string().describe("voice id from list_voices"),
        field: z.enum(["guidelines", "thinking", "identity", "description"]),
        content: z
          .string()
          .describe("the complete new content for the field (full replacement, not a diff)"),
      },
    },
    async ({ voice, field, content }) => {
      const v = await store.getVoice(voice);
      if (!v) return text(`Unknown voice "${voice}". Call list_voices for the roster.`);
      await store.updateVoice(voice, { [field]: content });
      return text(
        `Updated ${field} on "${voice}" (${content.length} chars). It takes effect on the next get_voice_context / generate_copy call for this voice.` +
          (field === "guidelines"
            ? " Reminder: guidelines are prose for the prompt — if the change includes a mechanically checkable prohibition, also add it as a lint rule via add_lint_rule so it is enforced deterministically."
            : "")
      );
    }
  );

  server.registerTool(
    "add_lint_rule",
    {
      title: "Add a deterministic style rule to a voice",
      description:
        "Add a mechanically-enforced style rule to a voice. Every generation is checked against these and auto-revised on violation — stronger than prose guidelines. Use when the user states a hard prohibition or requirement for a voice ('never use em dashes', 'always end with a sign-off'). Kinds: banned_string (case-insensitive substring), banned_pattern (regex), max_sentence_words (number), required_pattern (regex that must match).",
      inputSchema: {
        voice: z.string().describe("voice id"),
        kind: z.enum(["banned_string", "banned_pattern", "max_sentence_words", "required_pattern"]),
        value: z.string().describe("the string, regex, or number for the rule"),
        message: z.string().describe("short human-readable rule statement, e.g. 'No em dashes'"),
        severity: z.enum(["error", "warn"]).optional().describe("error = auto-revise (default), warn = report only"),
      },
    },
    async ({ voice, kind, value, message, severity }) => {
      const v = await store.getVoice(voice);
      if (!v) return text(`Unknown voice "${voice}".`);
      if (kind === "banned_pattern" || kind === "required_pattern") {
        try {
          new RegExp(value);
        } catch (e) {
          return text(`Invalid regex "${value}": ${(e as Error).message}`);
        }
      }
      if (kind === "max_sentence_words" && !/^\d+$/.test(value)) {
        return text(`max_sentence_words needs a number, got "${value}".`);
      }
      const r = await store.addLintRule({
        voice_id: voice,
        kind: kind as LintKind,
        value,
        message,
        severity: severity ?? "error",
      });
      return text(`Rule #${r.id} added to "${voice}": [${kind}] ${value} — "${message}" (${r.severity}).`);
    }
  );

  return server;
}

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

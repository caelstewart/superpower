# superpower

**The invisible brand-voice engine for AI coding tools.**

Your team brainstorms and writes inside Claude Code, Cursor, Windsurf, or VS Code.
Superpower sits behind those tools as an [MCP](https://modelcontextprotocol.io) server
and takes over whenever customer-facing copy is involved — pulling the right stored
**voice** (a person's or brand's captured writing style), thinking through ideas the
way that voice would, and generating copy from its real work. Nobody types a command;
the agent triggers it.

Built by **Merge Labs** · © 2026 Stewart Ventures Inc.

---

## Why it works

Copy quality comes from **demonstration, not description**. Telling a model to "write
punchy, conversational copy" produces the generic AI voice everyone recognizes.
Superpower instead assembles a voice's actual specimens into the generation prompt as
prior assistant turns — the model believes it already wrote them — with identically
shaped briefs. In blind human judging against a LoRA fine-tune of the same base model
on the same corpus, this structure won 5 of 6 pairwise judgments, while costing
nothing to train and updating the instant a voice's specimen pool changes.

What demonstrations can't express — prohibitions — is handled by a deterministic lint
layer (banned strings/patterns, sentence limits) that auto-triggers a single revision
pass when a draft violates a voice's hard rules.

## Architecture

```
Claude Code / Cursor / Windsurf / VS Code Copilot
   │  MCP · stdio (local) or Streamable HTTP (hosted)
   ▼
superpower MCP server
   ├── voice store       voices, specimens, lint rules, generation log
   │                     SQLite (zero-dep local) or Postgres (DATABASE_URL)
   ├── prompt engine     exemplar selection → assistant-turn assembly
   ├── lint engine       deterministic rules + single auto-revision
   └── provider layer    Anthropic API or any OpenAI-compatible endpoint
```

Generation happens **server-side**: the host agent sends a brief and receives
finished copy. The engineered prompt, specimen pool, and model choice never leave
the server. The one deliberate exception is `get_voice_context`, which hands the
voice's *thinking framework* and style rules to the host agent so brainstorming
happens in-voice too.

### MCP tools

| Tool | The agent calls it when… |
|---|---|
| `list_voices` | any writing/content task begins |
| `get_voice_context` | brainstorming — returns how the voice thinks + its rules |
| `generate_copy` | actual copy is needed (never written by the host agent) |
| `critique_copy` | existing copy needs checking against a voice |
| `save_specimen` | adding an example: hand-picked base (q5), approved work (q4), raw material (q3) |
| `delete_specimen` | removing an example the user rejects |
| `list_specimens` | reviewing a voice's pool during curation |
| `update_specimen` | changing a specimen's state: base / approved / archive |
| `create_voice` | onboarding a new person/brand |
| `update_voice` | the user changes how a voice writes or thinks, from chat |
| `add_lint_rule` | the user states a hard prohibition ("never use em dashes") |

Every voice owns its own guidelines, thinking framework, specimen pool, and lint
rules — all editable from inside the chat.

### How the example base works

The agent (with the user) is the judge of what's good — **the server never ranks
or scores content**. Each specimen carries a named state recording that judgment:
**base** (hand-picked exemplars — they own the generation prompt), **approved**
(user-approved shipped work), **archive** (collected raw material). Prompts pack
base → approved → archive, so a base example is never displaced by recency or any
heuristic. The recommended shape is a small, fully intentional base of 8-15
examples per content type, added and removed conversationally; large imported
archives are optional raw material to promote from.

### Claude Code commands

The repo ships a skill at `skills/voice-capture/SKILL.md` with the full
methodology for building a voice (judging the base, distilling rules, validating
by generation). Install it once:

```bash
mkdir -p ~/.claude/skills/voice-capture
cp skills/voice-capture/SKILL.md ~/.claude/skills/voice-capture/
```

Then in any Claude Code session: **`/voice-capture`** — or just ask to "capture
someone's voice" / "build a voice from these examples" and the skill triggers.
Day-to-day there are no commands to remember: the MCP tools auto-trigger on
copywriting tasks, and curation is conversational ("that second example is
perfect, add it to the base" / "drop the pricing one").

## Quickstart

Requires Node ≥ 22.5.

```bash
npm install && npm run build
node bin/superpower.js init
node bin/superpower.js doctor
```

### 1. Configure a generation provider

```bash
export ANTHROPIC_API_KEY=sk-ant-...        # recommended
# or any OpenAI-compatible endpoint:
# export SUPERPOWER_OPENAI_BASE_URL=https://... \
#        SUPERPOWER_OPENAI_API_KEY=...  SUPERPOWER_MODEL=...
```

### 2. Capture a voice

A voice needs three things: an identity, real specimens, and (optionally) rules.

```bash
node bin/superpower.js voice create acme \
  --name "Acme" \
  --description "DTC email and landing copy for Acme. Use for all Acme-branded content." \
  --identity "You are the Acme brand voice: a challenger skincare brand writing to skeptical repeat buyers." \
  --default-type email

# bulk-import a directory of .txt files
# header lines: "# Title", optional "## Subtitle", optional "### YYYY-MM-DD" (publish date)
# dates matter: exemplar selection spreads across time, so date your specimens
node bin/superpower.js import acme ./acme-examples --content-type email

# per-voice style rules and thinking framework (markdown files, fully editable later from chat)
node bin/superpower.js voice set-file acme guidelines ./acme-guidelines.md
node bin/superpower.js voice set-file acme thinking ./acme-thinking.md

# hard, mechanically-enforced rules
node bin/superpower.js rule acme --kind banned_string --value "furthermore" --message "Banned word"
```

Aim for at least 4–6 full-length specimens per content type. Quality beats quantity;
full pieces beat snippets.

### 3. Test from the CLI

```bash
node bin/superpower.js generate acme "Welcome email for first-time buyers. Angle: skip the fluff, here's what to actually expect."
```

### 4. Connect your tools

```bash
# Claude Code
claude mcp add superpower -- node /absolute/path/to/superpower/bin/superpower.js serve

# write deterministic trigger rules into CLAUDE.md / .cursor/rules / etc.
node bin/superpower.js install all
```

Tool descriptions alone auto-trigger the agent most of the time; the `install`
rules snippet makes routing all copywriting through superpower deterministic.

## Hosted mode (team / SaaS)

Run one server next to a Postgres database; every client connects with a URL and a
bearer key. Nothing is installed client-side.

```bash
export DATABASE_URL="postgresql://...?sslmode=verify-full"   # Neon, Supabase, RDS…
export SUPERPOWER_API_KEYS="key-for-client-a,key-for-client-b"
node bin/superpower.js serve --http --port 8787
```

Client install (the entire customer setup):

```bash
claude mcp add --transport http superpower https://mcp.yourdomain.com/mcp \
  --header "Authorization: Bearer key-for-client-a"
```

The HTTP transport is stateless (per the 2026-07-28 MCP spec direction) — no sticky
sessions, safe behind any load balancer. A `Dockerfile` is included:

```bash
docker build -t superpower .
docker run -p 8787:8787 -e DATABASE_URL=... -e SUPERPOWER_API_KEYS=... \
  -e ANTHROPIC_API_KEY=... superpower
```

## Environment reference

| Var | Purpose |
|---|---|
| `SUPERPOWER_DATABASE_URL` / `DATABASE_URL` | Postgres connection string — switches the backend from SQLite to Postgres; schema auto-applies on first connect |
| `SUPERPOWER_DB` | SQLite path when no Postgres URL is set (default `~/.superpower/superpower.db`) |
| `ANTHROPIC_API_KEY` | generate with Claude (default provider when set) |
| `SUPERPOWER_OPENAI_BASE_URL` / `SUPERPOWER_OPENAI_API_KEY` / `SUPERPOWER_MODEL` | any OpenAI-compatible endpoint (OpenAI, Together, Fireworks, vLLM…) |
| `SUPERPOWER_PROVIDER` | force `anthropic` or `openai` |
| `SUPERPOWER_API_KEYS` | comma-separated bearer keys for `--http` mode; unset = no auth (dev only) |

## Security notes

- Secrets live only in environment variables — never in the database, code, or logs.
  `.env`, `*.db`, and `*.log` are gitignored.
- Postgres connections should use `sslmode=verify-full`; the code never weakens TLS.
- HTTP mode with no `SUPERPOWER_API_KEYS` is intentionally loud about being dev-only.
- Voice content is customer IP. In hosted deployments, treat the database and the
  generation logs accordingly.

## Test

```bash
npm run build
node --no-warnings test/e2e.mjs
```

Self-contained suite (creates and removes its own test voice) covering the prompt
engine, lint engine, exemplar selection, and a full MCP client round-trip over
stdio. Runs a live generation when provider credentials are present. Set
`DATABASE_URL` to run the same suite against Postgres.

## CLI reference

```
superpower init                              initialize the database
superpower doctor                            check db + provider config
superpower voice create|list|delete|set-file manage voices
superpower import <voice> <dir>              bulk-import specimens
superpower rule <voice> --kind … --value …   add a lint rule
superpower generate <voice> "<brief>"        test-generate
superpower serve [--http --port N]           run the MCP server
superpower install [host|all]                write host trigger rules
```

---

superpower · Merge Labs · © 2026 Stewart Ventures Inc. All rights reserved.

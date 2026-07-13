# Changelog

## 0.2.0 — 2026-07-12

- Specimen states (base / approved / archive) replace numeric quality semantics;
  agent judgment is the only ranking — the server never scores content
- Pool-health pushback: archive-only voices carry a strong data warning the
  agent must relay; no-base voices get a curation nudge (list_voices,
  get_voice_context, generate_copy)
- Curation tools: list_specimens, update_specimen, delete_specimen (MCP + CLI)
- Quality tiers own exemplar slots; brief-seeded variety within tiers;
  window-based time spread (dates optional)
- voice-capture skill (skills/voice-capture) — source-agnostic curation methodology
- Server instructions: hosts must render generated copy verbatim
- Version stamped in list_voices output and server instructions

## 0.1.0 — 2026-07-11

Initial release.

- Voice store: voices, specimens, lint rules, generation log (SQLite via
  node:sqlite; portable schema, Postgres-ready `Store` interface)
- Prompt engine implementing the blind-test-validated structure (exemplars as
  assistant turns, same-shaped briefs, no style adjectives)
- Exemplar selection: content-type match, quality-weighted, time-spread,
  token-budgeted
- Deterministic lint engine (banned_string / banned_pattern /
  max_sentence_words / required_pattern) with single auto-revision pass
- Providers: Anthropic + any OpenAI-compatible endpoint (harmony channel
  cleanup for gpt-oss)
- MCP server: 6 tools, stdio + stateless Streamable HTTP with bearer auth
- CLI: init, voice create/list/delete/set-file, import, rule, generate, serve,
  install (per-host trigger rules), doctor
- Per-voice guidelines/thinking editable from chat (update_voice, add_lint_rule)
- Postgres adapter (Neon-tested) behind the same Store interface; Dockerfile
- Self-contained E2E suite incl. MCP client round-trip and live generation

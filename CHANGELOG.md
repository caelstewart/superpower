# Changelog

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

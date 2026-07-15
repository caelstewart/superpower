# Changelog

## 0.3.3 — 2026-07-15

- Bring-your-own method routing: the system now understands how to use a user's
  writing process / framework / copy guide. Server instructions + voice-capture
  skill teach the agent to run the method during brainstorming to build a
  richer brief, then generate in the captured voice — method decides WHAT,
  voice decides HOW. Never routed into the generation prompt.
- examples/direct-response-copy-skill.md added as the worked reference (a
  general cross-voice DR framework). Composition verified: DR-structured brief
  through the rob-snyder voice produced full DR structure in his sound.

## 0.3.2 — 2026-07-15

- Removed API-key login from the portal entirely (landing section + backend
  POST /dashboard route). Email magic link is the single auth path; the not-
  logged-in dashboard now shows the email login form. API keys are purely MCP
  credentials now, shown on the dashboard, never a login method.

## 0.3.1 — 2026-07-15

- Email: from "Cael from Superpower" with reply-to, properly-capitalized
  human copy (was lowercase terminal styling that read as fake/phishy); real
  HTML button. Subjects: "Your Superpower login link" / "Verify your email"
- Portal buttons: dropped the ./ prefixes and --flag noise for plain labels
  (Send login link, Log in, Rotate API key, Subscribe — $20/mo, etc.)

## 0.3.0 — 2026-07-14

- Dynamic voice-fidelity check on every generation (blind-validated 2026-07-14:
  fidelity-revised drafts beat baselines on both test briefs). A voice-agnostic
  auditor reads the voice's OWN specimens, discovers its recurring signature
  moves, and revises the draft to include any it missed — zero hardcoded
  criteria. Adds ~2 model calls/generation; disable with SUPERPOWER_FIDELITY=off.
  revise_copy (targeted user edits) intentionally skips it.

## 0.2.6 — 2026-07-14

- Plan price $49→$20/mo
- Dashboard shows the full API key inline (behind session) + real key baked
  into the copy-paste connect examples
- Rotate key now redirects back to the dashboard with a confirmation banner and
  the new key visible in place (was: silent when session was stale)

## 0.2.5 — 2026-07-14

- ./resend_link button on the check-your-email page + spam/promotions hint

## 0.2.4 — 2026-07-14

- Real login: email magic links via Resend (superpower@emails.mergelabs.co) —
  verified signup, login doubles as key recovery, signed session cookies
  (30d), key rotation from the dashboard (old key dies instantly)
- Key-based login kept as API-first fallback; billing/rotation now
  session-authenticated
- Presentation directive hardened: instruction sandwiched before AND after
  generated copy; the "it's above / already shown" failure mode is named and
  banned in server instructions

## 0.2.3 — 2026-07-14

- Real Stripe billing: checkout sessions from the dashboard ($49/mo Superpower
  Pro), customer portal, signature-verified webhooks auto-flipping account
  status (checkout → active/pro; cancellation → key refused on /mcp)
- stripe_customer_id on accounts (migrated on both backends)
- Resend key wired for the upcoming email-verification milestone

## 0.2.2 — 2026-07-14

- Customer portal at / (terminal CRT design): email signup mints a working
  sp_live_ API key, key-based dashboard with billing panel, per-host install
  snippets, signup rate limiting
- Accounts table (both adapters); MCP auth accepts operator env keys OR
  account keys from the db; auth now always required on /mcp
- Billing v0: Stripe Payment Link + Customer Portal via STRIPE_PAYMENT_LINK /
  STRIPE_PORTAL_LINK env; `superpower account list|set-status` CLI until
  webhooks land

## 0.2.1 — 2026-07-12 (staged, not yet deployed)

- Presentation hardening: generated copy must be the FIRST element of the
  agent's reply, set apart from commentary — enforced via server instructions,
  tool description, and a directive embedded in every generate_copy result
- Generation prompt is now identity + exemplars ONLY (blind ablation on the
  catgpt voice: examples-only beat docs-in-prompt on all 3 briefs; checkable
  rules are enforced by lint's post-generation revision pass; thinking and
  guidelines serve brainstorming via get_voice_context)
- revise_copy: in-voice iteration on existing drafts — agent passes the current
  draft + change instructions, exemplars re-anchor the voice each cycle,
  unlimited rounds; server instructions route all edit requests through it
- generate_copy brief guidance: pass research/facts in the brief (round-3
  ablation: fact-less briefs lost every topic; packaging made no difference)
- Versioning policy: patch bumps for routine releases

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

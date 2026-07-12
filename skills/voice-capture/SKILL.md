---
name: voice-capture
description: "Build or improve a superpower voice: curate a killer example set, distill guidelines/thinking, add lint rules, validate by generation. Use when creating a voice, importing content for a voice, a voice 'sounds off', or the user wants to capture someone's writing style."
---

# Voice Capture — building a killer example set

You are building a **voice** in superpower: a captured writing style that generates
copy through few-shot demonstration. The single biggest quality lever is **which
specimens sit in the killer set** (quality 5) — those own the generation exemplar
slots. Everything in this skill exists to get ~8–15 genuinely great, representative
specimens per content type, correctly ranked.

Core principle (blind-test validated): **demonstration beats description.** Never
try to fix a voice by adding style adjectives. Fix the specimens, the checkable
rules, or the thinking doc — in that order of likelihood.

## The quality scale (this is the contract with the selection engine)

| q | Meaning | Effect |
|---|---|---|
| 5 | Killer set — the voice's proven best | Owns exemplar slots in every generation |
| 4 | Strong / user-approved work | Fills slots only when q5 is thin |
| 3 | Corpus — fine but unexceptional | Rarely selected; context of record |
| 2 | Reference only | Never wanted in prompts |
| 1 | Off-voice / wrong | Candidate for deletion |

Selection fills slots from the highest tier down and only diversifies (by brief-seed,
and by date *when dates exist*) **within** a tier. A low performer can never outrank
a killer, regardless of recency.

## Step 1 — Frame the voice (5 minutes, with the user)

Ask only what you can't infer:
- Who/what is this voice? (person, brand, sub-brand)
- What content types will it produce? (post, email, ad, reel-script, landing-page…)
  One killer set **per content type** — an email killer set does not teach reels.
- Is there **performance data**? (views, CTR, replies, conversions, shares)
  This is gold; ask for it explicitly before falling back to taste.

Create the voice (`create_voice`) with a factual identity block — who they are,
what they write, for whom. **No style adjectives** ("punchy", "authentic") — they
actively hurt.

## Step 2 — Gather candidates

Collect 20–100+ raw candidates per content type (files, pasted text, scraped
archives). Import everything at default quality 3 — bulk first, curate after.
CLI for bulk: `superpower import <voice> <dir>` (headers: `# Title`, optional
`## Subtitle`, optional `### YYYY-MM-DD`). Chat-scale: `save_specimen` with
explicit quality.

> Content acquisition per platform (Instagram reels, YouTube transcripts, ad
> libraries, email exports) is a separate, growing playbook — see
> `ACQUISITION.md` in this skill's directory when it exists. Don't block on it;
> curate whatever the user can provide today.

## Step 3 — Curate the killer set (the heart of this skill)

Run `list_specimens` and select 8–15 per content type for promotion to q5, in
this priority order:

1. **Measured winners.** If performance data exists, it decides. The
   most-viewed reels, best-converting emails, most-replied posts — *these* are
   the killer set, whatever your aesthetic opinion. Ask the user to map metrics
   to titles if needed.
2. **Voice-purity.** No data? Pick pieces where the voice is most distinctly
   *itself* — the ones a fan would recognize blind. The user's judgment beats
   yours: offer candidates, let them veto.
3. **Format coverage.** The set together should span the voice's recurring
   moves: opener styles, closer styles, typical lengths, list-vs-prose. Six
   near-identical pieces teach less than six varied-but-canonical ones.
4. **Era relevance.** Only if the style visibly evolved: weight the era the
   user wants reproduced (usually current). This is a curation judgment, not
   an automatic rule — dates are optional metadata.

Anti-patterns — exclude even if popular: collabs/ghostwritten pieces, format
experiments the user disowns, length outliers, pieces dominated by a one-off
event, anything the user wouldn't want echoed back.

Then **demote**: anything off-voice → q1/q2. Don't leave landmines at q3 in a
thin corpus.

Promote/demote with `update_specimen` (chat) or
`superpower specimen set-quality <voice> <id> <q>` (CLI).

## Step 4 — Distill the two docs + hard rules

Read the killer set closely, then write:

- **guidelines** (`update_voice`, field `guidelines`): ≤12 rules, every one
  *checkable* ("never markdown tables", "sentences under 30 words", "opens with
  a question or a claim, never the title"). If you can't verify it mechanically
  or by eye in 5 seconds, it's not a guideline, it's a vibe — cut it.
- **thinking** (`update_voice`, field `thinking`): how this voice *develops
  ideas* — where topics come from, the characteristic move (reframe? teardown?
  story-first?), what counts as evidence, how pieces open and close. This is
  what brainstorming uses; write it from observation, not aspiration.
- **lint rules** (`add_lint_rule`): every guideline that's mechanically
  checkable becomes one — banned strings/patterns, sentence caps. These
  auto-enforce with a revision pass on every generation.

## Step 5 — Validate by generation (never ship an unvalidated voice)

1. Pick 2–3 briefs in the voice's wheelhouse that do NOT match any specimen.
2. `generate_copy` each; show the user the full output (always verbatim).
3. Ask: "would a regular reader believe this?" For every "off" note, diagnose
   in order: wrong/missing killer specimens → missing checkable rule → thinking
   doc gap. Fix at the source; do not paper over with prompt adjectives.
4. Iterate promotions/demotions and regenerate until the user calls it.

## Step 6 — Maintenance loop

- When the user approves shipped copy: `save_specimen` at q4. Periodically
  review q4s — the best graduate to q5, replacing weaker killers. Keep the
  killer set ~8–15; it's a roster with cuts, not a hall of fame.
- When the user says "it keeps doing X" → that's a lint rule, add it now.
- New content type for an existing voice = new killer set (Step 3 again).

## Tool crib

| Need | Tool |
|---|---|
| See the pool + quality distribution | `list_specimens` |
| Promote/demote | `update_specimen` / CLI `specimen set-quality` |
| Add examples | `save_specimen` / CLI `import` |
| Edit rules & thinking | `update_voice` |
| Hard prohibitions | `add_lint_rule` |
| Test | `generate_copy`, `critique_copy` |

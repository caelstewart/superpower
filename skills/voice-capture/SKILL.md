---
name: voice-capture
description: "Build or improve a superpower voice: curate a killer example set, distill guidelines/thinking, add lint rules, validate by generation. Use when creating a voice, importing content for a voice, a voice 'sounds off', or the user wants to capture someone's writing style."
---

# Voice Capture — building a killer example set

You are building a **voice** in superpower: a captured writing style that generates
copy through few-shot demonstration. The single biggest quality lever is the
**example base**: ~8–15 genuinely great, representative specimens per content type.
YOU (the agent, with the user) are the judge of what's great — the server never
ranks or scores content; it only packs the specimens you've marked best into the
generation prompt's token budget.

Core principle (blind-test validated): **demonstration beats description.** Never
try to fix a voice by adding style adjectives. Fix the specimens, the checkable
rules, or the thinking doc — in that order of likelihood.

## The default workflow: a small, hand-curated base

Most voices should be built and maintained as a **small pool you fully control**:
gather candidates from wherever they come from, judge them (Step 3), save only the
exceptional ones as **base** specimens, and add/remove over time. With a pool of
8-15, every generation simply uses your picks — no selection machinery involved.

Candidates can come from ANY source — do not assume a research step:
- the user pastes their best pieces into chat
- you and the user co-write or refine examples together in the conversation
- you research/scrape published work
- an existing archive gets imported
- previously generated copy the user approved
The origin never matters; the judgment step (Step 3) is the same for all of them.

## Specimen states (only matter when a pool outgrows the prompt)

Every specimen is in one of three named states — a record of your/the user's
judgment; nothing in the system computes it:

- **base** (stored as quality 5) — hand-picked exemplars. These own the
  generation prompt.
- **approved** (quality 4) — real, user-approved work. Fills prompt slots only
  when the base is thin; the pool the next base picks graduate from.
- **archive** (quality 3, the import default) — collected raw material. Used
  only when base+approved don't fill the prompt.

The server packs prompts base → approved → archive, so a base specimen can never
be outranked by recency, dates, or anything else. In a small curated pool
(everything base) states are invisible — every generation just uses your picks.
Set states with `update_specimen` (quality: 5=base, 4=approved, 3=archive) or
`save_specimen`'s quality field. To exclude something entirely, delete it.

## Step 1 — Frame the voice (5 minutes, with the user)

Ask only what you can't infer:
- Who/what is this voice? (person, brand, sub-brand)
- What content types will it produce? (post, email, ad, reel-script, landing-page…)
  One base **per content type** — an email base does not teach reels.
- Is there **performance data**? (views, CTR, replies, conversions, shares)
  This is gold; ask for it explicitly before falling back to taste.

Create the voice (`create_voice`) with a factual identity block — who they are,
what they write, for whom. **No style adjectives** ("punchy", "authentic") — they
actively hurt.

## Step 2 — Gather candidates

Two paths; prefer the first:

- **Curated (default):** gather candidates from any source (pasted, co-written
  in chat, researched, exported), judge them (Step 3), and `save_specimen` only
  the winners at quality 5 (base). The pool stays small and fully intentional;
  remove misfires with `delete_specimen`.
- **Archive dump (optional):** when the user has a large existing corpus, bulk-import
  it at default quality 3 (`superpower import <voice> <dir>`; headers: `# Title`,
  optional `## Subtitle`, optional `### YYYY-MM-DD`), then promote the base out of
  it in Step 3. The archive is raw material, not the base.

> Content acquisition per platform (Instagram reels, YouTube transcripts, ad
> libraries, email exports) is a separate, growing playbook — see
> `ACQUISITION.md` in this skill's directory when it exists. Don't block on it;
> curate whatever the user can provide today.

## Step 3 — Judge the base (the heart of this skill — this is YOUR judgment)

Select 8-15 specimens per content type for the base, in this priority order:

1. **Measured winners.** If performance data exists, it decides. The
   most-viewed reels, best-converting emails, most-replied posts — *these* are
   the base, whatever your aesthetic opinion. Ask the user to map metrics
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

Then **remove**: anything off-voice gets deleted (`delete_specimen`) — don't
leave landmines in the archive of a thin corpus.

Set states with `update_specimen` (chat) or
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

- When the user approves shipped copy: `save_specimen` as approved (q4).
  Periodically review approved specimens — the best graduate to base, replacing
  weaker ones. Keep the base ~8-15; it's a roster with cuts, not a hall of fame.
- When the user says "it keeps doing X" → that's a lint rule, add it now.
- New content type for an existing voice = new killer set (Step 3 again).

## Tool crib

| Need | Tool |
|---|---|
| See the pool + quality distribution | `list_specimens` |
| Add examples | `save_specimen` / CLI `import` |
| Remove examples | `delete_specimen` / CLI `specimen delete` |
| Promote/demote in large pools | `update_specimen` / CLI `specimen set-quality` |
| Edit rules & thinking | `update_voice` |
| Hard prohibitions | `add_lint_rule` |
| Test | `generate_copy`, `critique_copy` |

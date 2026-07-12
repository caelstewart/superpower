/**
 * Exemplar selection. Validated approach: 4-8 full specimens of the target
 * content type, quality-weighted, spread over time, within a token budget.
 */
import type { Specimen } from "./types.js";

const CHARS_PER_TOKEN = 3.6; // rough but stable for English prose

export interface SelectOptions {
  maxExemplars?: number;   // default 6 (blind-test-validated count)
  tokenBudget?: number;    // default 12000 tokens of exemplar bodies
  seed?: string;           // deterministic tie-breaker (typically the brief)
}

/** Small deterministic string hash for stable, seed-dependent tie-breaking. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function selectExemplars(
  specimens: Specimen[],
  contentType: string,
  opts: SelectOptions = {}
): Specimen[] {
  const maxExemplars = opts.maxExemplars ?? 6;
  const tokenBudget = opts.tokenBudget ?? 12_000;
  const seed = opts.seed ?? "";

  // Prefer exact content-type matches; fall back to the whole pool so a new
  // content type still gets the voice rather than nothing.
  let pool = specimens.filter((s) => s.content_type === contentType);
  if (pool.length < 2) pool = specimens;

  // QUALITY IS THE CURATION LEVER. Candidates accumulate from the highest
  // quality tier downward and stop as soon as there's enough for variety —
  // a curated "killer set" (quality 5) therefore owns the exemplar slots
  // outright; lower tiers only ever fill gaps. Within a tier, ties break on
  // a seed-dependent hash (common right after a bulk import, where quality
  // is uniform): same brief reproduces the same exemplars, different briefs
  // sample different corners of the corpus. No voice-specific logic.
  const enough = maxExemplars * 2;
  const tiers = [...new Set(pool.map((s) => s.quality))].sort((a, b) => b - a);
  const top: Specimen[] = [];
  for (const q of tiers) {
    const tier = pool
      .filter((s) => s.quality === q)
      .sort((a, b) => hash(seed + a.title + a.id) - hash(seed + b.title + b.id));
    top.push(...tier);
    if (top.length >= enough) break;
  }
  top.splice(Math.max(enough, maxExemplars)); // cap candidate pool
  top.sort((a, b) => (a.written_at || a.created_at).localeCompare(b.written_at || b.created_at));

  // Window-based time spread: divide the (chronological) candidates into one
  // window per exemplar slot and let the seed pick within each window. Keeps
  // coverage across eras while different briefs sample different specimens.
  const spread: Specimen[] = [];
  const n = top.length;
  if (n <= maxExemplars) {
    spread.push(...top);
  } else {
    for (let i = 0; i < maxExemplars; i++) {
      const start = Math.floor((i * n) / maxExemplars);
      const end = Math.max(Math.floor(((i + 1) * n) / maxExemplars), start + 1);
      const window = top.slice(start, end);
      spread.push(window[hash(`${seed}:${i}`) % window.length]);
    }
  }

  // Enforce token budget, dropping from the middle (keep oldest + newest poles).
  let est = spread.reduce((n, s) => n + s.body.length / CHARS_PER_TOKEN, 0);
  while (est > tokenBudget && spread.length > 2) {
    const mid = Math.floor(spread.length / 2);
    est -= spread[mid].body.length / CHARS_PER_TOKEN;
    spread.splice(mid, 1);
  }
  return spread;
}

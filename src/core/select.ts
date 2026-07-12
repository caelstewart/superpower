/**
 * Exemplar selection. Validated approach: 4-8 full specimens of the target
 * content type, quality-weighted, spread over time, within a token budget.
 */
import type { Specimen } from "./types.js";

const CHARS_PER_TOKEN = 3.6; // rough but stable for English prose

export interface SelectOptions {
  maxExemplars?: number;   // default 6 (blind-test-validated count)
  tokenBudget?: number;    // default 12000 tokens of exemplar bodies
}

export function selectExemplars(
  specimens: Specimen[],
  contentType: string,
  opts: SelectOptions = {}
): Specimen[] {
  const maxExemplars = opts.maxExemplars ?? 6;
  const tokenBudget = opts.tokenBudget ?? 12_000;

  // Prefer exact content-type matches; fall back to the whole pool so a new
  // content type still gets the voice rather than nothing.
  let pool = specimens.filter((s) => s.content_type === contentType);
  if (pool.length < 2) pool = specimens;

  // Highest quality first, then spread across time so one era doesn't dominate.
  const byQuality = [...pool].sort((a, b) => b.quality - a.quality);
  const top = byQuality.slice(0, Math.max(maxExemplars * 3, maxExemplars));
  top.sort((a, b) => (a.written_at || a.created_at).localeCompare(b.written_at || b.created_at));

  const step = Math.max(1, Math.floor(top.length / maxExemplars));
  const spread: Specimen[] = [];
  for (let i = 0; i < top.length && spread.length < maxExemplars; i += step) {
    spread.push(top[i]);
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

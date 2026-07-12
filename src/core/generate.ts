/**
 * Generation orchestrator: select exemplars → assemble validated prompt →
 * provider call → deterministic lint → at most one revision pass → log.
 */
import type { Store } from "../db/database.js";
import type { Provider } from "../providers/index.js";
import type { GenerationResult, Voice } from "./types.js";
import { buildGenerationMessages, buildRevisionMessages } from "./prompt.js";
import { selectExemplars } from "./select.js";
import { errorCount, lint, violationMessages } from "./lint.js";

export async function generateCopy(
  store: Store,
  provider: Provider,
  voice: Voice,
  brief: string,
  contentType?: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<GenerationResult> {
  const started = Date.now();
  const type = contentType || voice.default_type;
  const specimens = await store.listSpecimens(voice.id);
  if (specimens.length === 0) {
    throw new Error(
      `voice "${voice.id}" has no specimens — import examples before generating`
    );
  }
  const exemplars = selectExemplars(specimens, type, { seed: brief });
  const messages = buildGenerationMessages(voice, exemplars, type, brief);

  // Some endpoints (dev-grade inference, reasoning models that stall in the
  // analysis channel) intermittently return empty/near-empty content. Retry
  // with backoff, then fail loudly — an empty "success" must never reach the
  // caller or the log.
  const MIN_WORDS = 30;
  const MAX_ATTEMPTS = 4;
  let output = "";
  for (let attempt = 1; ; attempt++) {
    output = await provider.chat(messages, opts);
    const words = output.split(/\s+/).filter(Boolean).length;
    if (words >= MIN_WORDS) break;
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error(
        `model returned ${words} words after ${MAX_ATTEMPTS} attempts (model: ${provider.model}) — not saving`
      );
    }
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  const rules = await store.listLintRules(voice.id);
  let violations = lint(output, rules);
  let revised = false;
  const warnings: string[] = [];

  if (errorCount(violations) > 0) {
    revised = true;
    const revMessages = buildRevisionMessages(messages, output, violationMessages(violations));
    output = await provider.chat(revMessages, opts);
    violations = lint(output, rules);
    if (errorCount(violations) > 0) {
      warnings.push(
        `still violating after revision: ${violationMessages(violations).join("; ")}`
      );
    }
  }

  const result: GenerationResult = {
    output,
    provider: provider.name,
    model: provider.model,
    exemplarCount: exemplars.length,
    lintFailures: errorCount(violations),
    revised,
    durationMs: Date.now() - started,
    warnings,
  };

  await store.logGeneration({
    voice_id: voice.id,
    content_type: type,
    brief,
    output,
    provider: result.provider,
    model: result.model,
    exemplar_count: result.exemplarCount,
    lint_failures: result.lintFailures,
    revised: revised ? 1 : 0,
    duration_ms: result.durationMs,
  });

  return result;
}

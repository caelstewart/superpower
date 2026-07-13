/**
 * Prompt assembly — the blind-test-validated structure:
 *  - system: voice identity + short checkable guidelines. NO style adjectives.
 *  - exemplars injected as prior user/assistant TURNS (the model believes it
 *    already wrote them), each with the same-shaped brief.
 *  - final user turn: identical brief shape.
 *
 * This structure beat LoRA fine-tuning of the same base model 5-of-6 in
 * blind human judging (internal eval, 2026-07, gpt-oss-20b, 173-essay
 * single-author corpus). Do not "improve" it with descriptive style
 * instructions; demonstrations carry the voice.
 */
import type { ChatMessage, Specimen, Voice } from "./types.js";

export function briefTurn(contentType: string, brief: string): string {
  return `Write a ${contentType} in your voice.\n\nBrief: ${brief}`;
}

function specimenBrief(s: Specimen): string {
  const b = s.subtitle ? `${s.title} — ${s.subtitle}` : s.title;
  return briefTurn(s.content_type, b);
}

export function buildSystem(voice: Voice): string {
  // Identity ONLY. Blind ablation (2026-07-13, catgpt voice, 3 briefs, single
  // judge): examples-only beat identity+thinking+guidelines on every brief.
  // Demonstrations carry the voice; checkable rules are enforced by the lint
  // engine's post-generation revision pass; thinking/guidelines serve the
  // brainstorming phase via get_voice_context. Do not add doc prose or style
  // instructions here without re-running the ablation harness
  // (voice-docs-ablation/) and winning.
  return voice.identity.trim();
}

export function buildGenerationMessages(
  voice: Voice,
  exemplars: Specimen[],
  contentType: string,
  brief: string
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: buildSystem(voice) }];
  for (const s of exemplars) {
    messages.push({ role: "user", content: specimenBrief(s) });
    messages.push({ role: "assistant", content: s.body });
  }
  messages.push({ role: "user", content: briefTurn(contentType, brief) });
  return messages;
}

export function buildRevisionMessages(
  prior: ChatMessage[],
  draft: string,
  violations: string[]
): ChatMessage[] {
  return [
    ...prior,
    { role: "assistant", content: draft },
    {
      role: "user",
      content:
        `Revise the piece you just wrote. Keep everything about it the same except fix these rule violations:\n` +
        violations.map((v) => `- ${v}`).join("\n") +
        `\n\nReturn only the full revised piece.`,
    },
  ];
}

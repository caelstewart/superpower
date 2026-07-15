/**
 * Dynamic voice-fidelity check. Validated 2026-07-14 (catgpt, blind): the
 * revised drafts beat un-checked baselines on both briefs. The auditor is
 * VOICE-AGNOSTIC — its only voice-specific input is the voice's own specimens,
 * so it discovers each voice's signature moves from the examples themselves
 * (never a hardcoded checklist). Runs on every generation unless
 * SUPERPOWER_FIDELITY=off.
 */
import type { ChatMessage, Specimen } from "./types.js";
import type { Provider } from "../providers/index.js";

export function fidelityEnabled(): boolean {
  return (process.env.SUPERPOWER_FIDELITY ?? "on").toLowerCase() !== "off";
}

const AUDITOR_SYSTEM =
  "You are a voice-fidelity auditor. You will see several real pieces by one author, then a DRAFT meant to sound like that author. Identify the 2-3 most important recurring techniques, structural moves, or habits that appear across the REAL pieces but are missing or weak in the DRAFT. Only name patterns you can actually observe in the provided examples — quote or point to them. Do not give generic writing advice and do not invent rules the examples don't support. Output each gap as a single concrete revision instruction the writer could act on. If the draft already captures the author's moves well, reply with exactly: NO GAPS.";

/**
 * Discover, from the reference specimens alone, what the draft is missing.
 * Returns null when there's nothing to fix or too little to judge against.
 */
export async function findVoiceGaps(
  provider: Provider,
  reference: Specimen[],
  draft: string
): Promise<string | null> {
  if (reference.length < 3) return null; // too little to derive moves reliably
  const examples = reference
    .map((s, i) => `--- EXAMPLE ${i + 1} ---\n${s.body}`)
    .join("\n\n");
  const messages: ChatMessage[] = [
    { role: "system", content: AUDITOR_SYSTEM },
    {
      role: "user",
      content: `THE AUTHOR'S REAL PIECES:\n\n${examples}\n\n=====\n\nDRAFT TO AUDIT:\n\n${draft}\n\n=====\n\nList the top 2-3 gaps as revision instructions, or reply NO GAPS.`,
    },
  ];
  // Generous budget: reasoning models can otherwise spend the whole cap
  // thinking and return empty (observed 2026-07-14).
  const out = (await provider.chat(messages, { temperature: 0.4, maxTokens: 3000 })).trim();
  if (!out || /^NO GAPS\b/i.test(out)) return null;
  return out;
}

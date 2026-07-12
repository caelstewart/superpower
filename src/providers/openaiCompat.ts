import type { ChatMessage } from "../core/types.js";
import type { ChatOptions, Provider } from "./provider.js";

/**
 * Any OpenAI-compatible chat-completions endpoint: OpenAI, Tinker, Together,
 * Fireworks, OpenRouter, vLLM. Strips gpt-oss harmony channel markers if a
 * reasoning model leaks them.
 */
export class OpenAICompatProvider implements Provider {
  readonly name = "openai";
  constructor(
    readonly model: string,
    private apiKey: string,
    private baseUrl: string
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts.maxTokens ?? 4000,
        temperature: opts.temperature ?? 0.8,
        messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`${this.baseUrl} ${res.status}: ${(await res.text()).slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return cleanHarmony(data.choices[0]?.message?.content ?? "").trim();
  }
}

function cleanHarmony(text: string): string {
  if (!text.includes("<|channel|>")) return text;
  if (text.includes("<|channel|>final")) {
    let out = text.split("<|channel|>final")[1];
    if (out.includes("<|message|>")) out = out.split("<|message|>")[1];
    return out.split(/<\|(?:end|start|channel|return)\|>/)[0];
  }
  // No final channel emitted (model stopped inside analysis). Take the last
  // message segment rather than returning nothing; the caller's short-output
  // guard decides whether to retry.
  const segments = text
    .split(/<\|message\|>/)
    .map((s) => s.split(/<\|(?:end|start|channel|return)\|>/)[0].trim())
    .filter(Boolean);
  return segments.at(-1) ?? "";
}

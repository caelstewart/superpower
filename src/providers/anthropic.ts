import type { ChatMessage } from "../core/types.js";
import type { ChatOptions, Provider } from "./provider.js";

export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  constructor(readonly model: string, private apiKey: string) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts.maxTokens ?? 4000,
        temperature: opts.temperature ?? 0.8,
        system,
        messages: turns,
      }),
    });
    if (!res.ok) {
      throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 400)}`);
    }
    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    return data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
  }
}

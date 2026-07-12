import type { ChatMessage } from "../core/types.js";

export interface Provider {
  readonly name: string;
  readonly model: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderConfig {
  provider: "anthropic" | "openai";
  model: string;
  apiKey: string;
  baseUrl?: string; // openai-compatible only (Tinker, Together, Fireworks, OpenRouter…)
}

export function resolveProviderConfig(): ProviderConfig {
  const explicit = process.env.SUPERPOWER_PROVIDER;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey =
    process.env.SUPERPOWER_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.TINKER_API_KEY;

  const wantAnthropic = explicit === "anthropic" || (!explicit && !!anthropicKey);
  if (wantAnthropic) {
    if (!anthropicKey) throw new Error("SUPERPOWER_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set");
    return {
      provider: "anthropic",
      model: process.env.SUPERPOWER_MODEL ?? "claude-sonnet-5",
      apiKey: anthropicKey,
    };
  }

  if (!openaiKey) {
    throw new Error(
      "No provider credentials found. Set ANTHROPIC_API_KEY, or SUPERPOWER_OPENAI_API_KEY (+ SUPERPOWER_OPENAI_BASE_URL) for any OpenAI-compatible endpoint."
    );
  }
  const baseUrl = process.env.SUPERPOWER_OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.SUPERPOWER_MODEL;
  if (!model) throw new Error("SUPERPOWER_MODEL must be set when using an OpenAI-compatible provider");
  return { provider: "openai", model, apiKey: openaiKey, baseUrl };
}

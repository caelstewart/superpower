import { AnthropicProvider } from "./anthropic.js";
import { OpenAICompatProvider } from "./openaiCompat.js";
import { resolveProviderConfig, type Provider } from "./provider.js";

export type { Provider } from "./provider.js";

export function createProvider(): Provider {
  const cfg = resolveProviderConfig();
  if (cfg.provider === "anthropic") {
    return new AnthropicProvider(cfg.model, cfg.apiKey);
  }
  return new OpenAICompatProvider(cfg.model, cfg.apiKey, cfg.baseUrl!);
}

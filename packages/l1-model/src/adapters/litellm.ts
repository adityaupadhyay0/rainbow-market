import { ModelAdapter } from "@itfs/types";
import { OpenAIAdapter } from "./openai";

/**
 * LiteLLMAdapter: A universal adapter using LiteLLM proxy or compatible interface.
 * Defaults to a local LiteLLM instance.
 */
export class LiteLLMAdapter extends OpenAIAdapter implements ModelAdapter {
  constructor(options: { baseUrl?: string; apiKey?: string; model: string }) {
    super({
      baseUrl: options.baseUrl || "http://localhost:4000",
      apiKey: options.apiKey || "sk-none",
      model: options.model,
    });
  }

  // Inherits implementation from OpenAIAdapter as it is compatible
}

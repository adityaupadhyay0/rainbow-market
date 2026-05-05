import {
  ModelAdapter,
  Message,
  ToolSpec,
  ReasoningBudget,
  ModelResponse,
  ModelDelta,
} from "@itfs/types";

export interface OllamaOptions {
  baseUrl?: string;
  model: string;
}

export class OllamaAdapter implements ModelAdapter {
  private baseUrl: string;
  private model: string;

  constructor(options: OllamaOptions) {
    this.baseUrl = options.baseUrl || "http://localhost:11434";
    this.model = options.model;
  }

  async complete(
    messages: Message[],
    tools?: ToolSpec[],
    _budget?: ReasoningBudget,
  ): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        tools: tools,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      message: {
        role: "assistant",
        content: data.message.content,
        tool_calls: data.message.tool_calls,
      },
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  async *stream(
    messages: Message[],
    tools?: ToolSpec[],
    _budget?: ReasoningBudget,
  ): AsyncIterable<ModelDelta> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        tools: tools,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.done) break;
          yield {
            content: data.message?.content,
            tool_calls: data.message?.tool_calls,
          };
        } catch (e) {
          console.error("Error parsing Ollama stream chunk", e);
        }
      }
    }
  }

  async estimateTokens(messages: Message[]): Promise<number> {
    // Basic estimation: ~4 chars per token
    const text = messages.map((m) => m.content).join(" ");
    return Math.ceil(text.length / 4);
  }
}

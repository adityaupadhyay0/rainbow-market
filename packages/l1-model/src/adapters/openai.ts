import {
  ModelAdapter,
  Message,
  ToolSpec,
  ReasoningBudget,
  ModelResponse,
  ModelDelta,
} from "@itfs/types";

export interface OpenAIAdapterOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export class OpenAIAdapter implements ModelAdapter {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(options: OpenAIAdapterOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || "https://api.openai.com/v1";
    this.model = options.model;
  }

  async complete(
    messages: Message[],
    tools?: ToolSpec[],
    _budget?: ReasoningBudget,
  ): Promise<ModelResponse> {
    const start = Date.now();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          tool_call_id: m.tool_call_id,
          tool_calls: m.tool_calls?.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.tool_id,
              arguments: JSON.stringify(tc.input),
            },
          })),
        })),
        tools: tools?.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const latency = Date.now() - start;
    const choice = data.choices[0];

    // Simplified cost calculation: $10 per 1M tokens
    const cost = (data.usage.total_tokens / 1_000_000) * 10;

    return {
      message: {
        role: "assistant",
        content: choice.message.content,
        tool_calls: choice.message.tool_calls?.map(
          (tc: {
            id: string;
            function: { name: string; arguments: string };
          }) => ({
            id: tc.id,
            tool_id: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          }),
        ),
      },
      usage: {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      },
      metadata: {
        provider: "openai",
        model: this.model,
        latency_ms: latency,
        cost_usd: cost,
      },
    };
  }

  async *stream(
    messages: Message[],
    tools?: ToolSpec[],
    _budget?: ReasoningBudget,
  ): AsyncIterable<ModelDelta> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          tool_call_id: m.tool_call_id,
          tool_calls: m.tool_calls?.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.tool_id,
              arguments: JSON.stringify(tc.input),
            },
          })),
        })),
        stream: true,
        tools: tools?.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.replace(/^data: /, "").trim();
        if (cleanLine === "" || cleanLine === "[DONE]") continue;

        try {
          const data = JSON.parse(cleanLine);
          const delta = data.choices[0].delta;
          if (delta) {
            yield {
              content: delta.content,
              tool_calls: delta.tool_calls?.map(
                (tc: {
                  id: string;
                  function: { name: string; arguments?: string };
                }) => ({
                  id: tc.id,
                  tool_id: tc.function.name,
                  input: tc.function.arguments
                    ? JSON.parse(tc.function.arguments)
                    : undefined,
                }),
              ),
            };
          }
        } catch (e) {
          console.error("Error parsing OpenAI stream chunk", e);
        }
      }
    }
  }

  async estimateTokens(messages: Message[]): Promise<number> {
    const text = messages.map((m) => m.content).join(" ");
    return Math.ceil(text.length / 4);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

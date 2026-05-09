import {
  ModelAdapter,
  Message,
  ToolSpec,
  ReasoningBudget,
  ModelResponse,
  ModelDelta,
} from "@itfs/types";

export class OllamaAdapter implements ModelAdapter {
  constructor(
    private baseUrl: string = "http://localhost:11434",
    private modelName: string = "llama3",
  ) {}

  async complete(
    messages: Message[],
    tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelName,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          num_predict: budget?.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      message: {
        role: "assistant",
        content: data.message.content,
      },
      usage: {
        prompt_tokens: data.prompt_eval_count ?? 0,
        completion_tokens: data.eval_count ?? 0,
        total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    };
  }

  async *stream(
    messages: Message[],
    _tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): AsyncIterable<ModelDelta> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelName,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        options: {
          num_predict: budget?.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
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
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            yield { content: data.message.content };
          }
        } catch (_e) {
          // Ignore parse errors for incomplete lines if any
        }
      }
    }
  }

  async estimateTokens(messages: Message[]): Promise<number> {
    // Naive estimation: 4 chars per token
    return messages.reduce((acc, m) => acc + m.content.length / 4, 0);
  }
}

export class AnthropicAdapter implements ModelAdapter {
  constructor(
    private apiKey: string,
    private modelName: string = "claude-3-5-sonnet-20240620",
  ) {}

  async complete(
    messages: Message[],
    tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): Promise<ModelResponse> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.modelName,
        max_tokens: budget?.max_tokens ?? 4096,
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role,
            content: m.content,
          })),
        system: messages.find((m) => m.role === "system")?.content,
        tools: tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        })),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Anthropic API error: ${response.statusText} ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();
    return {
      message: {
        role: "assistant",
        content: data.content[0].text,
      },
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  async *stream(
    messages: Message[],
    _tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): AsyncIterable<ModelDelta> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.modelName,
        max_tokens: budget?.max_tokens ?? 4096,
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role,
            content: m.content,
          })),
        system: messages.find((m) => m.role === "system")?.content,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
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
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (
              data.type === "content_block_delta" &&
              data.delta?.type === "text_delta"
            ) {
              yield { content: data.delta.text };
            }
          } catch (_e) {
            // Ignore parse errors
          }
        }
      }
    }
  }

  async estimateTokens(messages: Message[]): Promise<number> {
    // Naive estimation
    return messages.reduce((acc, m) => acc + m.content.length / 4, 0);
  }
}

export const name = "l1-model";

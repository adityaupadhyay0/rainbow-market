import {
  ModelAdapter,
  Message,
  ToolSpec,
  ReasoningBudget,
  ModelResponse,
  ModelDelta,
} from "@itfs/types";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
}

export class RetryingModelAdapter implements ModelAdapter {
  private adapter: ModelAdapter;
  private maxRetries: number;
  private initialDelayMs: number;

  constructor(adapter: ModelAdapter, options: RetryOptions = {}) {
    this.adapter = adapter;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 1000;
  }

  async complete(
    messages: Message[],
    tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): Promise<ModelResponse> {
    let lastError: unknown;
    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        return await this.adapter.complete(messages, tools, budget);
      } catch (e: unknown) {
        lastError = e;
        if (i < this.maxRetries) {
          const delay = this.initialDelayMs * Math.pow(2, i);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  async *stream(
    messages: Message[],
    tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): AsyncIterable<ModelDelta> {
    // Streaming retry is harder because we might have already yielded chunks.
    // For simplicity, we just delegate for now.
    yield* this.adapter.stream(messages, tools, budget);
  }

  async estimateTokens(messages: Message[]): Promise<number> {
    return this.adapter.estimateTokens(messages);
  }

  async healthCheck(): Promise<boolean> {
    return this.adapter.healthCheck();
  }
}

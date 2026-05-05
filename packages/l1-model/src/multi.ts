import {
  ModelAdapter,
  Message,
  ToolSpec,
  ReasoningBudget,
  ModelResponse,
  ModelDelta,
} from "@itfs/types";

export class MultiModelAdapter implements ModelAdapter {
  private primary: ModelAdapter;
  private fallback?: ModelAdapter;

  constructor(primary: ModelAdapter, fallback?: ModelAdapter) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async complete(
    messages: Message[],
    tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): Promise<ModelResponse> {
    try {
      return await this.primary.complete(messages, tools, budget);
    } catch (e) {
      if (this.fallback) {
        console.warn("Primary model failed, falling back...");
        return await this.fallback.complete(messages, tools, budget);
      }
      throw e;
    }
  }

  async *stream(
    messages: Message[],
    tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): AsyncIterable<ModelDelta> {
    try {
      yield* this.primary.stream(messages, tools, budget);
    } catch (e) {
      if (this.fallback) {
        console.warn("Primary stream failed, falling back...");
        yield* this.fallback.stream(messages, tools, budget);
        return;
      }
      throw e;
    }
  }

  async estimateTokens(messages: Message[]): Promise<number> {
    return this.primary.estimateTokens(messages);
  }

  async healthCheck(): Promise<boolean> {
    return this.primary.healthCheck();
  }
}

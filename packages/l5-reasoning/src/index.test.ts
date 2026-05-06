import { describe, it, expect, vi } from "vitest";
import { ReasoningEngine } from "./index.js";
import {
  ModelAdapter,
  ReasoningBudget,
  Message,
  ModelResponse,
  ModelDelta
} from "@itfs/types";

class MockModelAdapter implements ModelAdapter {
  complete = vi.fn().mockResolvedValue({
    message: { role: "assistant", content: "This is a reasoned response from the mock model." },
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
  } as ModelResponse);

  async *stream(_messages: Message[]): AsyncIterable<ModelDelta> {
    yield { content: "Mock stream" };
  }

  async estimateTokens(_messages: Message[]): Promise<number> {
    return 10;
  }
}

describe("ReasoningEngine", () => {
  const engine = new ReasoningEngine();
  const mockModel = new MockModelAdapter();
  const messages: Message[] = [{ role: "user", content: "Solve 2+2" }];

  it("should execute Best-of-N (tot) strategy", async () => {
    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 100,
      max_branches: 3,
      max_depth: 1,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail"
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(response.message.content).toBeDefined();
    expect(trace.strategy).toBe("tot");
    expect(trace.steps.length).toBe(3);
    expect(mockModel.complete).toHaveBeenCalledTimes(3);
  });

  it("should execute Reflexion strategy and retry on failure", async () => {
    mockModel.complete.mockClear();

    // First call returns short response (triggering "verification failure")
    // Second call returns long response
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Too short" },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "This is a much longer response that should pass the mock verification heuristic." },
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      });

    const budget: ReasoningBudget = {
      strategy: "reflexion",
      max_tokens: 100,
      max_branches: 1,
      max_depth: 3,
      max_retries: 3,
      verifier: "execution",
      on_budget_exceeded: "fail"
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.strategy).toBe("reflexion");
    expect(trace.steps.length).toBe(2);
    expect(trace.success).toBe(true);
    expect(mockModel.complete).toHaveBeenCalledTimes(2);
    expect(response.message.content).toContain("longer response");
  });

  it("should throw error for unsupported strategy", async () => {
    const budget = { strategy: "invalid" as any } as ReasoningBudget;
    await expect(engine.solve(mockModel, messages, budget)).rejects.toThrow("Unsupported reasoning strategy");
  });
});

import { describe, it, expect, vi } from "vitest";
import { ReasoningEngine } from "./index.js";
import {
  ModelAdapter,
  ReasoningBudget,
  Message,
  ModelResponse,
  ModelDelta,
} from "@itfs/types";

class MockModelAdapter implements ModelAdapter {
  complete = vi.fn();
  async *stream(_m: Message[]): AsyncIterable<ModelDelta> { yield { content: "Mock stream" }; }
  async estimateTokens(_m: Message[]): Promise<number> { return 10; }
  async embed(_text: string | string[]): Promise<number[][]> { return [[0.1, 0.2]]; }
}

describe("ToTStrategy", () => {
  const mockModel = new MockModelAdapter();
  const engine = new ReasoningEngine();
  const messages: Message[] = [{ role: "user", content: "Solve a complex puzzle." }];

  it("should explore multiple branches and prune 'impossible' ones", async () => {
    // Round 1: Candidates
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Step 1A" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Step 1B" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      // Round 1: Evaluations
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "SURE: This is perfect." },
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "IMPOSSIBLE: This is wrong." },
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 1000,
      max_branches: 2,
      max_depth: 1, // Keep it to 1 level for simplicity in mock
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.strategy).toBe("tot");
    expect(trace.success).toBe(true);
    expect(response.message.content).toBe("Step 1A"); // Picked because it was "SURE"
    expect(trace.steps.length).toBe(2);
    expect(trace.steps[1].verification?.valid).toBe(false); // 1B was "IMPOSSIBLE"
  });

  it("should terminate early if a 'sure' node is found deep enough", async () => {
    mockModel.complete.mockClear();

    // Depth 1: 1 candidate, marked LIKELY
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Step 1" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "LIKELY: Promising" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      // Depth 2: 1 candidate, marked SURE
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Final Answer" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "SURE: Correct" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 1000,
      max_branches: 1,
      max_depth: 4,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.success).toBe(true);
    expect(response.message.content).toBe("Final Answer");
    // Should have stopped at depth 2
    expect(trace.steps.length).toBe(2);
    // Wait, my logic says depth >= maxDepth / 2 to stop if SURE.
    // maxDepth is 4, so depth 2 >= 2 is true.
  });
});

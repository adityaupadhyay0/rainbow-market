import { describe, it, expect, vi } from "vitest";
import { ReasoningEngine } from "./index.js";
import {
  ModelAdapter,
  ReasoningBudget,
  Message,
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
  const messages: Message[] = [{ role: "user", content: "Solve 2+2" }];

  it("should explore multiple paths and terminate early on SURE", async () => {
    mockModel.complete.mockClear();

    // Expansion for depth 0
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Thought 1" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Thought 2" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

    // Evaluation for depth 0
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "VALUE: SURE\nEXPLANATION: Correct answer found." },
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "VALUE: LIKELY\nEXPLANATION: Keep going." },
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 500,
      max_branches: 2,
      max_depth: 2,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.strategy).toBe("tot");
    expect(trace.success).toBe(true);
    expect(response.message.content).toBe("Thought 1");
    // Expand (2) + Evaluate (2) but early termination after 1st SURE evaluation
    // Actually in my implementation, it expansion for ALL branches happens first,
    // then evaluation for ALL branches in that depth happens.
    // So 2 expand, 1st eval is SURE, loop breaks.
    // Steps recorded: 2 (Thought 1 and Thought 2)
    expect(trace.steps.length).toBe(2);
    expect(trace.steps[0].verification?.score).toBe(1); // SURE
  });

  it("should prune IMPOSSIBLE paths", async () => {
    mockModel.complete.mockClear();

    // Expansion for depth 0
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Bad Thought" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

    // Evaluation for depth 0
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "VALUE: IMPOSSIBLE\nEXPLANATION: This makes no sense." },
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 500,
      max_branches: 1,
      max_depth: 2,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail",
    };

    const { trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.success).toBe(false);
    expect(trace.steps[0].verification?.valid).toBe(false);
  });
});

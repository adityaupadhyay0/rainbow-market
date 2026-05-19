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

  it("should fail when budget is exceeded and policy is 'fail'", async () => {
    mockModel.complete.mockClear();

    // High token usage to trigger budget
    mockModel.complete.mockResolvedValue({
      message: { role: "assistant", content: "Too expensive" },
      usage: { prompt_tokens: 1000, completion_tokens: 1000, total_tokens: 2000 },
    });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 100, // Small budget
      max_branches: 1,
      max_depth: 2,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail",
    };

    await expect(engine.solve(mockModel, messages, budget)).rejects.toThrow(/Reasoning budget exceeded/);
  });

  it("should return best heuristic when budget is exceeded and policy is 'return_best'", async () => {
    mockModel.complete.mockClear();

    // First expansion: LIKELY
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Promising Thought" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "VALUE: LIKELY\nEXPLANATION: Good start." },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

    // Second expansion: trigger budget
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Final Thought" },
        usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
      });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 50, // Triggers during 2nd depth
      max_branches: 1,
      max_depth: 5,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "return_best",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);
    expect(response.message.content).toBe("Promising Thought");
    expect(trace.success).toBe(false);
  });

  it("should allow verifier to veto model evaluation", async () => {
    mockModel.complete.mockClear();

    // Model says SURE, but it's invalid syntax
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "```javascript\nconst x = ;```" }, // Syntax error
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "VALUE: SURE\nEXPLANATION: Done." },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 500,
      max_branches: 1,
      max_depth: 2,
      max_retries: 0,
      verifier: "syntax",
      on_budget_exceeded: "fail",
    };

    const { trace } = await engine.solve(mockModel, messages, budget);
    expect(trace.success).toBe(false);
    expect(trace.steps[0].verification?.valid).toBe(false);
    expect(trace.steps[0].verification?.feedback).toContain("Verification failed: Syntax error");
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

  it("should handle malformed evaluations using keyword fallback", async () => {
    mockModel.complete.mockClear();

    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Thought 1" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "This is definitely CORRECT and the SURE answer." }, // No markers
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
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
    expect(trace.steps[0].verification?.score).toBe(1); // SURE detected via keywords
  });
});

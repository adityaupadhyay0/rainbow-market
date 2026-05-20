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

  it("should integrate with unified Verifier (syntax error)", async () => {
    mockModel.complete.mockClear();

    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Invalid Code: ```js\nconst x =" },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "VALUE: SURE\nEXPLANATION: Perfect." },
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
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

    // Even though model said SURE, verifier failed (syntax error), so it becomes IMPOSSIBLE
    expect(trace.success).toBe(false);
    expect(trace.steps[0].verification?.valid).toBe(false);
    expect(trace.steps[0].verification?.feedback).toContain("Verifier failed: Syntax error");
  });

  it("should enforce max_tokens and fail policy", async () => {
    mockModel.complete.mockClear();

    mockModel.complete.mockResolvedValue({
      message: { role: "assistant", content: "Huge response" },
      usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 50, // Very low budget
      max_branches: 1,
      max_depth: 2,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail",
    };

    await expect(engine.solve(mockModel, messages, budget)).rejects.toThrow(
      "Reasoning budget exceeded (max_tokens).",
    );
  });

  it("should enforce max_tokens and return_best policy", async () => {
    mockModel.complete.mockClear();

    // 1st Expand
    mockModel.complete.mockResolvedValueOnce({
      message: { role: "assistant", content: "Thought 1" },
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });
    // 1st Evaluate -> budget will be 20+20 = 40.
    mockModel.complete.mockResolvedValueOnce({
      message: { role: "assistant", content: "VALUE: LIKELY\nEXPLANATION: Good." },
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });
    // 2nd Expand -> budget will be 40+20 = 60. BOOM.
    mockModel.complete.mockResolvedValueOnce({
      message: { role: "assistant", content: "Thought 2" },
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 50,
      max_branches: 1,
      max_depth: 3,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "return_best",
    };

    const { trace } = await engine.solve(mockModel, messages, budget);

    // Should return what it found before exceeding budget
    expect(trace.steps.length).toBe(1); // Only 1 step successfully completed before expansion 2 failed.
    expect(trace.tokens_used).toBe(60); // 20 (exp1) + 20 (eval1) + 20 (exp2)
  });
});

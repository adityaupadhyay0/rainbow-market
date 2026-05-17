import { describe, it, expect, vi } from "vitest";
import { ToolRegistry, LocalCodeExecutionTool } from "@itfs/l3-tooling";
import { ReasoningEngine } from "./index.js";
import {
  ModelAdapter,
  ReasoningBudget,
  Message,
  ModelResponse,
  ModelDelta,
} from "@itfs/types";

class MockModelAdapter implements ModelAdapter {
  complete = vi.fn().mockResolvedValue({
    message: {
      role: "assistant",
      content: "This is a reasoned response from the mock model.",
    },
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  } as ModelResponse);

  async *stream(_m: Message[]): AsyncIterable<ModelDelta> {
    yield { content: "Mock stream" };
  }

  async estimateTokens(_m: Message[]): Promise<number> {
    return 10;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("ReasoningEngine", () => {
  const registry = new ToolRegistry();
  registry.registerTool(new LocalCodeExecutionTool());
  const engine = new ReasoningEngine(registry);
  const mockModel = new MockModelAdapter();
  const messages: Message[] = [{ role: "user", content: "Solve 2+2" }];

  it("should execute Tree-of-Thought (tot) strategy", async () => {
    mockModel.complete.mockClear();
    // For max_branches: 2, max_depth: 1
    // 1st Expand: 2 calls
    // 2nd Evaluate: 2 calls
    mockModel.complete.mockResolvedValue({
      message: { role: "assistant", content: "VALUE: LIKELY\nThought" },
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });

    const budget: ReasoningBudget = {
      strategy: "tot",
      max_tokens: 200,
      max_branches: 2,
      max_depth: 1,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(response.message.content).toBeDefined();
    expect(trace.strategy).toBe("tot");
    // Expand (2) + Evaluate (2) = 4 calls
    expect(mockModel.complete).toHaveBeenCalledTimes(4);
  });

  it("should execute Reflexion strategy and retry on failure", async () => {
    mockModel.complete.mockClear();

    // First call returns invalid syntax (triggering "verification failure")
    // Second call returns valid syntax
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "```js\nconst x =\n```" },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      })
      .mockResolvedValueOnce({
        message: {
          role: "assistant",
          content: "```js\nconst x = 1;\n```",
        },
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

    const budget: ReasoningBudget = {
      strategy: "reflexion",
      max_tokens: 100,
      max_branches: 1,
      max_depth: 3,
      max_retries: 3,
      verifier: "syntax",
      on_budget_exceeded: "fail",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.strategy).toBe("reflexion");
    expect(trace.steps.length).toBe(2);
    expect(trace.success).toBe(true);
    expect(mockModel.complete).toHaveBeenCalledTimes(2);
    expect(response.message.content).toContain("const x = 1;");
  });

  it("should throw error for unsupported strategy", async () => {
    const budget = { strategy: "invalid" as unknown as any } as ReasoningBudget;
    await expect(engine.solve(mockModel, messages, budget)).rejects.toThrow(
      "Unsupported reasoning strategy",
    );
  });

  it("should execute S* strategy with iterative debugging and selection", async () => {
    mockModel.complete.mockClear();

    // Mock sequence:
    // 1. Branch 0 Round 0 (No code -> fail)
    // 2. Branch 0 Round 1 (Code -> success)
    // 3. Selection (Adaptive Input Generation)
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "I will write some code." },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      })
      .mockResolvedValueOnce({
        message: {
          role: "assistant",
          content: "Here is the code:\n```javascript\n1 + 1\n```",
        },
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      })
      .mockResolvedValueOnce({
        message: {
          role: "assistant",
          content: "Test input:\n```javascript\nconsole.log('test')\n```",
        },
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      });

    const budget: ReasoningBudget = {
      strategy: "sstar",
      max_tokens: 500,
      max_branches: 1, // Use 1 branch to keep it simple for mock
      max_depth: 1,
      max_retries: 2,
      verifier: "execution",
      on_budget_exceeded: "fail",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.strategy).toBe("sstar");
    expect(trace.success).toBe(true);
    expect(response.message.content).toContain("```javascript");
    expect(trace.steps.length).toBe(2); // Initial + 1 retry
  });
});

describe("ReflexionStrategy with SyntaxVerifier", () => {
  const mockModel = new MockModelAdapter();
  const engine = new ReasoningEngine();
  const messages: Message[] = [{ role: "user", content: "Write a JS function" }];

  it("should retry on syntax error", async () => {
    mockModel.complete.mockClear();

    // Round 0: Invalid syntax
    mockModel.complete.mockResolvedValueOnce({
      message: { role: "assistant", content: "```js\nconst x =\n```" },
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    // Round 1: Valid syntax
    mockModel.complete.mockResolvedValueOnce({
      message: { role: "assistant", content: "```js\nconst x = 1;\n```" },
      usage: { prompt_tokens: 30, completion_tokens: 5, total_tokens: 35 },
    });

    const budget: ReasoningBudget = {
      strategy: "reflexion",
      max_tokens: 500,
      max_branches: 1,
      max_depth: 2,
      max_retries: 1,
      verifier: "syntax",
      on_budget_exceeded: "fail",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.success).toBe(true);
    expect(trace.steps.length).toBe(2);
    expect(trace.steps[0].verification?.valid).toBe(false);
    expect(trace.steps[1].verification?.valid).toBe(true);
    expect(response.message.content).toContain("const x = 1;");
  });
});

describe("BestOfNStrategy with SyntaxVerifier", () => {
  const mockModel = new MockModelAdapter();
  const engine = new ReasoningEngine();
  const messages: Message[] = [{ role: "user", content: "Write code" }];

  it("should select the best candidate based on syntax", async () => {
    mockModel.complete.mockClear();

    // Candidate 1: Syntax error
    mockModel.complete.mockResolvedValueOnce({
      message: { role: "assistant", content: "```js\nconst x =\n```" },
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    // Candidate 2: Valid syntax
    mockModel.complete.mockResolvedValueOnce({
      message: { role: "assistant", content: "```js\nconst x = 1;\n```" },
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const budget: ReasoningBudget = {
      strategy: "best_of_n",
      max_tokens: 500,
      max_branches: 2,
      max_depth: 1,
      max_retries: 0,
      verifier: "syntax",
      on_budget_exceeded: "fail",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.success).toBe(true);
    expect(response.message.content).toContain("const x = 1;");
  });
});

import { describe, it, expect, vi } from "vitest";
import { ReasoningEngine } from "./index.js";
import {
  ModelAdapter,
  ReasoningBudget,
  Message,
  ModelResponse,
  ModelDelta,
  Retriever,
  RetrievalResult,
} from "@itfs/types";

class MockModelAdapter implements ModelAdapter {
  complete = vi.fn();
  async *stream(_m: Message[]): AsyncIterable<ModelDelta> { yield { content: "Mock stream" }; }
  async estimateTokens(_m: Message[]): Promise<number> { return 10; }
  async embed(_text: string | string[]): Promise<number[][]> { return [[0.1, 0.2]]; }
}

class MockRetriever implements Retriever {
  retrieve = vi.fn().mockResolvedValue({
    documents: [{ id: "1", content: "Paris is the capital of France.", similarity: 0.9 }],
    confidence: "correct",
  } as RetrievalResult);
}

describe("RATStrategy", () => {
  const mockModel = new MockModelAdapter();
  const mockRetriever = new MockRetriever();
  const engine = new ReasoningEngine(undefined, undefined, mockRetriever);
  const messages: Message[] = [{ role: "user", content: "What is the capital of France?" }];

  it("should generate a draft, retrieve context, and refine the thought", async () => {
    mockModel.complete
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "I think it is Paris." },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Final Answer: Paris." },
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      });

    const budget: ReasoningBudget = {
      strategy: "rat",
      max_tokens: 100,
      max_branches: 1,
      max_depth: 1,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail",
    };

    const { response, trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.strategy).toBe("rat");
    expect(mockRetriever.retrieve).toHaveBeenCalledWith("I think it is Paris.");
    expect(mockModel.complete).toHaveBeenCalledTimes(2);
    expect(response.message.content).toContain("Final Answer: Paris.");

    // Check if context was passed to the second model call
    const secondCallMessages = mockModel.complete.mock.calls[1][0] as Message[];
    const refinementPrompt = secondCallMessages[secondCallMessages.length - 1].content;
    expect(refinementPrompt).toContain("Paris is the capital of France.");

    // Verify token accounting
    expect(response.usage.prompt_tokens).toBe(30); // 10 + 20
    expect(response.usage.completion_tokens).toBe(10); // 5 + 5
    expect(response.usage.total_tokens).toBe(40);
  });

  it("should iterate multiple times if no final answer is reached", async () => {
    mockModel.complete.mockClear();
    mockRetriever.retrieve.mockClear();

    mockModel.complete
      .mockResolvedValue({
        message: { role: "assistant", content: "Continuing..." },
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

    const budget: ReasoningBudget = {
      strategy: "rat",
      max_tokens: 500,
      max_branches: 1,
      max_depth: 2,
      max_retries: 0,
      verifier: "null",
      on_budget_exceeded: "fail",
    };

    const { trace } = await engine.solve(mockModel, messages, budget);

    expect(trace.steps.length).toBe(2);
    expect(mockRetriever.retrieve).toHaveBeenCalledTimes(2);
    expect(mockModel.complete).toHaveBeenCalledTimes(4); // 2 steps * (draft + refine)
  });
});

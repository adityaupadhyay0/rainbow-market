import { describe, it, expect, vi } from "vitest";
import { ReasoningLoop } from "../loop";
import { ModelAdapter, TaskEnvelope } from "@itfs/types";
import { ToolRegistry } from "@itfs/l3-tooling";

describe("ReasoningLoop", () => {
  it("should run a simple loop", async () => {
    const mockModel: ModelAdapter = {
      complete: vi.fn().mockResolvedValue({
        message: { role: "assistant", content: "Task complete" },
        usage: { total_tokens: 10 },
      }),
      stream: vi.fn(),
      estimateTokens: vi.fn(),
    };
    const registry = new ToolRegistry();
    const loop = new ReasoningLoop(mockModel, registry);

    const task: TaskEnvelope = {
      task_id: "1",
      domain: "general",
      title: "Test",
      description: "Test task",
      budget: {
        strategy: "cot",
        max_tokens: 100,
        max_depth: 5,
        max_branches: 1,
        max_retries: 3,
        verifier: "null",
        on_budget_exceeded: "fail",
      },
      privacy_mode: "local_only",
    };

    const result = await loop.run(task);
    expect(result.content).toBe("Task complete");
    expect(mockModel.complete).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "./index";
import { ReasoningEngine } from "@itfs/l5-reasoning";
import {
  ModelAdapter,
  TaskEnvelope,
  TaskGraph,
  ReasoningBudget,
} from "@itfs/types";

describe("Orchestrator", () => {
  const mockModel: ModelAdapter = {
    complete: vi.fn(),
    stream: vi.fn(),
    estimateTokens: vi.fn(),
    embed: vi.fn(),
  };

  const mockEngine = new ReasoningEngine();
  vi.spyOn(mockEngine, "solve").mockImplementation(async (_m, messages) => {
    return {
      response: {
        message: { role: "assistant", content: `Result for ${messages[0].content.substring(0, 20)}...` },
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      },
      trace: {
        task_id: "test-trace",
        steps: [],
        strategy: "cot",
        total_duration_ms: 100,
        tokens_used: 20,
        success: true,
        final_output: "subtask-output",
      },
    };
  });

  let orchestrator: Orchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new Orchestrator(mockModel, mockEngine);
    // Mock synthesis response
    (mockModel.complete as vi.Mock).mockResolvedValue({
      message: { role: "assistant", content: "Final synthesized output" },
      usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
    });
  });

  it("should decompose and execute a task with synthesis", async () => {
    const envelope: TaskEnvelope = {
      task_id: "task-1",
      domain: "general",
      title: "Test Task",
      description: "A complex test task",
      budget: {
        strategy: "cot",
        max_tokens: 1000,
        max_branches: 1,
        max_depth: 5,
        max_retries: 2,
        verifier: "null",
        on_budget_exceeded: "fail",
      },
      privacy_mode: "local_only",
    };

    const mockGraph: TaskGraph = {
      task_id: "task-1",
      subtasks: [
        {
          subtask_id: "s1",
          title: "Subtask 1",
          description: "Desc 1",
          dependencies: [],
          status: "pending",
        },
        {
          subtask_id: "s2",
          title: "Subtask 2",
          description: "Desc 2",
          dependencies: ["s1"],
          status: "pending",
        },
      ],
    };

    // First call is for decomposition
    (mockModel.complete as vi.Mock).mockResolvedValueOnce({
      message: { content: JSON.stringify(mockGraph) },
      usage: { total_tokens: 50 },
    });

    const result = await orchestrator.run(envelope);

    expect(result.success).toBe(true);
    expect(result.task_id).toBe("task-1");
    expect(Object.keys(result.subtask_traces)).toHaveLength(2);
    expect(mockEngine.solve).toHaveBeenCalledTimes(2);
    expect(result.output).toBe("Final synthesized output");
  });

  it("should handle parallel subtasks efficiently", async () => {
    const envelope: TaskEnvelope = {
      task_id: "task-parallel",
      domain: "general",
      title: "Parallel Task",
      description: "Tasks that can run together",
      budget: { strategy: "cot" } as unknown as ReasoningBudget,
      privacy_mode: "local_only",
    };

    const mockGraph: TaskGraph = {
      task_id: "task-parallel",
      subtasks: [
        {
          subtask_id: "p1",
          title: "Parallel 1",
          description: "Desc P1",
          dependencies: [],
          status: "pending",
        },
        {
          subtask_id: "p2",
          title: "Parallel 2",
          description: "Desc P2",
          dependencies: [],
          status: "pending",
        },
        {
          subtask_id: "s1",
          title: "Final step",
          description: "Desc Final",
          dependencies: ["p1", "p2"],
          status: "pending",
        },
      ],
    };

    (mockModel.complete as vi.Mock).mockResolvedValueOnce({
      message: { content: JSON.stringify(mockGraph) },
      usage: { total_tokens: 50 },
    });

    const result = await orchestrator.run(envelope);

    expect(result.success).toBe(true);
    expect(mockEngine.solve).toHaveBeenCalledTimes(3);
    expect(result.output).toBe("Final synthesized output");
  });

  it("should fail if a subtask fails", async () => {
    const envelope: TaskEnvelope = {
      task_id: "task-fail",
      domain: "general",
      title: "Failing Task",
      description: "Will fail",
      budget: { strategy: "cot" } as unknown as ReasoningBudget,
      privacy_mode: "local_only",
    };

    const mockGraph: TaskGraph = {
      task_id: "task-fail",
      subtasks: [
        {
          subtask_id: "f1",
          title: "Fail",
          description: "I will fail",
          dependencies: [],
          status: "pending",
        },
      ],
    };

    (mockModel.complete as vi.Mock).mockResolvedValueOnce({
      message: { content: JSON.stringify(mockGraph) },
      usage: { total_tokens: 50 },
    });

    vi.spyOn(mockEngine, "solve").mockResolvedValueOnce({
      response: {} as unknown as any,
      trace: { success: false } as unknown as any,
    });

    const result = await orchestrator.run(envelope);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Subtask failed: f1");
  });

  it("should handle complex DAG with multiple terminal nodes", async () => {
    const envelope: TaskEnvelope = {
      task_id: "task-dag",
      domain: "general",
      title: "DAG Task",
      description: "Complex DAG",
      budget: { strategy: "cot" } as unknown as ReasoningBudget,
      privacy_mode: "local_only",
    };

    const mockGraph: TaskGraph = {
      task_id: "task-dag",
      subtasks: [
        { subtask_id: "a", title: "A", description: "A", dependencies: [], status: "pending" },
        { subtask_id: "b", title: "B", description: "B", dependencies: ["a"], status: "pending" },
        { subtask_id: "c", title: "C", description: "C", dependencies: ["a"], status: "pending" },
        { subtask_id: "d", title: "D", description: "D", dependencies: ["b"], status: "pending" },
      ],
    };
    // Here 'c' and 'd' are terminal nodes.

    (mockModel.complete as vi.Mock).mockResolvedValueOnce({
      message: { content: JSON.stringify(mockGraph) },
      usage: { total_tokens: 50 },
    });

    const result = await orchestrator.run(envelope);

    expect(result.success).toBe(true);
    expect(mockEngine.solve).toHaveBeenCalledTimes(4);
    expect(result.output).toBe("Final synthesized output");

    // Verify synthesis was called with correct context
    const lastCall = (mockModel.complete as vi.Mock).mock.calls.find(call =>
      call[0][0].content.includes("Focus particularly on the terminal subtasks")
    );
    expect(lastCall[0][0].content).toContain("- c: C");
    expect(lastCall[0][0].content).toContain("- d: D");
  });
});

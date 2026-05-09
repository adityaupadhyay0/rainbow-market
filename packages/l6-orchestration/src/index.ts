import {
  ModelAdapter,
  TaskEnvelope,
  OrchestrationResult,
} from "@itfs/types";
import { ReasoningEngine } from "@itfs/l5-reasoning";
import { TaskDecomposer } from "./decomposer.js";
import { TaskExecutor } from "./executor.js";

export class Orchestrator {
  private decomposer: TaskDecomposer;
  private executor: TaskExecutor;

  constructor(
    private model: ModelAdapter,
    private engine: ReasoningEngine,
  ) {
    this.decomposer = new TaskDecomposer(model);
    this.executor = new TaskExecutor(engine);
  }

  async run(envelope: TaskEnvelope): Promise<OrchestrationResult> {
    try {
      // Phase 1: Decomposition
      const graph = await this.decomposer.decompose(envelope);

      // Phase 2: Execution
      const result = await this.executor.execute(
        graph,
        this.model,
        envelope.budget,
      );

      return result;
    } catch (e) {
      const error = e as Error;
      return {
        task_id: envelope.task_id,
        success: false,
        subtask_traces: {},
        output: null,
        error: `Orchestration failed: ${error.message}`,
      };
    }
  }
}

export const name = "l6-orchestration";

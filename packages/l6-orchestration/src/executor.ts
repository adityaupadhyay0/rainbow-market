import {
  ModelAdapter,
  ReasoningBudget,
  ReasoningTrace,
  TaskGraph,
  OrchestrationResult,
  Message,
} from "@itfs/types";
import { ReasoningEngine } from "@itfs/l5-reasoning";

export class TaskExecutor {
  constructor(private engine: ReasoningEngine) {}

  async execute(
    graph: TaskGraph,
    model: ModelAdapter,
    baseBudget: ReasoningBudget,
  ): Promise<OrchestrationResult> {
    const subtaskTraces: Record<string, ReasoningTrace> = {};
    const subtaskOutputs: Record<string, unknown> = {};
    const completedSubtasks = new Set<string>();
    const runningSubtasks = new Set<string>();
    const failedSubtasks = new Set<string>();

    const subtasks = [...graph.subtasks];

    while (completedSubtasks.size + failedSubtasks.size < subtasks.length) {
      const readySubtasks = subtasks.filter(
        (s) =>
          s.status === "pending" &&
          !runningSubtasks.has(s.subtask_id) &&
          s.dependencies.every((dep) => completedSubtasks.has(dep)),
      );

      if (readySubtasks.length === 0 && runningSubtasks.size === 0) {
        // Deadlock or unresolvable dependencies
        const uncompleted = subtasks.filter((s) => s.status !== "completed");
        return {
          task_id: graph.task_id,
          success: false,
          subtask_traces: subtaskTraces,
          output: null,
          error: `Unresolvable dependencies or deadlock detected. Remaining subtasks: ${uncompleted.map((s) => s.subtask_id).join(", ")}`,
        };
      }

      if (readySubtasks.length > 0) {
        // Start independent subtasks in parallel
        const subtaskPromises = readySubtasks.map(async (subtask) => {
          runningSubtasks.add(subtask.subtask_id);
          subtask.status = "running";

          try {
            const contextMessages: Message[] = [
              {
                role: "system",
                content: `You are executing a subtask of a larger goal.
Subtask Title: ${subtask.title}
Subtask Description: ${subtask.description}
Dependencies' Outputs: ${JSON.stringify(
                  subtask.dependencies.reduce(
                    (acc, depId) => ({ ...acc, [depId]: subtaskOutputs[depId] }),
                    {},
                  ),
                )}`,
              },
            ];

            const { response, trace } = await this.engine.solve(
              model,
              contextMessages,
              baseBudget,
            );

            subtaskTraces[subtask.subtask_id] = trace;

            if (trace.success) {
              subtask.status = "completed";
              subtask.output = response.message.content;
              subtaskOutputs[subtask.subtask_id] = subtask.output;
              completedSubtasks.add(subtask.subtask_id);
            } else {
              subtask.status = "failed";
              failedSubtasks.add(subtask.subtask_id);
            }
          } catch (_e) {
            subtask.status = "failed";
            failedSubtasks.add(subtask.subtask_id);
            // Optionally store the error in trace
          } finally {
            runningSubtasks.delete(subtask.subtask_id);
          }
        });

        // Wait for all current parallel branches to finish
        await Promise.all(subtaskPromises);

        if (failedSubtasks.size > 0) {
          return {
            task_id: graph.task_id,
            success: false,
            subtask_traces: subtaskTraces,
            output: null,
            error: `Subtasks failed: ${Array.from(failedSubtasks).join(", ")}`,
          };
        }
      } else {
        // If no new subtasks are ready but some are running, wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Final output synthesis: identify terminal nodes (sinks) of the DAG
    const allDependencies = new Set(subtasks.flatMap((s) => s.dependencies));
    const terminalSubtasks = subtasks.filter(
      (s) => !allDependencies.has(s.subtask_id),
    );

    // Naive synthesis: if multiple terminal nodes, just use the last one
    const finalOutput =
      terminalSubtasks.length > 0
        ? terminalSubtasks[terminalSubtasks.length - 1].output
        : subtasks[subtasks.length - 1].output;

    return {
      task_id: graph.task_id,
      success: true,
      subtask_traces: subtaskTraces,
      output: finalOutput,
    };
  }
}

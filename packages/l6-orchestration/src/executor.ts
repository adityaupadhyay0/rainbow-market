import {
  ModelAdapter,
  ReasoningBudget,
  ReasoningTrace,
  TaskGraph,
  OrchestrationResult,
  Message,
  SubTask,
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

    return new Promise((resolve) => {
      const checkAndRun = async () => {
        if (failedSubtasks.size > 0) {
          return;
        }

        const readySubtasks = subtasks.filter(
          (s) =>
            s.status === "pending" &&
            !runningSubtasks.has(s.subtask_id) &&
            s.dependencies.every((dep) => completedSubtasks.has(dep)),
        );

        if (
          readySubtasks.length === 0 &&
          runningSubtasks.size === 0 &&
          completedSubtasks.size < subtasks.length
        ) {
          const uncompleted = subtasks.filter((s) => s.status !== "completed");
          resolve({
            task_id: graph.task_id,
            success: false,
            subtask_traces: subtaskTraces,
            output: null,
            error: `Unresolvable dependencies or deadlock detected. Remaining subtasks: ${uncompleted.map((s) => s.subtask_id).join(", ")}`,
          });
          return;
        }

        if (completedSubtasks.size === subtasks.length) {
          try {
            const finalOutput = await this.synthesize(graph, subtasks, model, baseBudget);
            resolve({
              task_id: graph.task_id,
              success: true,
              subtask_traces: subtaskTraces,
              output: finalOutput,
            });
          } catch (e) {
            resolve({
              task_id: graph.task_id,
              success: false,
              subtask_traces: subtaskTraces,
              output: null,
              error: `Synthesis failed: ${(e as Error).message}`,
            });
          }
          return;
        }

        for (const subtask of readySubtasks) {
          runSubtask(subtask);
        }
      };

      const runSubtask = async (subtask: SubTask) => {
        runningSubtasks.add(subtask.subtask_id);
        subtask.status = "running";
        console.log(`[Orchestrator] Starting subtask: ${subtask.subtask_id} (${subtask.title})`);

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
            runningSubtasks.delete(subtask.subtask_id);
            console.log(`[Orchestrator] Completed subtask: ${subtask.subtask_id}`);
            await checkAndRun();
          } else {
            subtask.status = "failed";
            failedSubtasks.add(subtask.subtask_id);
            runningSubtasks.delete(subtask.subtask_id);
            console.error(`[Orchestrator] Subtask failed: ${subtask.subtask_id}`);
            resolve({
              task_id: graph.task_id,
              success: false,
              subtask_traces: subtaskTraces,
              output: null,
              error: `Subtask failed: ${subtask.subtask_id}`,
            });
          }
        } catch (e) {
          subtask.status = "failed";
          failedSubtasks.add(subtask.subtask_id);
          runningSubtasks.delete(subtask.subtask_id);
          console.error(`[Orchestrator] Error in subtask ${subtask.subtask_id}: ${(e as Error).message}`);
          resolve({
            task_id: graph.task_id,
            success: false,
            subtask_traces: subtaskTraces,
            output: null,
            error: `Subtask ${subtask.subtask_id} threw an error: ${(e as Error).message}`,
          });
        }
      };

      checkAndRun();
    });
  }

  private async synthesize(
    graph: TaskGraph,
    subtasks: SubTask[],
    model: ModelAdapter,
    budget: ReasoningBudget,
  ): Promise<string> {
    const allDependencies = new Set(subtasks.flatMap((s) => s.dependencies));
    const terminalSubtasks = subtasks.filter(
      (s) => !allDependencies.has(s.subtask_id),
    );

    const systemPrompt = `You are a task synthesis expert. You will be provided with a set of subtasks and their outputs, which were part of a larger task. Your goal is to combine these outputs into a final, coherent response that addresses the original task requirements.

Original Task ID: ${graph.task_id}
Subtask Results:
${subtasks
  .map(
    (s) => `- [${s.subtask_id}] ${s.title}:
${s.output}`,
  )
  .join("\n\n")}

Focus particularly on the terminal subtasks (sinks of the DAG):
${terminalSubtasks.map((s) => `- ${s.subtask_id}: ${s.title}`).join("\n")}

Provide the final consolidated response.`;

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Synthesize the final result." },
    ];

    const response = await model.complete(messages, [], budget);
    return response.message.content;
  }
}

import { TaskEnvelope, Message, ModelAdapter } from "@itfs/types";
import { ReasoningLoop } from "@itfs/l5-reasoning";

export class Orchestrator {
  private reasoningLoop: ReasoningLoop;
  private plannerModel?: ModelAdapter;

  constructor(reasoningLoop: ReasoningLoop, plannerModel?: ModelAdapter) {
    this.reasoningLoop = reasoningLoop;
    this.plannerModel = plannerModel;
  }

  async execute(task: TaskEnvelope): Promise<Message> {
    const subTasks = await this.decompose(task);
    console.log(`Decomposed task into ${subTasks.length} sub-tasks`);

    let lastResult: Message = { role: "assistant", content: "" };
    for (const subTask of subTasks) {
      lastResult = await this.reasoningLoop.run(subTask);
    }
    return lastResult;
  }

  private async decompose(task: TaskEnvelope): Promise<TaskEnvelope[]> {
    if (this.plannerModel) {
      // 10x improvement: LLM-driven planning
      const response = await this.plannerModel.complete([
        {
          role: "system",
          content:
            "Break the following task into a list of standalone sub-tasks. Return only a JSON array of strings.",
        },
        { role: "user", content: task.description },
      ]);

      try {
        const parts = JSON.parse(response.message.content || "[]");
        return parts.map((part: string, i: number) => ({
          ...task,
          task_id: `${task.task_id}-sub-${i}`,
          title: `${task.title} (Part ${i + 1})`,
          description: part,
        }));
      } catch {
        // Fallback to keyword-based
      }
    }

    // Simple decomposition mock: if description contains "and", split it
    if (task.description.includes(" and ")) {
      const parts = task.description.split(" and ");
      return parts.map((part, i) => ({
        ...task,
        task_id: `${task.task_id}-sub-${i}`,
        title: `${task.title} (Part ${i + 1})`,
        description: part.trim(),
      }));
    }
    return [task];
  }
}

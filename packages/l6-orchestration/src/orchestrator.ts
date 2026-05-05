import { TaskEnvelope, Message } from "@itfs/types";
import { ReasoningLoop } from "@itfs/l5-reasoning";

export class Orchestrator {
  private reasoningLoop: ReasoningLoop;

  constructor(reasoningLoop: ReasoningLoop) {
    this.reasoningLoop = reasoningLoop;
  }

  async execute(task: TaskEnvelope): Promise<Message> {
    const subTasks = this.decompose(task);
    console.log(`Decomposed task into ${subTasks.length} sub-tasks`);

    let lastResult: Message = { role: "assistant", content: "" };
    for (const subTask of subTasks) {
      lastResult = await this.reasoningLoop.run(subTask);
    }
    return lastResult;
  }

  private decompose(task: TaskEnvelope): TaskEnvelope[] {
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

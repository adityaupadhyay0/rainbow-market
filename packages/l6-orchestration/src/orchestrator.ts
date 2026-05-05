import { TaskEnvelope, Message } from "@itfs/types";
import { ReasoningLoop } from "@itfs/l5-reasoning";

export class Orchestrator {
  private reasoningLoop: ReasoningLoop;

  constructor(reasoningLoop: ReasoningLoop) {
    this.reasoningLoop = reasoningLoop;
  }

  async execute(task: TaskEnvelope): Promise<Message> {
    // For now, simple direct execution.
    // In the future, this will handle decomposition into subtasks.
    return this.reasoningLoop.run(task);
  }
}

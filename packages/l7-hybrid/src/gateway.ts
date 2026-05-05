import { TaskEnvelope, Message } from "@itfs/types";
import { Orchestrator } from "@itfs/l6-orchestration";

export class HybridGateway {
  private orchestrator: Orchestrator;

  constructor(orchestrator: Orchestrator) {
    this.orchestrator = orchestrator;
  }

  async handleTask(task: TaskEnvelope): Promise<Message> {
    // In the future, this will decide between local and cloud execution.
    // For now, it delegates to the orchestrator.
    return this.orchestrator.execute(task);
  }
}

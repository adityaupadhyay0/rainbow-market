import { TaskEnvelope, Message } from "@itfs/types";
import { Orchestrator } from "@itfs/l6-orchestration";
import { RoutingPolicyEngine } from './policy';

export class HybridGateway {
  private orchestrator: Orchestrator;
  private policyEngine: RoutingPolicyEngine;

  constructor(orchestrator: Orchestrator, policyEngine: RoutingPolicyEngine) {
    this.orchestrator = orchestrator;
    this.policyEngine = policyEngine;
  }

  async handleTask(task: TaskEnvelope): Promise<Message> {
    const route = this.policyEngine.determineRoute(task);
    console.log(`Routing task "${task.title}" to ${route}`);

    // In a full implementation, the orchestrator would be configured with
    // the appropriate local or cloud adapter based on the route.
    return this.orchestrator.execute(task);
  }
}

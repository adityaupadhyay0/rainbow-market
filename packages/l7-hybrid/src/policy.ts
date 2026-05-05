import { TaskEnvelope } from "@itfs/types";

export class RoutingPolicyEngine {
  private routingRules: string;

  constructor(routingRules: string) {
    this.routingRules = routingRules;
  }

  determineRoute(task: TaskEnvelope): "local" | "cloud" {
    if (task.privacy_mode === "local_only") return "local";
    if (task.privacy_mode === "cloud_allowed") return "cloud";

    // Simple policy: if title contains "complex", go to cloud
    if (task.title.toLowerCase().includes("complex")) {
      return "cloud";
    }

    // Default to local as per ITFS philosophy
    return "local";
  }
}

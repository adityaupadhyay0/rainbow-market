import { TaskEnvelope } from "@itfs/types";

export class RoutingPolicyEngine {
  private routingRules: string;

  constructor(routingRules: string) {
    this.routingRules = routingRules;
  }

  public detectSensitivity(task: TaskEnvelope): boolean {
    // 10x improvement: sensitivity detection mock
    const sensitiveKeywords = [
      "api_key",
      "password",
      "secret",
      "pii",
      "private",
    ];
    return sensitiveKeywords.some(
      (k) =>
        task.title.toLowerCase().includes(k) ||
        task.description.toLowerCase().includes(k),
    );
  }

  determineRoute(task: TaskEnvelope): "local" | "cloud" {
    if (task.privacy_mode === "local_only") return "local";

    if (this.detectSensitivity(task)) {
      console.log("Sensitivity detected. Forcing local route.");
      return "local";
    }

    if (task.privacy_mode === "cloud_allowed") return "cloud";

    // 10x policy: if title contains "complex", go to cloud
    if (task.title.toLowerCase().includes("complex")) {
      return "cloud";
    }

    // Default to local as per ITFS philosophy
    return "local";
  }
}

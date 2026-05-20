import { ModelAdapter, TaskEnvelope } from "@itfs/types";

export class RoutingEngine {
  route(
    envelope: TaskEnvelope,
    local: ModelAdapter,
    cloud: ModelAdapter,
  ): ModelAdapter {
    const { privacy_mode, description, budget, domain } = envelope;

    // 1. local_only: Always route to local
    if (privacy_mode === "local_only") {
      return local;
    }

    // 2. cloud_allowed: Route to cloud if task is complex or budget is high
    if (privacy_mode === "cloud_allowed") {
      const isComplex =
        description.length > 250 ||
        (budget.max_tokens ?? 0) > 2000 ||
        domain.startsWith("coding:");

      return isComplex ? cloud : local;
    }

    // 3. hybrid: Prefer local for general, cloud for specialized domains
    if (privacy_mode === "hybrid") {
      if (domain === "general" || domain === "workflow") {
        return local;
      }
      return cloud;
    }

    // Default fallback
    return local;
  }
}

export const name = "l7-hybrid";

import { SkillBundle } from "./loader";
import { ModelAdapter, Telemetry } from "@itfs/types";

export class SkillDistiller {
  private model: ModelAdapter;

  constructor(model: ModelAdapter) {
    this.model = model;
  }

  async distill(taskId: string, successfulTrace: string): Promise<SkillBundle> {
    Telemetry.log("skill_distillation_start", { taskId });

    const response = await this.model.complete([
      {
        role: "system",
        content:
          "Based on the following successful task execution trace, create a reusable ITFS skill bundle in JSON format. Include name, domain, and procedural steps.",
      },
      { role: "user", content: successfulTrace },
    ]);

    try {
      const metadata = JSON.parse(response.message.content || "{}");
      return {
        metadata: {
          id: `${metadata.name.toLowerCase().replace(/\s+/g, "_")}@1.0.0`,
          name: metadata.name,
          domain: metadata.domain || "general",
          description: metadata.description || "Distilled skill",
        },
        content: metadata.procedure || "No procedure found",
      };
    } catch {
      throw new Error("Failed to distill skill from trace");
    }
  }
}

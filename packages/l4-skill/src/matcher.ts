import { SkillBundle } from "./loader";
import { DomainTag } from "@itfs/types";

export class SkillMatcher {
  private bundles: SkillBundle[];

  constructor(bundles: SkillBundle[]) {
    this.bundles = bundles;
  }

  findBestMatch(
    taskDescription: string,
    domain?: DomainTag,
  ): SkillBundle | undefined {
    // 10x improvement: Semantic matching mock
    // In a real system, we'd use embeddings here.
    const filtered = domain
      ? this.bundles.filter((b) => b.metadata.domain === domain)
      : this.bundles;

    return filtered.find(
      (b) =>
        taskDescription.toLowerCase().includes(b.metadata.name.toLowerCase()) ||
        taskDescription.toLowerCase().includes(b.metadata.domain.toLowerCase()),
    );
  }
}

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DomainTag, SkillId } from "@itfs/types";

export interface SkillMetadata {
  id: SkillId;
  name: string;
  domain: DomainTag;
  description: string;
}

export interface SkillBundle {
  metadata: SkillMetadata;
  content: string; // The SKILL.md content
}

export class SkillLoader {
  private skillsDir: string;

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  async loadSkills(): Promise<SkillBundle[]> {
    const bundles: SkillBundle[] = [];
    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(this.skillsDir, entry.name);
          const metadataPath = path.join(skillPath, "METADATA.json");
          const skillMdPath = path.join(skillPath, "SKILL.md");

          try {
            const metadata = JSON.parse(
              await fs.readFile(metadataPath, "utf-8"),
            );
            const content = await fs.readFile(skillMdPath, "utf-8");
            bundles.push({ metadata, content });
          } catch (e) {
            console.error(`Failed to load skill in ${entry.name}`, e);
          }
        }
      }
    } catch (e) {
      console.error("Failed to read skills directory", e);
    }
    return bundles;
  }

  async findSkillsByDomain(domain: DomainTag): Promise<SkillBundle[]> {
    const all = await this.loadSkills();
    return all.filter((s) => s.metadata.domain === domain);
  }
}

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Skill, SkillMetadata } from "@itfs/types";

export class SkillLoader {
  constructor(private readonly skillsDir: string) {}

  async loadSkill(skillId: string): Promise<Skill> {
    const skillPath = join(this.skillsDir, skillId);

    const metadataPath = join(skillPath, "METADATA.json");
    const proceduresPath = join(skillPath, "SKILL.md");

    try {
      const [metadataRaw, procedures] = await Promise.all([
        readFile(metadataPath, "utf-8"),
        readFile(proceduresPath, "utf-8"),
      ]);

      const metadata = JSON.parse(metadataRaw) as SkillMetadata;

      return {
        metadata,
        procedures,
      };
    } catch (error) {
      throw new Error(`Failed to load skill '${skillId}': ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async listSkills(): Promise<string[]> {
    try {
      const entries = await readdir(this.skillsDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch (error) {
       throw new Error(`Failed to list skills in '${this.skillsDir}': ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async loadAllSkills(): Promise<Skill[]> {
    const skillIds = await this.listSkills();
    return Promise.all(skillIds.map((id) => this.loadSkill(id)));
  }
}

export const name = "l4-skill";

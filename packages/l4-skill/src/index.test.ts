import { describe, it, expect } from "vitest";
import { SkillLoader } from "./index";
import { join } from "node:path";

describe("SkillLoader", () => {
  const skillsDir = join(process.cwd(), "../../skills");
  const loader = new SkillLoader(skillsDir);

  it("should list available skills", async () => {
    const skills = await loader.listSkills();
    expect(skills).toContain("sample-skill");
  });

  it("should load a specific skill", async () => {
    const skill = await loader.loadSkill("sample-skill");
    expect(skill.metadata.id).toBe("sample-skill");
    expect(skill.metadata.name).toBe("Sample Skill");
    expect(skill.procedures).toContain("# Sample Skill");
  });

  it("should load all skills", async () => {
    const allSkills = await loader.loadAllSkills();
    expect(allSkills.length).toBeGreaterThan(0);
    expect(allSkills.find(s => s.metadata.id === "sample-skill")).toBeDefined();
  });

  it("should throw error if skill does not exist", async () => {
    await expect(loader.loadSkill("non-existent")).rejects.toThrow("Failed to load skill 'non-existent'");
  });
});

import { describe, it, expect } from "vitest";
import { SkillLoader } from "../loader";
import * as path from "node:path";

describe("SkillLoader", () => {
  it("should load skills from disk", async () => {
    const loader = new SkillLoader(path.join(process.cwd(), "../../skills"));
    const skills = await loader.loadSkills();
    expect(skills.length).toBeGreaterThan(0);
    expect(skills[0].metadata.name).toBe("General Writing");
  });
});

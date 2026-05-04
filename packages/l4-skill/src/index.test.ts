import { describe, it, expect } from "vitest";
import { name } from "./index";

describe("l4-skill", () => {
  it("should have a name", () => {
    expect(name).toBe("l4-skill");
  });
});

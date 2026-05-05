import { describe, it, expect } from "vitest";
import { name } from "./index";

describe("l3-tooling", () => {
  it("should have a name", () => {
    expect(name).toBe("l3-tooling");
  });
});

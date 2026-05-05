import { describe, it, expect } from "vitest";
import { name } from "./index";

describe("l7-hybrid", () => {
  it("should have a name", () => {
    expect(name).toBe("l7-hybrid");
  });
});

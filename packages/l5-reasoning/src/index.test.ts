import { describe, it, expect } from "vitest";
import { name } from "./index";

describe("l5-reasoning", () => {
  it("should have a name", () => {
    expect(name).toBe("l5-reasoning");
  });
});

import { describe, it, expect } from "vitest";
import { name } from "./index";

describe("l6-orchestration", () => {
  it("should have a name", () => {
    expect(name).toBe("l6-orchestration");
  });
});

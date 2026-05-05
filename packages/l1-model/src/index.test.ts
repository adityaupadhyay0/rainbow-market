import { describe, it, expect } from "vitest";
import { name } from "./index";

describe("l1-model", () => {
  it("should have a name", () => {
    expect(name).toBe("l1-model");
  });
});

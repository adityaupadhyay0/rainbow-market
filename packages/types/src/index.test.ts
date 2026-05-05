import { describe, it, expect } from "vitest";
import { name } from "./index";

describe("types", () => {
  it("should have a name", () => {
    expect(name).toBe("types");
  });
});

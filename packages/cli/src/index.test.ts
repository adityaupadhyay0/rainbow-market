import { describe, it, expect } from "vitest";
import { name } from "./index";

describe("cli", () => {
  it("should have a name", () => {
    expect(name).toBe("cli");
  });
});

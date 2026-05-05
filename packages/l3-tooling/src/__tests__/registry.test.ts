import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../registry";
import { ReadFileTool } from "../tools/fs";

describe("ToolRegistry", () => {
  it("should register and execute tools", async () => {
    const registry = new ToolRegistry();
    registry.register(new ReadFileTool());

    const tools = registry.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("read_file");
  });
});

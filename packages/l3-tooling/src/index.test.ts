import { describe, it, expect } from "vitest";
import { ToolRegistry, LocalCodeExecutionTool } from "./index";
import { ToolCall } from "@itfs/types";

describe("ToolRegistry", () => {
  it("should register and call a local tool", async () => {
    const registry = new ToolRegistry();
    const localTool = new LocalCodeExecutionTool();
    registry.registerTool(localTool);

    const call: ToolCall = {
      tool_id: "local_code_execution",
      input: { code: "1 + 1" },
    };

    const result = await registry.call(call);
    expect(result.success).toBe(true);
    expect(result.output).toBe(2);
  });

  it("should return error if tool not found", async () => {
    const registry = new ToolRegistry();
    const call: ToolCall = {
      tool_id: "non_existent",
      input: {},
    };

    const result = await registry.call(call);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Tool not found");
  });

  it("should list registered tools", () => {
    const registry = new ToolRegistry();
    const localTool = new LocalCodeExecutionTool();
    registry.registerTool(localTool);

    const tools = registry.listTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("local_code_execution");
  });
});

import { ToolId, ToolSpec, ToolResult } from "@itfs/types";

export interface Tool {
  spec: ToolSpec;
  execute(input: unknown): Promise<ToolResult>;
}

export class ToolRegistry {
  private tools: Map<ToolId, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.spec.name, tool);
  }

  getTool(id: ToolId): Tool | undefined {
    return this.tools.get(id);
  }

  listTools(): ToolSpec[] {
    return Array.from(this.tools.values()).map((t) => t.spec);
  }

  async execute(id: ToolId, input: unknown): Promise<ToolResult> {
    const tool = this.getTool(id);
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool ${id} not found`,
        duration_ms: 0,
      };
    }

    const start = Date.now();
    try {
      const result = await tool.execute(input);
      return {
        ...result,
        duration_ms: Date.now() - start,
      };
    } catch (e: unknown) {
      return {
        success: false,
        output: null,
        error: e instanceof Error ? e.message : String(e),
        duration_ms: Date.now() - start,
      };
    }
  }
}

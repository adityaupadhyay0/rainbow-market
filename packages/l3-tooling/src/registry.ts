import { ToolId, ToolSpec, ToolResult } from "@itfs/types";

export interface Tool {
  spec: ToolSpec;
  scope?: string;
  execute(input: unknown): Promise<ToolResult>;
}

export interface ToolStats {
  callCount: number;
  totalDurationMs: number;
  lastUsed?: number;
}

export class ToolRegistry {
  private tools: Map<ToolId, Tool> = new Map();
  private stats: Map<ToolId, ToolStats> = new Map();
  private allowedScopes: Set<string> = new Set(["*"]);

  setAllowedScopes(scopes: string[]) {
    this.allowedScopes = new Set(scopes);
  }

  register(tool: Tool) {
    this.tools.set(tool.spec.name, tool);
  }

  getTool(id: ToolId): Tool | undefined {
    return this.tools.get(id);
  }

  listTools(): ToolSpec[] {
    return Array.from(this.tools.values()).map((t) => t.spec);
  }

  getStats(id: ToolId): ToolStats | undefined {
    return this.stats.get(id);
  }

  getAllStats(): Record<ToolId, ToolStats> {
    return Object.fromEntries(this.stats);
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

    if (
      tool.scope &&
      !this.allowedScopes.has("*") &&
      !this.allowedScopes.has(tool.scope)
    ) {
      return {
        success: false,
        output: null,
        error: `Permission denied: Tool ${id} requires scope ${tool.scope}`,
        duration_ms: 0,
      };
    }

    const start = Date.now();
    try {
      const result = await tool.execute(input);
      const duration = Date.now() - start;

      // Update stats
      const currentStats = this.stats.get(id) || {
        callCount: 0,
        totalDurationMs: 0,
      };
      this.stats.set(id, {
        callCount: currentStats.callCount + 1,
        totalDurationMs: currentStats.totalDurationMs + duration,
        lastUsed: Date.now(),
      });

      return {
        ...result,
        duration_ms: duration,
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

import { ToolCall, ToolResult, ToolSpec } from "@itfs/types";
import vm from "node:vm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface Tool {
  spec: ToolSpec;
  execute(input: unknown): Promise<ToolResult>;
}

/**
 * WARNING: This tool uses `node:vm` which is NOT a secure sandbox.
 * It is intended for local research and development only.
 * Do not use this to execute untrusted code in a production environment.
 */
export class LocalCodeExecutionTool implements Tool {
  spec: ToolSpec = {
    name: "local_code_execution",
    description: "Executes Javascript code in a local (unsecured) VM sandbox.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The Javascript code to execute" },
        timeout_ms: {
          type: "number",
          description: "Execution timeout in milliseconds",
          default: 5000,
        },
      },
      required: ["code"],
    },
  };

  async execute(input: { code: string; timeout_ms?: number }): Promise<ToolResult> {
    const { code, timeout_ms = 5000 } = input;
    const startTime = Date.now();
    try {
      // Basic sandbox with common globals
      const sandbox = {
        console,
        Buffer,
        process: {
          hrtime: process.hrtime,
        },
      };
      const context = vm.createContext(sandbox);
      const script = new vm.Script(code);
      const output = script.runInContext(context, { timeout: timeout_ms });

      return {
        success: true,
        output: output,
        duration_ms: Date.now() - startTime,
      };
    } catch (_e) {
      const error = _e as Error;
      return {
        success: false,
        output: null,
        error: error.message,
        duration_ms: Date.now() - startTime,
      };
    }
  }
}

export class MCPToolAdapter implements Tool {
  constructor(
    public spec: ToolSpec,
    private client: Client,
  ) {}

  async execute(input: unknown, timeout_ms = 10000): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      // Use the abort signal for timeout if supported by the SDK version
      const result = await this.client.callTool(
        {
          name: this.spec.name,
          arguments: input as Record<string, unknown>,
        },
        {
          // @ts-expect-error - The SDK version in this environment has conflicting types for options
          timeout: timeout_ms,
        },
      );

      return {
        success: true,
        output: result.content,
        duration_ms: Date.now() - startTime,
      };
    } catch (_e) {
      const error = _e as Error;
      return {
        success: false,
        output: null,
        error: error.message,
        duration_ms: Date.now() - startTime,
      };
    }
  }
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  registerTool(tool: Tool): void {
    this.tools.set(tool.spec.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolSpec[] {
    return Array.from(this.tools.values()).map((t) => t.spec);
  }

  async registerMCPTools(
    command: string,
    args: string[] = [],
    env?: Record<string, string>,
  ): Promise<void> {
    const transport = new StdioClientTransport({
      command,
      args,
      env: env ?? (process.env as Record<string, string>),
    });

    const client = new Client(
      {
        name: "itfs-mcp-adapter",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    await client.connect(transport);

    const { tools } = await client.listTools();
    for (const mcpTool of tools) {
      const spec: ToolSpec = {
        name: mcpTool.name,
        description: mcpTool.description ?? "",
        parameters: (mcpTool.inputSchema as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        },
      };
      this.registerTool(new MCPToolAdapter(spec, client));
    }
  }

  async call(call: ToolCall): Promise<ToolResult> {
    const tool = this.getTool(call.tool_id);
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool not found: ${call.tool_id}`,
        duration_ms: 0,
      };
    }

    try {
      return await tool.execute(call.input);
    } catch (_e) {
      const error = _e as Error;
      return {
        success: false,
        output: null,
        error: `Tool execution failed: ${error.message}`,
        duration_ms: 0,
      };
    }
  }
}

export const name = "l3-tooling";

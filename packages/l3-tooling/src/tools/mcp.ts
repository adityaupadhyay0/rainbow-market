import { Tool } from "../registry";
import { ToolResult } from "@itfs/types";

export class MCPAdapterTool implements Tool {
  spec = {
    name: "mcp_tool",
    description: "Call an external tool via Model Context Protocol (MCP)",
    parameters: {
      type: "object",
      properties: {
        server: { type: "string", description: "MCP server name" },
        tool: { type: "string", description: "Tool name on the server" },
        arguments: { type: "object" },
      },
      required: ["server", "tool", "arguments"],
    },
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { server, tool } = input as {
      server: string;
      tool: string;
    };
    const start = Date.now();

    // Simplified MCP over stdio mock
    console.log(`[MCP] Calling ${server}/${tool}...`);

    return {
      success: true,
      output: `MCP Response from ${server}/${tool} (Mocked)`,
      duration_ms: Date.now() - start,
    };
  }
}

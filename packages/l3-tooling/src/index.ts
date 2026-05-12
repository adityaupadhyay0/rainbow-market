import { ToolCall, ToolResult, ToolSpec } from "@itfs/types";
import vm from "node:vm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs/promises";
import path from "node:path";

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

function securePath(relative_path: string): string {
  const root = process.cwd();
  const resolved = path.resolve(root, relative_path);
  const relative = path.relative(root, resolved);

  // If the path is outside the root, the relative path will start with '..'
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Access denied: path '${relative_path}' is outside of root.`);
  }

  return resolved;
}

export class ReadFileTool implements Tool {
  spec: ToolSpec = {
    name: "read_file",
    description: "Reads the content of a file from the repository.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the file" },
      },
      required: ["path"],
    },
  };

  async execute(input: { path: string }): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const filePath = securePath(input.path);
      const content = await fs.readFile(filePath, "utf-8");
      return {
        success: true,
        output: content,
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

export class WriteFileTool implements Tool {
  spec: ToolSpec = {
    name: "write_file",
    description: "Writes content to a file in the repository.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the file" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  };

  async execute(input: { path: string; content: string }): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const filePath = securePath(input.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, input.content, "utf-8");
      return {
        success: true,
        output: `File written to ${input.path}`,
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

/**
 * NAIVE IMPLEMENTATION: This uses simple line-by-line comparison.
 * TODO: Replace with a proper LCS (Longest Common Subsequence) algorithm.
 */
export class DiffFileTool implements Tool {
  spec: ToolSpec = {
    name: "diff_file",
    description: "Returns a simple line-based diff between two files.",
    parameters: {
      type: "object",
      properties: {
        path_a: { type: "string", description: "Path to first file" },
        path_b: { type: "string", description: "Path to second file" },
      },
      required: ["path_a", "path_b"],
    },
  };

  async execute(input: { path_a: string; path_b: string }): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const pathA = securePath(input.path_a);
      const pathB = securePath(input.path_b);
      const [contentA, contentB] = await Promise.all([
        fs.readFile(pathA, "utf-8"),
        fs.readFile(pathB, "utf-8"),
      ]);

      if (contentA === contentB) {
        return {
          success: true,
          output: "Files are identical.",
          duration_ms: Date.now() - startTime,
        };
      }

      // Simple line-by-line diff implementation
      const linesA = contentA.split("\n");
      const linesB = contentB.split("\n");
      const diff: string[] = [];
      const maxLines = Math.max(linesA.length, linesB.length);

      for (let i = 0; i < maxLines; i++) {
        if (linesA[i] !== linesB[i]) {
          if (i < linesA.length) diff.push(`- L${i + 1}: ${linesA[i]}`);
          if (i < linesB.length) diff.push(`+ L${i + 1}: ${linesB[i]}`);
        }
      }

      return {
        success: true,
        output: diff.join("\n"),
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

/**
 * SSRF RISK: This tool does not currently have domain whitelisting.
 * TODO: Implement domain whitelisting and internal IP blocking.
 */
export class WebFetchTool implements Tool {
  spec: ToolSpec = {
    name: "web_fetch",
    description: "Fetches content from a URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch" },
      },
      required: ["url"],
    },
  };

  async execute(input: { url: string }): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(input.url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      return {
        success: true,
        output: text,
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

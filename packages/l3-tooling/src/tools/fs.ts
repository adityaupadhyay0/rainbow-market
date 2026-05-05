import { Tool } from "../registry";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ToolResult } from "@itfs/types";

export class ReadFileTool implements Tool {
  spec = {
    name: "read_file",
    description: "Read the content of a file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { path: filePath } = input as { path: string };
    const root = process.cwd();
    const resolvedPath = path.resolve(root, filePath);

    if (!resolvedPath.startsWith(root)) {
      return {
        success: false,
        output: null,
        error: 'Path out of bounds',
        duration_ms: 0,
      };
    }

    try {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      return { success: true, output: content, duration_ms: 0 };
    } catch (e: unknown) {
      return {
        success: false,
        output: null,
        error: e instanceof Error ? e.message : String(e),
        duration_ms: 0,
      };
    }
  }
}

export class WriteFileTool implements Tool {
  spec = {
    name: "write_file",
    description: "Write content to a file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { path: filePath, content } = input as {
      path: string;
      content: string;
    };
    const root = process.cwd();
    const resolvedPath = path.resolve(root, filePath);

    if (!resolvedPath.startsWith(root)) {
      return {
        success: false,
        output: null,
        error: 'Path out of bounds',
        duration_ms: 0,
      };
    }

    try {
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, content, 'utf-8');
      return {
        success: true,
        output: `File written to ${filePath}`,
        duration_ms: 0,
      };
    } catch (e: unknown) {
      return {
        success: false,
        output: null,
        error: e instanceof Error ? e.message : String(e),
        duration_ms: 0,
      };
    }
  }
}

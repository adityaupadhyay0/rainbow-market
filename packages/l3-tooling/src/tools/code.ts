import { Tool } from "../registry";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { ToolResult } from "@itfs/types";

const execAsync = promisify(exec);

export class CodeExecutionTool implements Tool {
  spec = {
    name: "execute_code",
    description:
      "Execute Python or Node.js code in a sandboxed-ish environment",
    parameters: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["python", "javascript"] },
        code: { type: "string" },
      },
      required: ["language", "code"],
    },
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { language, code } = input as { language: string; code: string };
    const start = Date.now();
    try {
      let command = "";
      if (language === "python") {
        command = `python3 -c ${JSON.stringify(code)}`;
      } else {
        command = `node -e ${JSON.stringify(code)}`;
      }

      const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
      return {
        success: true,
        output: { stdout, stderr },
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

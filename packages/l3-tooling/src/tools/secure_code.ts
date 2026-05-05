import { Tool } from "../registry";
import { ToolResult } from "@itfs/types";
import * as vm from "node:vm";

export class SecureCodeExecutionTool implements Tool {
  scope = "code:execution";
  spec = {
    name: "execute_code_secure",
    description: "Execute Node.js code in a secured VM environment",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
      },
      required: ["code"],
    },
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { code } = input as { code: string };
    const start = Date.now();

    try {
      const context = vm.createContext({});
      const result = vm.runInContext(code, context, { timeout: 5000 });

      return {
        success: true,
        output: { result },
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

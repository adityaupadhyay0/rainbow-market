import { ToolResult } from "@itfs/types";
import vm from "node:vm";

/**
 * WARNING: This tool uses `node:vm` which is NOT a secure sandbox.
 * It is intended for local research and development only.
 * Do not use this to execute untrusted code in a production environment.
 */
export class LocalCodeExecutionTool {
  async execute(code: string, timeout_ms = 5000): Promise<ToolResult> {
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

export const name = "l3-tooling";

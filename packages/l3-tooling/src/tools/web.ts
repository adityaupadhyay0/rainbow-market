import { Tool } from "../registry";
import { ToolResult } from "@itfs/types";

export class WebAccessTool implements Tool {
  spec = {
    name: "web_access",
    description: "Search or fetch content from the web",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["search", "fetch"] },
        query: { type: "string" },
        url: { type: "string" },
      },
      required: ["action"],
    },
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { action, query, url } = input as {
      action: string;
      query?: string;
      url?: string;
    };
    const start = Date.now();
    try {
      if (action === "search") {
        // Simplified search mock
        return {
          success: true,
          output: `Search results for "${query}": 1. Result A, 2. Result B`,
          duration_ms: Date.now() - start,
        };
      } else if (action === "fetch") {
        const response = await fetch(url!);
        if (!response.ok)
          throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        const text = await response.text();
        return {
          success: true,
          output: text.substring(0, 1000), // Limit output size
          duration_ms: Date.now() - start,
        };
      }
      throw new Error(`Unknown action: ${action}`);
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

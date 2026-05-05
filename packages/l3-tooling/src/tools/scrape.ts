import { Tool } from "../registry";
import { ToolResult } from "@itfs/types";

export class StructuredScrapeTool implements Tool {
  spec = {
    name: "structured_scrape",
    description:
      "Fetch a URL and return content as structured text (markdown-ish)",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { url } = input as { url: string };
    const start = Date.now();
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${url}`);
      const html = await response.text();

      // Simple HTML to text conversion for 10x improvement
      const text = html
        .replace(/<script[^>]*>([\S\s]*?)<\/script>/gim, "")
        .replace(/<style[^>]*>([\S\s]*?)<\/style>/gim, "")
        .replace(/<[^>]+>/gm, " ")
        .replace(/\s+/gm, " ")
        .trim();

      return {
        success: true,
        output: text.substring(0, 2000),
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

import { Tool } from "../registry";
import { ToolResult } from "@itfs/types";

export interface Searchable {
  query(
    text: string,
    k?: number,
  ): Promise<{ content: string; score: number }[]>;
}

export class RetrievalTool implements Tool {
  spec = {
    name: "retrieve_knowledge",
    description: "Search internal knowledge base for relevant information",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        k: { type: "number", description: "Number of results to return" },
      },
      required: ["query"],
    },
  };

  private store: Searchable;

  constructor(store: Searchable) {
    this.store = store;
  }

  async execute(input: unknown): Promise<ToolResult> {
    const { query, k } = input as { query: string; k?: number };
    const start = Date.now();
    try {
      const results = await this.store.query(query, k);
      return {
        success: true,
        output: results,
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

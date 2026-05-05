import * as fs from "node:fs/promises";

export interface RetrievalResult {
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class SimpleVectorStore {
  private documents: { content: string; metadata?: Record<string, unknown> }[] =
    [];
  private filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
  }

  async load() {
    if (!this.filePath) return;
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      this.documents = JSON.parse(data);
    } catch {
      // Ignore
    }
  }

  async save() {
    if (!this.filePath) return;
    await fs.writeFile(this.filePath, JSON.stringify(this.documents, null, 2));
  }

  addDocument(content: string, metadata?: Record<string, unknown>) {
    this.documents.push({ content, metadata });
  }

  async query(text: string, k: number = 3): Promise<RetrievalResult[]> {
    // Simplified retrieval: just check for keyword inclusion as a mock for semantic search
    const results = this.documents
      .map((doc) => {
        const score = text
          .split(" ")
          .filter((word) =>
            doc.content.toLowerCase().includes(word.toLowerCase()),
          ).length;
        return { ...doc, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return results.map((r) => ({
      content: r.content,
      score: r.score,
      metadata: r.metadata,
    }));
  }
}

export interface RetrievalResult {
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class SimpleVectorStore {
  private documents: { content: string; metadata?: Record<string, unknown> }[] = [];

  addDocument(content: string, metadata?: Record<string, unknown>) {
    this.documents.push({ content, metadata });
  }

  async query(text: string, k: number = 3): Promise<RetrievalResult[]> {
    // Simplified retrieval: just check for keyword inclusion as a mock for semantic search
    const results = this.documents
      .map((doc) => {
        const score = text
          .split(' ')
          .filter((word) => doc.content.toLowerCase().includes(word.toLowerCase())).length;
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

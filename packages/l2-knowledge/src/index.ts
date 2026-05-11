import {
  VectorStore,
  VectorDocument,
  Retriever,
  RetrievalResult,
  ModelAdapter,
} from "@itfs/types";

export class LocalVectorStore implements VectorStore {
  private documents: VectorDocument[] = [];

  async add(documents: VectorDocument[]): Promise<void> {
    this.documents.push(...documents);
  }

  async search(
    query_embedding: number[],
    limit: number,
  ): Promise<(VectorDocument & { similarity: number })[]> {
    const results = this.documents
      .map((doc) => {
        if (!doc.embedding) return { ...doc, similarity: 0 };
        const similarity = this.cosineSimilarity(
          query_embedding,
          doc.embedding,
        );
        return { ...doc, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  async delete(ids: string[]): Promise<void> {
    this.documents = this.documents.filter((doc) => !ids.includes(doc.id));
  }

  async clear(): Promise<void> {
    this.documents = [];
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;
    return dotProduct / magnitude;
  }
}

export class KnowledgeRetriever implements Retriever {
  constructor(
    private vectorStore: VectorStore,
    private model: ModelAdapter,
    private options: {
      similarityThreshold?: number;
    } = {},
  ) {}

  async retrieve(query: string, limit: number = 5): Promise<RetrievalResult> {
    const embeddings = await this.model.embed(query);
    const queryEmbedding = embeddings[0];

    if (!queryEmbedding) {
      return { documents: [], confidence: "incorrect" };
    }

    let documents = await this.vectorStore.search(queryEmbedding, limit);

    // Naive confidence scoring
    const topSimilarity = documents[0]?.similarity ?? 0;
    const threshold = this.options.similarityThreshold ?? 0.7;

    let confidence: RetrievalResult["confidence"] = "incorrect";
    if (topSimilarity > threshold) {
      confidence = "correct";
      // Knowledge Refinement: In "Corrective RAG", we refine the documents if they are correct.
      // For now, we simulate this by filtering out documents that are significantly below the top similarity.
      documents = documents.filter((doc) => doc.similarity > threshold * 0.8);
    } else if (topSimilarity > threshold / 2) {
      confidence = "ambiguous";
    }

    return {
      documents,
      confidence,
    };
  }
}

export const name = "l2-knowledge";

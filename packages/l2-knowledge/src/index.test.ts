import { describe, it, expect, vi } from "vitest";
import { LocalVectorStore, KnowledgeRetriever } from "./index";
import { ModelAdapter } from "@itfs/types";

describe("LocalVectorStore", () => {
  it("should add and search documents", async () => {
    const store = new LocalVectorStore();
    await store.add([
      { id: "1", content: "apple", embedding: [1, 0, 0] },
      { id: "2", content: "banana", embedding: [0, 1, 0] },
    ]);

    const results = await store.search([1, 0, 0], 1);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("1");
    expect(results[0].similarity).toBe(1);
  });

  it("should delete documents", async () => {
    const store = new LocalVectorStore();
    await store.add([{ id: "1", content: "apple", embedding: [1, 0, 0] }]);
    await store.delete(["1"]);
    const results = await store.search([1, 0, 0], 1);
    expect(results).toHaveLength(0);
  });
});

describe("KnowledgeRetriever", () => {
  it("should retrieve and score correctly", async () => {
    const store = new LocalVectorStore();
    await store.add([
      { id: "1", content: "apple", embedding: [1, 0, 0] },
      { id: "2", content: "orange", embedding: [0.9, 0.1, 0] },
    ]);

    const mockModel = {
      embed: vi.fn().mockResolvedValue([[1, 0, 0]]),
    } as unknown as ModelAdapter;

    const retriever = new KnowledgeRetriever(store, mockModel, {
      similarityThreshold: 0.8,
    });

    const result = await retriever.retrieve("apple");
    expect(result.confidence).toBe("correct");
    expect(result.documents).toHaveLength(2); // Both are above threshold * 0.8 (0.64)
  });

  it("should return ambiguous for low similarity", async () => {
    const store = new LocalVectorStore();
    await store.add([{ id: "1", content: "apple", embedding: [0.5, 0.5, 0] }]);

    const mockModel = {
      embed: vi.fn().mockResolvedValue([[1, 0, 0]]),
    } as unknown as ModelAdapter;

    const retriever = new KnowledgeRetriever(store, mockModel, {
      similarityThreshold: 0.8,
    });

    const result = await retriever.retrieve("query");
    expect(result.confidence).toBe("ambiguous");
  });
});

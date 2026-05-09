import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaAdapter, AnthropicAdapter } from "./index.js";
import { Message } from "@itfs/types";

describe("OllamaAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should complete a chat correctly", async () => {
    const mockResponse = {
      message: { content: "Hello from Ollama" },
      prompt_eval_count: 10,
      eval_count: 20,
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const adapter = new OllamaAdapter(undefined, "mistral");
    const messages: Message[] = [{ role: "user", content: "Hi" }];
    const response = await adapter.complete(messages);

    expect(response.message.content).toBe("Hello from Ollama");
    expect(response.usage.total_tokens).toBe(30);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/chat"),
      expect.objectContaining({
        body: expect.stringContaining('"model":"mistral"'),
      }),
    );
  });

  it("should stream a chat correctly", async () => {
    const chunks = [
      JSON.stringify({ message: { content: "Hel" } }) + "\n",
      JSON.stringify({ message: { content: "lo" } }) + "\n",
    ];

    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[0]) })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[1]) })
        .mockResolvedValueOnce({ done: true }),
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    const adapter = new OllamaAdapter();
    const stream = adapter.stream([{ role: "user", content: "Hi" }]);
    const results = [];
    for await (const chunk of stream) {
      results.push(chunk.content);
    }

    expect(results).toEqual(["Hel", "lo"]);
  });

  it("should estimate tokens correctly", async () => {
    const adapter = new OllamaAdapter();
    const tokens = await adapter.estimateTokens([{ role: "user", content: "1234" }]);
    expect(tokens).toBe(1);
  });

  it("should handle API errors", async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    const adapter = new OllamaAdapter();
    await expect(adapter.complete([])).rejects.toThrow("Ollama API error");
  });
});

describe("AnthropicAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should complete a chat correctly", async () => {
    const mockResponse = {
      content: [{ text: "Hello from Claude" }],
      usage: { input_tokens: 15, output_tokens: 25 },
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const adapter = new AnthropicAdapter("fake-api-key");
    const messages: Message[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hi" },
    ];
    const response = await adapter.complete(messages);

    expect(response.message.content).toBe("Hello from Claude");
    expect(response.usage.total_tokens).toBe(40);
  });

  it("should stream a chat correctly", async () => {
    const chunks = [
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hel"}}\n',
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "lo"}}\n',
    ];

    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[0]) })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[1]) })
        .mockResolvedValueOnce({ done: true }),
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    const adapter = new AnthropicAdapter("fake-api-key");
    const stream = adapter.stream([{ role: "user", content: "Hi" }]);
    const results = [];
    for await (const chunk of stream) {
      results.push(chunk.content);
    }

    expect(results).toEqual(["Hel", "lo"]);
  });

  it("should estimate tokens correctly", async () => {
    const adapter = new AnthropicAdapter("fake-api-key");
    const tokens = await adapter.estimateTokens([{ role: "user", content: "1234" }]);
    expect(tokens).toBe(1);
  });

  it("should handle API errors", async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      statusText: "Unauthorized",
      json: () => Promise.resolve({ error: "Invalid API key" }),
    });

    const adapter = new AnthropicAdapter("fake-api-key");
    await expect(adapter.complete([])).rejects.toThrow("Anthropic API error");
  });
});

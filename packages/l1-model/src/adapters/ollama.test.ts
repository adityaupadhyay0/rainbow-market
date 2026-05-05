import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaAdapter } from "./ollama";

describe("OllamaAdapter", () => {
  const options = { model: "llama3" };
  let adapter: OllamaAdapter;

  beforeEach(() => {
    adapter = new OllamaAdapter(options);
    global.fetch = vi.fn();
  });

  it("should call complete correctly", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        message: { content: "Hello!" },
        prompt_eval_count: 10,
        eval_count: 5,
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await adapter.complete([{ role: "user", content: "Hi" }]);

    expect(result.message.content).toBe("Hello!");
    expect(result.usage.total_tokens).toBe(15);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/chat"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"model":"llama3"'),
      }),
    );
  });

  it("should handle errors in complete", async () => {
    const mockResponse = {
      ok: false,
      statusText: "Not Found",
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    await expect(adapter.complete([])).rejects.toThrow(
      "Ollama request failed: Not Found",
    );
  });
});

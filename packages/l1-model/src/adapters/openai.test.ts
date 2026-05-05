import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIAdapter } from "./openai";

describe("OpenAIAdapter", () => {
  const options = { apiKey: "test-key", model: "gpt-4" };
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    adapter = new OpenAIAdapter(options);
    global.fetch = vi.fn();
  });

  it("should call complete correctly", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello from OpenAI!" } }],
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await adapter.complete([{ role: "user", content: "Hi" }]);

    expect(result.message.content).toBe("Hello from OpenAI!");
    expect(result.usage.total_tokens).toBe(12);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/chat/completions"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("should handle tool calls in complete", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  function: {
                    name: "get_weather",
                    arguments: '{"city": "London"}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await adapter.complete(
      [],
      [{ name: "get_weather", description: "", parameters: {} }],
    );

    expect(result.message.tool_calls).toHaveLength(1);
    expect(result.message.tool_calls![0].tool_id).toBe("get_weather");
    expect(result.message.tool_calls![0].input).toEqual({ city: "London" });
  });
});

import { Message, ModelAdapter } from "@itfs/types";

export class MemorySummarizer {
  private model: ModelAdapter;

  constructor(model: ModelAdapter) {
    this.model = model;
  }

  async summarize(messages: Message[]): Promise<string> {
    if (messages.length < 5) return messages.map((m) => m.content).join("\n");

    const response = await this.model.complete([
      {
        role: "system",
        content: "Summarize the following conversation history concisely.",
      },
      {
        role: "user",
        content: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
      },
    ]);

    return response.message.content || "Summary failed";
  }
}

import { ModelAdapter, Message, TaskEnvelope } from "@itfs/types";
import { ToolRegistry } from "@itfs/l3-tooling";

export class ReasoningLoop {
  private model: ModelAdapter;
  private tools: ToolRegistry;

  constructor(model: ModelAdapter, tools: ToolRegistry) {
    this.model = model;
    this.tools = tools;
  }

  async run(task: TaskEnvelope, history: Message[] = []): Promise<Message> {
    const budget = task.budget;
    const currentHistory = [...history];
    let steps = 0;

    const systemPrompt: Message = {
      role: "system",
      content: `You are an ITFS agent. Your goal is: ${task.title}\nDescription: ${task.description}`,
    };

    while (steps < budget.max_retries + 1) {
      const response = await this.model.complete(
        [systemPrompt, ...currentHistory],
        this.tools.listTools(),
        budget,
      );

      const message = response.message;
      currentHistory.push(message);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return message;
      }

      for (const toolCall of message.tool_calls) {
        const result = await this.tools.execute(
          toolCall.tool_id,
          toolCall.input,
        );
        currentHistory.push({
          role: "tool",
          content: JSON.stringify(result.output || result.error),
          tool_result: result,
        } as Message);
      }

      steps++;
    }

    throw new Error("Reasoning budget exceeded");
  }
}

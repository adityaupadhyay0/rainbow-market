import { ModelAdapter, Message, TaskEnvelope, Telemetry } from "@itfs/types";
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
      Telemetry.log("reasoning_step_start", { steps, task_id: task.task_id });
      const response = await this.model.complete(
        [systemPrompt, ...currentHistory],
        this.tools.listTools(),
        budget,
      );

      const message = response.message;
      currentHistory.push(message);
      Telemetry.log("model_response", {
        content: message.content,
        tool_calls: message.tool_calls,
      });

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return message;
      }

      for (const toolCall of message.tool_calls) {
        Telemetry.log('tool_call_start', {
          tool_id: toolCall.tool_id,
          input: toolCall.input,
        });
        const result = await this.tools.execute(toolCall.tool_id, toolCall.input);
        if (toolCall.id) {
          result.tool_call_id = toolCall.id;
        }
        Telemetry.log('tool_call_end', {
          tool_id: toolCall.tool_id,
          success: result.success,
        });
        currentHistory.push({
          role: 'tool',
          content: JSON.stringify(result.output || result.error),
          tool_call_id: toolCall.id,
          tool_result: result,
        });
      }

      steps++;
    }

    throw new Error("Reasoning budget exceeded");
  }
}

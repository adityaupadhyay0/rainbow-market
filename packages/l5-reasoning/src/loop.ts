import { ModelAdapter, Message, TaskEnvelope, Telemetry } from "@itfs/types";
import { ToolRegistry } from "@itfs/l3-tooling";
import { VerifierSystem } from "./verifier";

export class ReasoningLoop {
  private model: ModelAdapter;
  private tools: ToolRegistry;

  constructor(model: ModelAdapter, tools: ToolRegistry) {
    this.model = model;
    this.tools = tools;
  }

  async runAdaptive(
    task: TaskEnvelope,
    history: Message[] = [],
  ): Promise<Message> {
    // 10x improvement: adaptive strategy selection
    if (task.description.length > 500) {
      console.log("Complexity high, using Reflexion");
      return this.run(
        { ...task, budget: { ...task.budget, strategy: "reflexion" } },
        history,
      );
    }
    return this.run(task, history);
  }

  async run(task: TaskEnvelope, history: Message[] = []): Promise<Message> {
    const budget = task.budget;

    if (budget.strategy === "tot" || budget.max_branches > 1) {
      return this.runParallel(task, history);
    }

    if (budget.strategy === "reflexion") {
      return this.runReflexion(task, history);
    }

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
      const verification = VerifierSystem.verify(message, budget.verifier);

      if (!verification.valid) {
        Telemetry.log("verification_failed", { reason: verification.reason });
        steps++;
        continue;
      }

      currentHistory.push(message);
      Telemetry.log("model_response", {
        content: message.content,
        tool_calls: message.tool_calls,
      });

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return message;
      }

      for (const toolCall of message.tool_calls) {
        Telemetry.log("tool_call_start", {
          tool_id: toolCall.tool_id,
          input: toolCall.input,
        });
        const result = await this.tools.execute(
          toolCall.tool_id,
          toolCall.input,
        );
        if (toolCall.id) {
          result.tool_call_id = toolCall.id;
        }
        Telemetry.log("tool_call_end", {
          tool_id: toolCall.tool_id,
          success: result.success,
        });
        currentHistory.push({
          role: "tool",
          content: JSON.stringify(result.output || result.error),
          tool_call_id: toolCall.id,
          tool_result: result,
        });
      }

      steps++;
    }

    throw new Error("Reasoning budget exceeded");
  }

  private async runParallel(
    task: TaskEnvelope,
    history: Message[],
  ): Promise<Message> {
    Telemetry.log("parallel_reasoning_start", {
      branches: task.budget.max_branches,
      task_id: task.task_id,
    });

    const branches = Array.from({ length: task.budget.max_branches }).map(() =>
      this.run(
        {
          ...task,
          budget: { ...task.budget, max_branches: 1, strategy: "cot" }, // Prevent recursion
        },
        history,
      ),
    );

    const results = await Promise.all(branches);

    // Simple selection: pick the one with most content or just the first for now
    const best = results.sort(
      (a, b) => (b.content?.length || 0) - (a.content?.length || 0),
    )[0];

    Telemetry.log("parallel_reasoning_end", { best_content: best.content });
    return best;
  }

  private async runReflexion(
    task: TaskEnvelope,
    history: Message[],
  ): Promise<Message> {
    let currentTask = task;
    let attempt = 0;
    let lastResult: Message = { role: "assistant", content: "" };

    while (attempt < task.budget.max_retries) {
      Telemetry.log("reflexion_attempt_start", {
        attempt,
        task_id: task.task_id,
      });

      // Generate
      lastResult = await this.run(
        {
          ...currentTask,
          budget: { ...task.budget, strategy: "cot" },
        },
        history,
      );

      // Critique
      const critiqueResponse = await this.model.complete([
        {
          role: "system",
          content:
            "You are a critical reviewer. Critique the following output and suggest improvements.",
        },
        { role: "user", content: lastResult.content || "" },
      ]);

      Telemetry.log("reflexion_critique", {
        critique: critiqueResponse.message.content,
      });

      // Update task for next iteration
      currentTask = {
        ...task,
        description: `${task.description}\n\nPrevious attempt critique: ${critiqueResponse.message.content}`,
      };

      attempt++;
    }

    return lastResult;
  }
}

import {
  ModelAdapter,
  ReasoningBudget,
  Message,
  ModelResponse,
  ReasoningTrace,
  ReasoningStep,
  VerifierResult
} from "@itfs/types";

export interface StrategyExecutor {
  execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }>;
}

export class BestOfNStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    const n = budget.max_branches ?? 1;
    const startTime = Date.now();

    const candidates = await Promise.all(
      Array.from({ length: n }).map(async (_, i) => {
        const branchStart = Date.now();
        const response = await model.complete(messages, [], budget);
        return { response, duration: Date.now() - branchStart, index: i };
      })
    );

    // In a real system, we'd use a PRM (Process Reward Model) or a Verifier here.
    // For the initial implementation, we'll pick the one with the highest "internal score"
    // or simply the first one if all are equal.
    const bestCandidate = candidates[0];

    const trace: ReasoningTrace = {
      task_id: `trace-${Math.random().toString(36).substring(7)}`,
      steps: candidates.map((c) => ({
        step_id: `branch-${c.index}`,
        thought: c.response.message.content,
        duration_ms: c.duration,
      })),
      strategy: budget.strategy,
      total_duration_ms: Date.now() - startTime,
      tokens_used: candidates.reduce((sum, c) => sum + c.response.usage.total_tokens, 0),
      success: true,
      final_output: bestCandidate.response.message.content
    };

    return { response: bestCandidate.response, trace };
  }
}

export class ReflexionStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    const startTime = Date.now();
    const steps: ReasoningStep[] = [];
    const currentMessages = [...messages];
    let lastResponse: ModelResponse | null = null;
    let tokensUsed = 0;
    const maxRetries = budget.max_retries ?? 3;

    for (let i = 0; i <= maxRetries; i++) {
      const stepStartTime = Date.now();
      const response = await model.complete(currentMessages, [], budget);
      lastResponse = response;
      tokensUsed += response.usage.total_tokens;

      // Mock verification - in production this calls L5 Verifier System
      const verification: VerifierResult = this.verify(response.message.content);

      steps.push({
        step_id: `refinement-${i}`,
        thought: response.message.content,
        verification,
        duration_ms: Date.now() - stepStartTime,
      });

      if (verification.valid) {
        break;
      }

      currentMessages.push(response.message);
      currentMessages.push({
        role: "user",
        content: `Your previous response failed verification. Feedback: ${verification.feedback}. Please correct it.`,
      });
    }

    if (!lastResponse) throw new Error("Reasoning failed to produce a response");

    const trace: ReasoningTrace = {
      task_id: `trace-${Math.random().toString(36).substring(7)}`,
      steps,
      strategy: budget.strategy,
      total_duration_ms: Date.now() - startTime,
      tokens_used: tokensUsed,
      success: steps[steps.length - 1].verification?.valid ?? false,
      final_output: lastResponse.message.content
    };

    return { response: lastResponse, trace };
  }

  private verify(content: string): VerifierResult {
    // Basic heuristic: check if it looks like a reasoned response
    const valid = content.length > 20;
    return {
      valid,
      score: valid ? 1 : 0,
      feedback: valid ? undefined : "Response too concise, needs more detail."
    };
  }
}

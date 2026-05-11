import {
  ModelAdapter,
  ReasoningBudget,
  Message,
  ModelResponse,
  ReasoningTrace,
  ReasoningStep,
  VerifierResult,
  ControllerState,
  ControllerAction,
} from "@itfs/types";
import { ToolRegistry } from "@itfs/l3-tooling";
import { AutoTTSController } from "./autotts.js";

export interface StrategyExecutor {
  execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    registry?: ToolRegistry,
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }>;
}

export class BestOfNStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    _registry?: ToolRegistry,
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    const n = budget.max_branches ?? 1;
    const startTime = Date.now();

    const candidates = await Promise.all(
      Array.from({ length: n }).map(async (_, i) => {
        const branchStart = Date.now();
        const response = await model.complete(messages, [], budget);
        return { response, duration: Date.now() - branchStart, index: i };
      }),
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
      tokens_used: candidates.reduce(
        (sum, c) => sum + c.response.usage.total_tokens,
        0,
      ),
      success: true,
      final_output: bestCandidate.response.message.content,
    };

    return { response: bestCandidate.response, trace };
  }
}

export class SStarStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    registry?: ToolRegistry,
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    const startTime = Date.now();
    const n = budget.max_branches ?? 1;
    const maxRetries = budget.max_retries ?? 2;

    // Stage 1: Generation & Iterative Debugging
    const branches = await Promise.all(
      Array.from({ length: n }).map(async (_, i) => {
        const branchMessages = [...messages];
        let lastResp: ModelResponse | null = null;
        const branchSteps: ReasoningStep[] = [];
        let branchTokens = 0;

        for (let r = 0; r <= maxRetries; r++) {
          const stepStart = Date.now();
          const resp = await model.complete(branchMessages, [], budget);
          lastResp = resp;
          branchTokens += resp.usage.total_tokens;

          const verif = await this.verifyWithExecution(resp.message.content, registry);
          branchSteps.push({
            step_id: `branch-${i}-round-${r}`,
            thought: resp.message.content,
            verification: verif,
            duration_ms: Date.now() - stepStart,
          });

          if (verif.valid) break;

          branchMessages.push(resp.message);
          branchMessages.push({
            role: "user",
            content: `Execution feedback: ${verif.feedback}. Please fix the code.`,
          });
        }
        return {
          response: lastResp!,
          steps: branchSteps,
          tokens: branchTokens,
        };
      }),
    );

    // Stage 2: Selection via Adaptive Input Generation
    const validBranches = branches.filter(
      (b) => b.steps[b.steps.length - 1].verification?.valid,
    );
    const candidates = validBranches.length > 0 ? validBranches : branches;

    let bestBranch = candidates[0];
    if (candidates.length > 1) {
      // Pairwise comparison with adaptive input generation
      for (let i = 1; i < candidates.length; i++) {
        const branchA = bestBranch;
        const branchB = candidates[i];

        const selectionPrompt: Message[] = [
          ...messages,
          {
            role: "user",
            content: `I have two candidate solutions. Please generate a simple Javascript test input that could produce different outputs for them.\n\nSolution A:\n${branchA.response.message.content}\n\nSolution B:\n${branchB.response.message.content}\n\nProvide only the test input code.`,
          },
        ];

        const inputGenResp = await model.complete(selectionPrompt, [], budget);
        const testInput =
          inputGenResp.message.content.match(
            /```(?:javascript|js)?\n([\s\S]*?)```/,
          )?.[1] ?? "";

        if (testInput) {
          const codeA = `${this.extractCode(branchA.response.message.content)}\n${testInput}`;
          const codeB = `${this.extractCode(branchB.response.message.content)}\n${testInput}`;

          const runA = registry
            ? await registry.call({
                tool_id: "local_code_execution",
                input: { code: codeA },
              })
            : { success: false };
          const runB = registry
            ? await registry.call({
                tool_id: "local_code_execution",
                input: { code: codeB },
              })
            : { success: false };

          if (runA.success && !runB.success) {
            bestBranch = branchA;
          } else if (runB.success && !runA.success) {
            bestBranch = branchB;
          } else if (runA.success && runB.success) {
            // If both succeed but produce different outputs, S* preference logic applies.
            // Here we prioritize the newer candidate if it produces a different (novel) output.
            if (JSON.stringify(runA.output) !== JSON.stringify(runB.output)) {
              bestBranch = branchB;
            }
          }
        }
      }
    }

    const trace: ReasoningTrace = {
      task_id: `sstar-${Math.random().toString(36).substring(7)}`,
      steps: branches.flatMap((b) => b.steps),
      strategy: budget.strategy,
      total_duration_ms: Date.now() - startTime,
      tokens_used: branches.reduce((s, b) => s + b.tokens, 0),
      success:
        bestBranch.steps[bestBranch.steps.length - 1].verification?.valid ??
        false,
      final_output: bestBranch.response.message.content,
    };

    return { response: bestBranch.response, trace };
  }

  private extractCode(content: string): string {
    return (
      content.match(/```(?:javascript|typescript|js)?\n([\s\S]*?)```/)?.[1] ??
      ""
    );
  }

  private async verifyWithExecution(
    content: string,
    registry?: ToolRegistry,
  ): Promise<VerifierResult> {
    const code = this.extractCode(content);
    if (!code) {
      return {
        valid: false,
        score: 0,
        feedback: "No code block found. Please wrap code in ```.",
      };
    }

    if (!registry) {
      return {
        valid: false,
        score: 0,
        feedback: "Tool registry not available for verification.",
      };
    }

    const result = await registry.call({
      tool_id: "local_code_execution",
      input: { code },
    });
    return {
      valid: result.success,
      score: result.success ? 1 : 0,
      feedback: result.success ? undefined : `Runtime error: ${result.error}`,
      metadata: { execution: result },
    };
  }
}

export class AutoTTSStrategy implements StrategyExecutor {
  constructor(private controller?: AutoTTSController) {}

  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    _registry?: ToolRegistry,
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    if (!this.controller) {
      throw new Error("AutoTTSStrategy requires a controller.");
    }

    const startTime = Date.now();
    const beta = 0.5; // Default beta if not provided in budget/metadata
    const maxBudget = budget.max_tokens;

    const state: ControllerState = {
      question: messages[messages.length - 1].content,
      maxBranches: budget.max_branches,
      activeBranches: [],
      depths: {},
      revealedProbes: [],
      remainingBudget: maxBudget,
      totalCost: 0,
    };

    const steps: ReasoningStep[] = [];
    const branchMessages: Record<number, Message[]> = {};
    let totalTokens = 0;
    let finalAnswer = "";

    while (state.totalCost < maxBudget) {
      const action = this.controller.selectAction(state, beta);
      const stepStartTime = Date.now();

      if (action.type === "ANSWER") {
        finalAnswer = this.controller.aggregate(state, beta);
        break;
      }

      if (action.type === "BRANCH") {
        const nextIdx = Object.keys(state.depths).length;
        if (nextIdx < state.maxBranches) {
          const resp = await model.complete(messages, [], budget);
          totalTokens += resp.usage.total_tokens;
          branchMessages[nextIdx] = [...messages, resp.message];
          state.activeBranches.push(nextIdx);
          state.depths[nextIdx] = 1;
          state.totalCost += 1;

          steps.push({
            step_id: `branch-${nextIdx}`,
            thought: resp.message.content,
            duration_ms: Date.now() - stepStartTime,
          });
        }
      } else if (action.type === "CONTINUE") {
        const idx = action.branchIndex!;
        const resp = await model.complete(branchMessages[idx], [], budget);
        totalTokens += resp.usage.total_tokens;
        branchMessages[idx].push(resp.message);
        state.depths[idx]++;
        state.totalCost += 1;

        steps.push({
          step_id: `continue-branch-${idx}-depth-${state.depths[idx]}`,
          thought: resp.message.content,
          duration_ms: Date.now() - stepStartTime,
        });
      } else if (action.type === "PROBE") {
        const idx = action.branchIndex!;
        const lastMsg = branchMessages[idx][branchMessages[idx].length - 1];
        state.revealedProbes.push({
          branchIndex: idx,
          depth: state.depths[idx],
          answer: lastMsg.content, // Simplified probing
        });
      } else if (action.type === "PRUNE") {
        const idx = action.branchIndex!;
        state.activeBranches = state.activeBranches.filter(i => i !== idx);
      }
    }

    const trace: ReasoningTrace = {
      task_id: `autotts-${Math.random().toString(36).substring(7)}`,
      steps,
      strategy: "autotts",
      total_duration_ms: Date.now() - startTime,
      tokens_used: totalTokens,
      success: true,
      final_output: finalAnswer,
    };

    return {
      response: {
        message: { role: "assistant", content: finalAnswer },
        usage: { prompt_tokens: 0, completion_tokens: totalTokens, total_tokens: totalTokens }
      },
      trace
    };
  }
}

export class ReflexionStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    _registry?: ToolRegistry,
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
      const verification: VerifierResult = this.verify(
        response.message.content,
      );

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

    if (!lastResponse)
      throw new Error("Reasoning failed to produce a response");

    const trace: ReasoningTrace = {
      task_id: `trace-${Math.random().toString(36).substring(7)}`,
      steps,
      strategy: budget.strategy,
      total_duration_ms: Date.now() - startTime,
      tokens_used: tokensUsed,
      success: steps[steps.length - 1].verification?.valid ?? false,
      final_output: lastResponse.message.content,
    };

    return { response: lastResponse, trace };
  }

  private verify(content: string): VerifierResult {
    // Basic heuristic: check if it looks like a reasoned response
    const valid = content.length > 20;
    return {
      valid,
      score: valid ? 1 : 0,
      feedback: valid ? undefined : "Response too concise, needs more detail.",
    };
  }
}

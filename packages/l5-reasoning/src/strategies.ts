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
  Retriever,
  ToTValue,
  ToTEvaluation,
} from "@itfs/types";
import { ToolRegistry } from "@itfs/l3-tooling";
import { AutoTTSController } from "./autotts.js";

export interface StrategyExecutor {
  execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    registry?: ToolRegistry,
    retriever?: Retriever,
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }>;
}

export class ToTStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    _registry?: ToolRegistry,
    _retriever?: Retriever,
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    const startTime = Date.now();
    const maxBranches = budget.max_branches ?? 3;
    const maxDepth = budget.max_depth ?? 3;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // BFS Queue: each item is a path of messages
    let queue: Message[][] = [[...messages]];
    let finalTraceSteps: ReasoningStep[] = [];
    let bestFinalPath: Message[] | null = null;

    for (let depth = 0; depth < maxDepth; depth++) {
      const nextQueue: Message[][] = [];

      for (const path of queue) {
        const stepStartTime = Date.now();
        // 1. Expand: Generate candidates
        const expansionPromises = Array.from({ length: maxBranches }).map(() =>
          model.complete(path, [], budget),
        );
        const candidates = await Promise.all(expansionPromises);
        for (const c of candidates) {
          totalPromptTokens += c.usage.prompt_tokens;
          totalCompletionTokens += c.usage.completion_tokens;
        }

        // 2. Evaluate: Score each candidate
        const evaluations = await Promise.all(
          candidates.map((c) => this.evaluate(model, path, c.message, budget)),
        );
        for (const e of evaluations) {
          totalPromptTokens += e.usage.prompt_tokens;
          totalCompletionTokens += e.usage.completion_tokens;
        }

        const durationPerStep = Math.floor(
          (Date.now() - stepStartTime) / (candidates.length || 1),
        );

        // 3. Prune & Enqueue
        for (let i = 0; i < candidates.length; i++) {
          const evalResult = this.parseEvaluation(
            evaluations[i].message.content,
          );
          const candidateMessage = candidates[i].message;

          finalTraceSteps.push({
            step_id: `tot-d${depth}-b${i}-${Math.random().toString(36).substring(7)}`,
            thought: candidateMessage.content,
            verification: {
              valid: evalResult.value !== ToTValue.IMPOSSIBLE,
              score:
                evalResult.value === ToTValue.SURE
                  ? 1
                  : evalResult.value === ToTValue.LIKELY
                    ? 0.5
                    : 0,
              feedback: evalResult.explanation,
            },
            duration_ms: durationPerStep,
          });

          if (evalResult.value === ToTValue.SURE && !bestFinalPath) {
            // Early termination if we find a SURE answer
            bestFinalPath = [...path, candidateMessage];
          }

          if (evalResult.value === ToTValue.LIKELY) {
            nextQueue.push([...path, candidateMessage]);
          }
        }

        if (bestFinalPath) break;
      }

      if (bestFinalPath || nextQueue.length === 0) break;
      queue = nextQueue.slice(0, maxBranches); // Keep top branches for next depth
    }

    const finalPath = bestFinalPath || queue[0] || messages;
    const lastMessage = finalPath[finalPath.length - 1];

    const trace: ReasoningTrace = {
      task_id: `tot-${Math.random().toString(36).substring(7)}`,
      steps: finalTraceSteps,
      strategy: "tot",
      total_duration_ms: Date.now() - startTime,
      tokens_used: totalPromptTokens + totalCompletionTokens,
      success: !!bestFinalPath,
      final_output: lastMessage.content,
    };

    return {
      response: {
        message: { role: "assistant", content: lastMessage.content },
        usage: {
          prompt_tokens: totalPromptTokens,
          completion_tokens: totalCompletionTokens,
          total_tokens: totalPromptTokens + totalCompletionTokens,
        },
      },
      trace,
    };
  }

  private async evaluate(
    model: ModelAdapter,
    path: Message[],
    candidate: Message,
    budget: ReasoningBudget,
  ): Promise<ModelResponse> {
    const evaluationPrompt: Message = {
      role: "user",
      content: `Evaluate the following thought as a step toward solving the problem.
Answer with:
VALUE: [SURE | LIKELY | IMPOSSIBLE]
EXPLANATION: [Brief explanation]

Thought:
${candidate.content}`,
    };

    return model.complete([...path, evaluationPrompt], [], budget);
  }

  private parseEvaluation(content: string): ToTEvaluation {
    const valueMatch = content.match(/VALUE:\s*(SURE|LIKELY|IMPOSSIBLE)/i);
    const explanationMatch = content.match(/EXPLANATION:\s*(.*)/i);

    const valueStr = valueMatch?.[1].toUpperCase() || "IMPOSSIBLE";
    const value =
      ToTValue[valueStr as keyof typeof ToTValue] || ToTValue.IMPOSSIBLE;

    return {
      value,
      explanation: explanationMatch?.[1] || "No explanation provided.",
    };
  }
}

export class BestOfNStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    _registry?: ToolRegistry,
    _retriever?: Retriever,
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

export class RATStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    _registry?: ToolRegistry,
    retriever?: Retriever,
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    const startTime = Date.now();
    const steps: ReasoningStep[] = [];
    const maxDepth = budget.max_depth ?? 3;
    let promptTokens = 0;
    let completionTokens = 0;
    const currentMessages = [...messages];
    let finalOutput = "";

    for (let d = 0; d < maxDepth; d++) {
      const stepStart = Date.now();

      // 1. Generate Draft Thought
      const draftInstruction: Message = {
        role: "user",
        content: `Continue your reasoning. If you need more information, provide a search query in the format [QUERY: your query].`,
      };

      const draftResp = await model.complete(
        [...currentMessages, draftInstruction],
        [],
        budget,
      );
      promptTokens += draftResp.usage.prompt_tokens;
      completionTokens += draftResp.usage.completion_tokens;
      const draftThought = draftResp.message.content;

      // 2. Identify Query via Regex
      const queryMatch = draftThought.match(/\[QUERY:\s*(.*?)\]/i);
      const query = queryMatch ? queryMatch[1] : draftThought;

      // 3. Retrieve
      let context = "";
      let confidence = "incorrect";
      if (retriever) {
        const retrievalResult = await retriever.retrieve(query);
        context = retrievalResult.documents
          .map((doc) => doc.content)
          .join("\n\n");
        confidence = retrievalResult.confidence;
      }

      // 4. Refine Thought
      const confidenceGuide =
        confidence === "correct"
          ? "The retrieved context is highly relevant and should be trusted."
          : confidence === "ambiguous"
            ? "The retrieved context may be relevant; use it with caution."
            : "The retrieved context was low-confidence or irrelevant.";

      const refinementPrompt: Message = {
        role: "user",
        content: `Based on the following retrieved context (Confidence: ${confidence.toUpperCase()}), please refine and verify your previous thought. ${confidenceGuide} If the context contradicts your thought, correct it.

Context:
${context || "No relevant context found."}

Previous Thought:
${draftThought}

Refined Thought:`,
      };

      const refinedResp = await model.complete(
        [...currentMessages, draftResp.message, refinementPrompt],
        [],
        budget,
      );
      promptTokens += refinedResp.usage.prompt_tokens;
      completionTokens += refinedResp.usage.completion_tokens;
      const refinedThought = refinedResp.message.content;

      steps.push({
        step_id: `rat-step-${d}`,
        thought: refinedThought,
        duration_ms: Date.now() - stepStart,
      });

      currentMessages.push({ role: "assistant", content: refinedThought });
      finalOutput = refinedThought;

      // Robust termination check
      const normalizedThought = refinedThought.toUpperCase();
      if (
        normalizedThought.includes("FINAL ANSWER:") ||
        normalizedThought.includes("CONCLUSION:") ||
        normalizedThought.includes("### FINAL ANSWER")
      ) {
        break;
      }
    }

    const trace: ReasoningTrace = {
      task_id: `rat-${Math.random().toString(36).substring(7)}`,
      steps,
      strategy: "rat",
      total_duration_ms: Date.now() - startTime,
      tokens_used: promptTokens + completionTokens,
      success: true,
      final_output: finalOutput,
    };

    return {
      response: {
        message: { role: "assistant", content: finalOutput },
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      },
      trace,
    };
  }
}

export class SStarStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    registry?: ToolRegistry,
    _retriever?: Retriever,
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
    _retriever?: Retriever,
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
    _retriever?: Retriever,
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

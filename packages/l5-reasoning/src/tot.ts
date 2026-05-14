import {
  ModelAdapter,
  ReasoningBudget,
  Message,
  ModelResponse,
  ReasoningTrace,
  ReasoningStep,
  ToTValue,
  ToTEvaluation,
} from "@itfs/types";
import { ToolRegistry } from "@itfs/l3-tooling";
import { StrategyExecutor } from "./strategies.js";

interface ToTNode {
  messages: Message[];
  thought: string;
  evaluation?: ToTEvaluation;
  depth: number;
}

export class ToTStrategy implements StrategyExecutor {
  async execute(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
    _registry?: ToolRegistry,
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    const startTime = Date.now();
    const maxDepth = budget.max_depth ?? 3;
    const branchingFactor = budget.max_branches ?? 3;
    let tokensUsed = 0;
    const steps: ReasoningStep[] = [];

    let currentLevel: ToTNode[] = [
      {
        messages: [...messages],
        thought: "",
        depth: 0,
      },
    ];

    let finalAnswerNode: ToTNode | null = null;

    for (let depth = 1; depth <= maxDepth; depth++) {
      const nextLevel: ToTNode[] = [];

      for (const parent of currentLevel) {
        // 1. Generate Candidates
        const candidates = await this.generateCandidates(
          model,
          parent,
          branchingFactor,
          budget,
        );
        tokensUsed += candidates.reduce(
          (sum, c) => sum + (c?.usage?.total_tokens ?? 0),
          0,
        );

        const nodes: ToTNode[] = candidates.map((c) => ({
          messages: [...parent.messages, c.message],
          thought: c.message.content,
          depth,
        }));

        // 2. Evaluate Candidates
        for (const node of nodes) {
          const evalResp = await this.evaluateNode(model, node, budget);
          tokensUsed += evalResp?.usage?.total_tokens ?? 0;
          node.evaluation = this.parseEvaluation(evalResp?.message?.content ?? "");

          steps.push({
            step_id: `tot-d${depth}-node-${Math.random().toString(36).substring(7)}`,
            thought: node.thought,
            verification: {
              valid: node.evaluation.value !== "impossible",
              score: node.evaluation.value === "sure" ? 1 : node.evaluation.value === "likely" ? 0.5 : 0,
              feedback: node.evaluation.explanation,
            },
            duration_ms: 0, // Simplified
          });
        }

        // 3. Filter and Add to Next Level
        const validNodes = nodes.filter(
          (n) => n.evaluation?.value !== "impossible",
        );
        nextLevel.push(...validNodes);
      }

      // Sort and Prune Next Level to maintain branching factor
      nextLevel.sort((a, b) => {
        const scoreA = a.evaluation?.value === "sure" ? 2 : 1;
        const scoreB = b.evaluation?.value === "sure" ? 2 : 1;
        return scoreB - scoreA;
      });

      currentLevel = nextLevel.slice(0, branchingFactor);

      if (currentLevel.length === 0) break;

      // Check if any node is a final answer
      const sureNode = currentLevel.find((n) => n.evaluation?.value === "sure");
      if (sureNode && depth >= maxDepth / 2) { // Heuristic: only accept "sure" as final if we've made some progress
         finalAnswerNode = sureNode;
         break;
      }
    }

    // If we didn't find a "sure" node, pick the best from the last level
    if (!finalAnswerNode && currentLevel.length > 0) {
      finalAnswerNode = currentLevel[0];
    }

    const finalOutput = finalAnswerNode?.thought ?? "Failed to find a solution.";

    const trace: ReasoningTrace = {
      task_id: `tot-${Math.random().toString(36).substring(7)}`,
      steps,
      strategy: "tot",
      total_duration_ms: Date.now() - startTime,
      tokens_used: tokensUsed,
      success: !!finalAnswerNode,
      final_output: finalOutput,
    };

    return {
      response: {
        message: { role: "assistant", content: finalOutput },
        usage: {
          prompt_tokens: 0, // Aggregate if needed
          completion_tokens: tokensUsed,
          total_tokens: tokensUsed,
        },
      },
      trace,
    };
  }

  private async generateCandidates(
    model: ModelAdapter,
    parent: ToTNode,
    k: number,
    budget: ReasoningBudget,
  ): Promise<ModelResponse[]> {
    // Generate k candidates in parallel
    return Promise.all(
      Array.from({ length: k }).map(() =>
        model.complete(
          [
            ...parent.messages,
            {
              role: "user",
              content: "Generate the next possible step in the reasoning process. Be concise.",
            },
          ],
          [],
          budget,
        ),
      ),
    );
  }

  private async evaluateNode(
    model: ModelAdapter,
    node: ToTNode,
    budget: ReasoningBudget,
  ): Promise<ModelResponse> {
    const evaluationPrompt: Message[] = [
      ...node.messages,
      {
        role: "user",
        content: `Evaluate the progress of the current reasoning step.
Answer with one of: "SURE" (the step is correct and leads to a solution), "LIKELY" (the step is promising but needs more work), or "IMPOSSIBLE" (the step is wrong or leads to a dead end).
Provide a brief explanation after the label.

Evaluation:`,
      },
    ];
    return model.complete(evaluationPrompt, [], budget);
  }

  private parseEvaluation(content: string): ToTEvaluation {
    const normalized = content.toUpperCase();
    let value: ToTValue = "impossible";
    if (normalized.includes("SURE")) value = "sure";
    else if (normalized.includes("LIKELY")) value = "likely";

    return {
      value,
      explanation: content,
    };
  }
}

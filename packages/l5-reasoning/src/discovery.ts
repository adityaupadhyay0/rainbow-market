import {
  ModelAdapter,
  OfflineReplayData,
  ReasoningBudget,
  Message,
} from "@itfs/types";
import { AutoTTSController, OfflineReplayEnvironment } from "./autotts.js";

export interface DiscoveryRound {
  round: number;
  controllerCode: string;
  results: {
    beta: number;
    accuracy: number;
    cost: number;
  }[];
  analysis: string;
}

export class DiscoveryEngine {
  private history: DiscoveryRound[] = [];

  constructor(
    private model: ModelAdapter,
    private searchData: OfflineReplayData[],
    private budget: ReasoningBudget,
  ) {}

  async runDiscovery(rounds: number = 5): Promise<string> {
    for (let r = 1; r <= rounds; r++) {
      const proposal = await this.proposeController(r);
      const controller = await this.instantiateController(
        proposal.controllerCode,
      );

      const results = this.evaluateController(controller);
      this.history.push({
        round: r,
        controllerCode: proposal.controllerCode,
        results,
        analysis: proposal.analysis,
      });

      console.log(`Round ${r} complete. Best Accuracy: ${Math.max(...results.map(res => res.accuracy))}`);
    }

    return this.history.sort((a, b) =>
        Math.max(...b.results.map(r => r.accuracy)) - Math.max(...a.results.map(r => r.accuracy))
    )[0].controllerCode;
  }

  private async proposeController(
    round: number,
  ): Promise<{ controllerCode: string; analysis: string }> {
    const prompt: Message[] = [
      {
        role: "system",
        content: `You are an expert at designing Test-Time Scaling (TTS) strategies for LLMs.
Your goal is to write a Javascript class that implements the AutoTTSController interface.

Interface:
export abstract class AutoTTSController {
  abstract selectAction(state: ControllerState, beta: number): ControllerAction;
  abstract aggregate(state: ControllerState, beta: number): string;
}

Actions: BRANCH, CONTINUE(branchIndex), PROBE(branchIndex), PRUNE(branchIndex), ANSWER.
State provides: activeBranches, depths, revealedProbes, remainingBudget.

Use BetaParameterizer (available globally as BetaParameterizer) to map the single 'beta' parameter (0.0 to 1.0) to your internal thresholds. Larger beta MUST mean more compute/higher accuracy.

Example:
class MyController extends AutoTTSController {
  selectAction(state, beta) {
    const maxB = BetaParameterizer.mapToInteger(beta, 1, 10);
    if (state.activeBranches.length < maxB && state.remainingBudget > 0) {
      return { type: "BRANCH" };
    }
    // Simple logic: continue first active branch until depth 5
    const idx = state.activeBranches[0];
    if (idx !== undefined && state.depths[idx] < 5) {
       return { type: "CONTINUE", branchIndex: idx };
    }
    return { type: "ANSWER" };
  }
  aggregate(state, beta) {
    // Majority vote or just last probe
    const answers = state.revealedProbes.map(p => p.answer);
    return answers[answers.length - 1] || "";
  }
}
`,
      },
      {
        role: "user",
        content: `This is round ${round} of discovery.
History of previous attempts:
${JSON.stringify(this.history, null, 2)}

Propose a more sophisticated controller that uses pruning and probing to optimize the accuracy-cost tradeoff.
Return your proposal as:
ANALYSIS: <your analysis of previous rounds>
CODE:
\`\`\`javascript
<your class implementation>
\`\`\`
`,
      },
    ];

    const response = await this.model.complete(prompt, [], this.budget);
    const content = response.message.content;
    const analysis = content.split("CODE:")[0].replace("ANALYSIS:", "").trim();
    const codeMatch = content.match(/```javascript\n([\s\S]*?)```/);
    const controllerCode = codeMatch ? codeMatch[1] : "";

    return { controllerCode, analysis };
  }

  private async instantiateController(
    code: string,
  ): Promise<AutoTTSController> {
    const { BetaParameterizer } = await import("./autotts.js");

    const classNameMatch = code.match(/class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : "";

    const func = new Function(
      "AutoTTSController",
      "BetaParameterizer",
      `${code}\nreturn new ${className}();`,
    );

    return func(AutoTTSController, BetaParameterizer) as AutoTTSController;
  }

  private evaluateController(
    controller: AutoTTSController,
  ): { beta: number; accuracy: number; cost: number }[] {
    const betas = [0.1, 0.3, 0.5, 0.7, 0.9];
    return betas.map((beta) => {
      let totalAcc = 0;
      let totalCost = 0;

      for (const data of this.searchData) {
        const env = new OfflineReplayEnvironment(data, 100); // 100 as default max budget
        const result = env.evaluate(controller, beta);
        totalAcc += result.accuracy;
        totalCost += result.cost;
      }

      return {
        beta,
        accuracy: totalAcc / this.searchData.length,
        cost: totalCost / this.searchData.length,
      };
    });
  }
}

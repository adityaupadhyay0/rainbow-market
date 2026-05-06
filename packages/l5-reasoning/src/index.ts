import {
  ModelAdapter,
  ReasoningBudget,
  Message,
  ModelResponse,
  ReasoningTrace
} from "@itfs/types";
import { BestOfNStrategy, ReflexionStrategy, StrategyExecutor } from "./strategies.js";

export class ReasoningEngine {
  private strategies: Map<string, StrategyExecutor>;

  constructor() {
    this.strategies = new Map();
    this.strategies.set("tot", new BestOfNStrategy());
    this.strategies.set("reflexion", new ReflexionStrategy());
    // Default to sequential CoT via Reflexion with 1 retry if not specified
    this.strategies.set("cot", new ReflexionStrategy());
  }

  async solve(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    const strategy = this.strategies.get(budget.strategy);

    if (!strategy) {
      throw new Error(`Unsupported reasoning strategy: ${budget.strategy}`);
    }

    return strategy.execute(model, messages, budget);
  }
}

export const name = "l5-reasoning";

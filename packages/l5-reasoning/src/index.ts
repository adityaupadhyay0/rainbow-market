import {
  ModelAdapter,
  ReasoningBudget,
  Message,
  ModelResponse,
  ReasoningTrace,
  Retriever,
} from "@itfs/types";
import { ToolRegistry } from "@itfs/l3-tooling";
import {
  AutoTTSStrategy,
  BestOfNStrategy,
  RATStrategy,
  ReflexionStrategy,
  SStarStrategy,
  StrategyExecutor,
} from "./strategies.js";
import { AutoTTSController } from "./autotts.js";

export class ReasoningEngine {
  private strategies: Map<string, StrategyExecutor>;

  constructor(
    private registry?: ToolRegistry,
    controller?: AutoTTSController,
    private retriever?: Retriever,
  ) {
    this.strategies = new Map();
    this.strategies.set("tot", new BestOfNStrategy());
    this.strategies.set("rat", new RATStrategy());
    this.strategies.set("reflexion", new ReflexionStrategy());
    // Default to sequential CoT via Reflexion with 1 retry if not specified
    this.strategies.set("cot", new ReflexionStrategy());
    this.strategies.set("sstar", new SStarStrategy());
    this.strategies.set("autotts", new AutoTTSStrategy(controller));
  }

  setController(controller: AutoTTSController) {
    this.strategies.set("autotts", new AutoTTSStrategy(controller));
  }

  async solve(
    model: ModelAdapter,
    messages: Message[],
    budget: ReasoningBudget,
  ): Promise<{ response: ModelResponse; trace: ReasoningTrace }> {
    const strategy = this.strategies.get(budget.strategy);

    if (!strategy) {
      throw new Error(`Unsupported reasoning strategy: ${budget.strategy}`);
    }

    return strategy.execute(
      model,
      messages,
      budget,
      this.registry,
      this.retriever,
    );
  }
}

export const name = "l5-reasoning";

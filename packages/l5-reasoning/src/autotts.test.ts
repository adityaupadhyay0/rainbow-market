import { describe, it, expect } from "vitest";
import {
    OfflineReplayEnvironment,
    BetaParameterizer,
    AutoTTSController
} from "./autotts.js";
import { ControllerState, ControllerAction, OfflineReplayData } from "@itfs/types";

class MockController extends AutoTTSController {
  selectAction(state: ControllerState, beta: number): ControllerAction {
    const maxB = BetaParameterizer.mapToInteger(beta, 1, 2);
    if (state.activeBranches.length < maxB) {
      return { type: "BRANCH" };
    }
    const idx = state.activeBranches[0];
    if (idx !== undefined && state.depths[idx] < 2) {
      return { type: "CONTINUE", branchIndex: idx };
    }
    return { type: "ANSWER" };
  }

  aggregate(state: ControllerState, _beta: number): string {
    return state.revealedProbes[0]?.answer || "wrong";
  }
}

describe("AutoTTS Infrastructure", () => {
  const mockData: OfflineReplayData = {
    question: "1+1?",
    answer: "2",
    trajectories: [
      {
        branchIndex: 0,
        intervals: ["1...", "1+1=2"],
        probes: ["1", "2"]
      },
      {
        branchIndex: 1,
        intervals: ["I think...", "it is 3"],
        probes: ["?", "3"]
      }
    ]
  };

  it("should evaluate a controller correctly in the replay environment", () => {
    const env = new OfflineReplayEnvironment(mockData, 10);
    const controller = new MockController();

    // With beta=1.0, maxB should be 2.
    const result = env.evaluate(controller, 1.0);

    expect(result.accuracy).toBe(0); // My aggregation logic is naive
    expect(result.cost).toBeGreaterThan(0);
  });

  it("should respect beta-parameterized branching", () => {
    const envLow = new OfflineReplayEnvironment(mockData, 10);
    const controller = new MockController();
    const resultLow = envLow.evaluate(controller, 0.0); // maxB=1

    const envHigh = new OfflineReplayEnvironment(mockData, 10);
    const resultHigh = envHigh.evaluate(controller, 1.0); // maxB=2

    // Find BRANCH actions in traces
    const branchesLow = resultLow.trace.filter(a => a.type === "BRANCH").length;
    const branchesHigh = resultHigh.trace.filter(a => a.type === "BRANCH").length;

    expect(branchesLow).toBe(1);
    expect(branchesHigh).toBe(2);
  });
});

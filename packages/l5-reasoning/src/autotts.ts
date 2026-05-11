import {
  ControllerAction,
  ControllerState,
  OfflineReplayData,
  ProbeSignal,
  ReasoningTrajectory,
} from "@itfs/types";

export abstract class AutoTTSController {
  abstract selectAction(state: ControllerState, beta: number): ControllerAction;
  abstract aggregate(state: ControllerState, beta: number): string;
}

/**
 * BetaParameterizer ensures that all hyperparameters are derived monotonically from a single beta.
 */
export class BetaParameterizer {
  static mapToRange(
    beta: number,
    min: number,
    max: number,
    monotone: "increasing" | "decreasing" = "increasing",
  ): number {
    const val = monotone === "increasing" ? beta : 1 - beta;
    return min + val * (max - min);
  }

  static mapToInteger(
    beta: number,
    min: number,
    max: number,
    monotone: "increasing" | "decreasing" = "increasing",
  ): number {
    return Math.round(this.mapToRange(beta, min, max, monotone));
  }
}

export class OfflineReplayEnvironment {
  private state: ControllerState;
  private data: OfflineReplayData;
  private maxBudget: number;

  constructor(data: OfflineReplayData, maxBudget: number) {
    this.data = data;
    this.maxBudget = maxBudget;
    this.state = {
      question: data.question,
      maxBranches: data.trajectories.length,
      activeBranches: [],
      depths: {},
      revealedProbes: [],
      remainingBudget: maxBudget,
      totalCost: 0,
    };
  }

  getState(): ControllerState {
    return { ...this.state };
  }

  step(action: ControllerAction): boolean {
    const cost = this.getActionCost(action);
    if (this.state.totalCost + cost > this.maxBudget) {
      return false; // Budget exceeded
    }

    switch (action.type) {
      case "BRANCH": {
        const nextIndex = Object.keys(this.state.depths).length;
        if (nextIndex >= this.data.trajectories.length) return false;
        this.state.activeBranches.push(nextIndex);
        this.state.depths[nextIndex] = 1;
        this.state.totalCost += 1;
        break;
      }
      case "CONTINUE": {
        const idx = action.branchIndex!;
        if (!this.state.activeBranches.includes(idx)) return false;
        const traj = this.data.trajectories[idx];
        if (this.state.depths[idx] >= traj.intervals.length) {
           // Branch finished, but we still charge for attempting or it just stops
           return false;
        }
        this.state.depths[idx]++;
        this.state.totalCost += 1;
        break;
      }
      case "PROBE": {
        const idx = action.branchIndex!;
        if (!this.state.activeBranches.includes(idx)) return false;
        const depth = this.state.depths[idx];
        const traj = this.data.trajectories[idx];
        const answer = traj.probes[depth - 1];

        // Check if already probed
        const alreadyProbed = this.state.revealedProbes.some(
          p => p.branchIndex === idx && p.depth === depth
        );
        if (!alreadyProbed) {
          this.state.revealedProbes.push({
            branchIndex: idx,
            depth,
            answer
          });
        }
        // Paper says kappa_probe >= 0. For now 0.
        break;
      }
      case "PRUNE": {
        const idx = action.branchIndex!;
        this.state.activeBranches = this.state.activeBranches.filter(i => i !== idx);
        break;
      }
      case "ANSWER":
        return true;
    }

    this.state.remainingBudget = this.maxBudget - this.state.totalCost;
    return true;
  }

  private getActionCost(action: ControllerAction): number {
    switch (action.type) {
      case "BRANCH": return 1;
      case "CONTINUE": return 1;
      case "PROBE": return 0; // Default kappa_probe=0
      default: return 0;
    }
  }

  evaluate(
    controller: AutoTTSController,
    beta: number,
  ): { accuracy: number; cost: number; trace: ControllerAction[] } {
    const trace: ControllerAction[] = [];
    while (true) {
      const action = controller.selectAction(this.state, beta);
      trace.push(action);
      const success = this.step(action);
      if (!success || action.type === "ANSWER") break;
    }

    const finalAnswer = controller.aggregate(this.state, beta);
    const accuracy = finalAnswer === this.data.answer ? 1 : 0;

    return {
      accuracy,
      cost: this.state.totalCost,
      trace,
    };
  }
}

/**
 * Utility to convert ReasoningTrace (from live runs) into OfflineReplayData.
 */
export class TrajectoryCollector {
  static fromTrace(
    trace: import("@itfs/types").ReasoningTrace,
    question: string,
    groundTruth: string,
  ): OfflineReplayData {
    // Group steps by branch
    const trajectoriesMap: Record<number, ReasoningTrajectory> = {};

    trace.steps.forEach((step) => {
      const branchMatch = step.step_id.match(/branch-(\d+)/);
      if (branchMatch) {
        const idx = parseInt(branchMatch[1]);
        if (!trajectoriesMap[idx]) {
          trajectoriesMap[idx] = {
            branchIndex: idx,
            intervals: [],
            probes: [],
          };
        }
        trajectoriesMap[idx].intervals.push(step.thought);
        trajectoriesMap[idx].probes.push(step.thought); // In basic mode, probe is just the thought
      }
    });

    return {
      question,
      answer: groundTruth,
      trajectories: Object.values(trajectoriesMap),
    };
  }
}

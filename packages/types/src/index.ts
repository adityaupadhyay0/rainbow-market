export type SemVer = string;
export type TaskId = string;
export type SkillId = string;
export type ToolId = string;

export type DomainTag =
  | "coding:ai"
  | "coding:mobile"
  | "coding:web"
  | "coding:general"
  | "web:scraping"
  | "web:automation"
  | "workflow"
  | "general";

export type ReasoningStrategy =
  | "cot"
  | "tot"
  | "rat"
  | "reflexion"
  | "metacognitive";
export type BudgetExceededPolicy = "escalate" | "return_best" | "fail";
export type VerifierType =
  | "execution"
  | "syntax"
  | "self_consistency"
  | "process_reward"
  | "human_in_loop"
  | "null";

export interface ReasoningBudget {
  strategy: ReasoningStrategy;
  max_tokens: number;
  max_branches: number;
  max_depth: number;
  max_retries: number;
  verifier: VerifierType;
  on_budget_exceeded: BudgetExceededPolicy;
}

export interface TaskEnvelope {
  task_id: TaskId;
  domain: DomainTag;
  title: string;
  description: string;
  inputs?: Record<string, unknown>;
  budget: ReasoningBudget;
  privacy_mode: "local_only" | "hybrid" | "cloud_allowed";
}

export interface ToolCall {
  id?: string;
  tool_id: ToolId;
  input: unknown;
  timeout_ms?: number;
  sandbox?: string;
}

export interface ToolResult {
  tool_call_id?: string;
  success: boolean;
  output: unknown;
  error?: string;
  duration_ms: number;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  tool_result?: ToolResult;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ModelResponse {
  message: Message;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ModelDelta {
  content?: string;
  tool_calls?: ToolCall[];
}

export interface ModelAdapter {
  complete(
    messages: Message[],
    tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): Promise<ModelResponse>;
  stream(
    messages: Message[],
    tools?: ToolSpec[],
    budget?: ReasoningBudget,
  ): AsyncIterable<ModelDelta>;
  estimateTokens(messages: Message[]): Promise<number>;
  healthCheck(): Promise<boolean>;
}
export const name = "types";

export interface Trace {
  timestamp: number;
  event: string;
  data: unknown;
}

export class Telemetry {
  private static traces: Trace[] = [];

  static log(event: string, data: unknown) {
    this.traces.push({
      timestamp: Date.now(),
      event,
      data,
    });
    console.log(`[TRACE] ${event}`, data);
  }

  static getTraces() {
    return this.traces;
  }
}

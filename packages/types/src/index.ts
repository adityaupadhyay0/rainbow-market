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
  | "sstar"
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

export interface SubTask {
  subtask_id: string;
  title: string;
  description: string;
  dependencies: string[];
  status: "pending" | "running" | "completed" | "failed";
  output?: unknown;
}

export interface TaskGraph {
  task_id: TaskId;
  subtasks: SubTask[];
}

export interface OrchestrationResult {
  task_id: TaskId;
  success: boolean;
  subtask_traces: Record<string, ReasoningTrace>;
  output: unknown;
  error?: string;
}

export interface ToolCall {
  tool_id: ToolId;
  input: unknown;
  timeout_ms?: number;
  sandbox?: string;
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  error?: string;
  duration_ms: number;
}

export interface VerifierResult {
  valid: boolean;
  score: number;
  feedback?: string;
  metadata?: Record<string, unknown>;
}

export interface ReasoningStep {
  step_id: string;
  thought: string;
  action?: ToolCall;
  observation?: ToolResult;
  verification?: VerifierResult;
  duration_ms: number;
}

export interface ReasoningTrace {
  task_id: TaskId;
  steps: ReasoningStep[];
  strategy: ReasoningStrategy;
  total_duration_ms: number;
  tokens_used: number;
  success: boolean;
  final_output?: string;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
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
  embed(text: string | string[]): Promise<number[][]>;
  estimateTokens(messages: Message[]): Promise<number>;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorStore {
  add(documents: VectorDocument[]): Promise<void>;
  search(
    query_embedding: number[],
    limit: number,
  ): Promise<(VectorDocument & { similarity: number })[]>;
  delete(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface RetrievalResult {
  documents: (VectorDocument & { similarity: number })[];
  confidence: "correct" | "ambiguous" | "incorrect";
}

export interface Retriever {
  retrieve(query: string, limit?: number): Promise<RetrievalResult>;
}

export const name = "types";

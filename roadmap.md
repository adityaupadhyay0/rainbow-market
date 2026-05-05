# ITFS — Developer Roadmap

### Inference-Time First Stack · v1.0 · May 2026

> **How to use this document**
>
> Every task below is self-contained. You do not need the SRS to start. Each task tells you what to build, what the acceptance criteria are, what interfaces to expose, and what not to do. Work top-to-bottom inside each phase. Do not start the next phase until the current one is green.

---

## Stack at a glance

```
L7  Hybrid Intelligence Layer   — routes local vs cloud
L6  Orchestration Layer         — plans, dispatches, retries
L5  Reasoning Layer             — controls how the model thinks
L4  Skill Layer                 — reusable capability bundles
L3  Tooling Layer               — deterministic atomic actions
L2  Knowledge Layer             — retrieval, memory, context
L1  Model Layer                 — stateless inference endpoint
```

Each layer only talks to its immediate neighbours through typed contracts. No layer imports internals from another. That is the architecture rule.

---

## Phase 0 — Repo Skeleton & Shared Types

> **Goal:** One repo. Shared types. CI green. No business logic yet.

---

### TASK-000 · Monorepo scaffold

**What to build**

```
itfs/
  packages/
    types/            ← shared TypeScript interfaces (imported by every package)
    l1-model/
    l2-knowledge/
    l3-tooling/
    l4-skill/
    l5-reasoning/
    l6-orchestration/
    l7-hybrid/
    cli/              ← itfs run entry point
  skills/             ← skill bundles live here (not a package)
  config/
    ITFS.yaml         ← system config
    MODEL_ROUTING.md   ← routing config (human-edited)
  docs/
```

**Tooling choices**

- Language: TypeScript 5.x, strict mode, no `any`
- Runtime: Node 20+
- Package manager: pnpm workspaces
- Build: tsup per package
- Test: Vitest
- Lint: ESLint + Prettier
- CI: GitHub Actions — lint + typecheck + test on every PR

**Acceptance criteria**

- `pnpm install` works from root
- `pnpm build` builds all packages with zero type errors
- `pnpm test` runs with zero failures
- Each package has a `src/index.ts` that exports at least one named export

**Do not do this**

- Do not add agent logic yet
- Do not add model-specific code in shared types
- Do not mix runtime code into the `types` package

---

### TASK-001 · Shared types package (`packages/types`)

**What to build**

This is the most important package in the repo. Every inter-layer contract is defined here.

**File: `packages/types/src/index.ts`**

```tsx
export type SemVer = string; // "1.0.0"
export type TaskId = string; // uuid
export type SkillId = string; // "write_code@1.2.0"
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
```

**Acceptance criteria**

- All packages compile against these types
- No package defines its own competing version of these interfaces
- Adding a new layer contract should require editing only this package first

---

## Phase 1 — L1 Model Layer

> **Goal:** Abstract the model behind one interface so the rest of the system does not care whether the model is local or cloud.

---

### TASK-010 · Model adapter interface

**What to build**

A common adapter contract used by all providers.

```tsx
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
}
```

**Acceptance criteria**

- A local adapter and a cloud adapter both satisfy the same interface
- The caller does not know which provider was used
- Streaming and non-streaming both work

**Do not do this**

- Do not let model provider code leak into orchestration logic
- Do not hardcode provider-specific prompts in the caller

---

### TASK-011 · Local model adapter

**What to build**

- Ollama adapter
- vLLM adapter if needed
- Basic health check and timeout handling

**Acceptance criteria**

- A local endpoint can respond to chat completions
- Failures return structured errors
- Adapter can be swapped without changing downstream code

---

### TASK-012 · Cloud model adapter

**What to build**

- One cloud provider adapter through LiteLLM or direct API
- Support for tool calling
- Support for streamed output

**Acceptance criteria**

- The same prompt can run through local or cloud with no code changes outside configuration

---

## Phase 2 — L3 Tooling Layer

> **Goal:** Build deterministic actions the model can invoke safely.

---

### TASK-020 · Tool registry

**What to build**

- Register tools by name
- Enforce typed input and output contracts
- Expose tool metadata for discovery

**Acceptance criteria**

- The system can list available tools at runtime
- The model can only call registered tools
- Every tool returns structured results

---

### TASK-021 · Code execution tool

**What to build**

- Python execution sandbox
- Return stdout, stderr, exit code, duration
- Enforce timeout and basic isolation

**Acceptance criteria**

- Code can be executed and verified
- Failures do not crash the agent loop
- Tool output is fed back into reasoning

**Do not do this**

- Do not execute arbitrary code without sandboxing
- Do not couple tool execution to prompt formatting

---

### TASK-022 · File system tools

**What to build**

- Read file
- Write file
- Diff file
- Patch file

**Acceptance criteria**

- All file operations are limited to the project root
- Write operations return a diff or summary
- Undo is possible through stored patch history

---

### TASK-023 · Web access tool

**What to build**

- Search
- Fetch
- Structured scrape
- Source metadata output

**Acceptance criteria**

- Every response includes source and timestamp
- Rate limits are handled gracefully
- The tool output is parseable by the model

---

## Phase 3 — L4 Skill Layer

> **Goal:** Convert repeated workflows into reusable capability bundles.

---

### TASK-030 · Skill bundle structure

**What to build**

```
skills/
  <skill-name>/
    SKILL.md
    schema.json
    tools.json
    examples/
    tests/
    METADATA.json
```

**Acceptance criteria**

- A skill lives as a portable bundle
- A skill can be moved without rewriting engine code

---

### TASK-031 · SKILL.md standard

**What to build**

- Trigger conditions
- Procedure steps
- Tool usage policy
- Output contract
- Failure modes
- Budget hint

**Acceptance criteria**

- A skill can be read by any compatible runtime
- The skill includes enough information to execute without guesswork

---

### TASK-032 · Skill loader and matcher

**What to build**

- Load skills from disk
- Match by domain tag and semantic trigger
- Rank skills by relevance and version

**Acceptance criteria**

- Relevant skills are selected automatically
- A task can inject one or more skill bundles

---

### TASK-033 · Skill execution engine

**What to build**

- Turn skill steps into an execution plan
- Support chaining skills
- Prevent circular dependencies

**Acceptance criteria**

- A skill can drive the agent loop
- Skill composition works without infinite recursion

---

## Phase 4 — L2 Knowledge Layer

> **Goal:** Give the system durable context beyond the current prompt window.

---

### TASK-040 · Retrieval backend

**What to build**

- Vector store integration
- Embedding pipeline
- Top-k retrieval

**Acceptance criteria**

- Relevant documents can be retrieved and ranked
- Retrieved chunks can be injected into the model context

---

### TASK-041 · Memory system

**What to build**

- Session memory
- Persistent key-value memory
- Read/write memory APIs

**Acceptance criteria**

- The system can remember prior tasks
- Useful state persists across sessions
- Memory writes are explicit and inspectable

---

### TASK-042 · Agentic retrieval loop

**What to build**

- Retrieval inside reasoning, not only before it
- Retrieval triggers from skill instructions and tool failures

**Acceptance criteria**

- The agent can ask for more context mid-task
- Retrieval improves task success on knowledge-heavy prompts

---

## Phase 5 — L5 Reasoning Layer

> **Goal:** Control how inference-time compute is spent.

---

### TASK-050 · Reasoning budget system

**What to build**

- Budget object
- Strategy selection
- Max depth / retries / branches
- Budget exhaustion policy

**Acceptance criteria**

- Each task has an explicit reasoning budget
- The budget governs how much the model is allowed to think

---

### TASK-051 · Sequential reasoning loop

**What to build**

- Generate → execute → verify → repair → retry
- Reflexion mode for self-correction

**Acceptance criteria**

- The system can debug itself on simple code tasks
- The loop stops when the budget or success condition is reached

---

### TASK-052 · Parallel reasoning loop

**What to build**

- Best-of-N candidate generation
- Candidate scoring and selection

**Acceptance criteria**

- Multiple solutions can be compared
- The best candidate can be selected without human intervention

---

### TASK-053 · Verifier system

**What to build**

- Execution verifier
- Syntax verifier
- Self-consistency verifier

**Acceptance criteria**

- Outputs can be checked before acceptance
- Invalid results are rejected or repaired

---

## Phase 6 — L6 Orchestration Layer

> **Goal:** Convert goals into plans, dependencies, retries, and subtasks.

---

### TASK-060 · Task decomposition

**What to build**

- Break a task into a DAG of subtasks
- Track dependencies
- Support parallel branches where possible

**Acceptance criteria**

- Complex work can be split into smaller units
- Subtasks can run in the correct order

---

### TASK-061 · Routing and dispatch

**What to build**

- Send subtasks to the appropriate skill and tool stack
- Pass context, budget, and domain tags downstream

**Acceptance criteria**

- The right skill is chosen for the right job
- The execution layer receives a clean task envelope

---

### TASK-062 · Failure handling

**What to build**

- Retry policies
- Fallback behavior
- Escalation output

**Acceptance criteria**

- Tool errors do not kill the whole run
- Budget exhaustion produces a structured escalation record

---

## Phase 7 — L7 Hybrid Intelligence Layer

> **Goal:** Decide local vs cloud execution with policy, not vibes.

---

### TASK-070 · Routing policy engine

**What to build**

- Sensitivity scoring
- Complexity scoring
- Availability / saturation checks
- Route selection output

**Acceptance criteria**

- Sensitive tasks stay local by default
- High-complexity tasks can escalate to cloud
- Cloud failure falls back to local when possible

---

### TASK-071 · Unified gateway

**What to build**

- One gateway for local and cloud providers
- Policy-driven selection
- Cost and latency metadata

**Acceptance criteria**

- The system can explain why a route was chosen
- Switching providers does not require rewriting business logic

---

## Phase 8 — Observability, Eval, and Hardening

> **Goal:** Make the system measurable, debuggable, and safe to evolve.

---

### TASK-080 · Telemetry

**What to build**

- Trace per task
- Trace per reasoning step
- Trace per tool call
- Trace per model call

**Acceptance criteria**

- Every execution path is observable
- Debugging a failed task is straightforward

---

### TASK-081 · Evaluation harness

**What to build**

- Benchmark runner
- Task success scoring
- Model comparison reports

**Acceptance criteria**

- You can compare local vs cloud performance on the same task set
- You can measure whether ITFS is actually helping

---

### TASK-082 · Safety and policy controls

**What to build**

- Permission scopes
- Local-only enforcement
- Secret handling rules
- Tool sandbox constraints

**Acceptance criteria**

- Sensitive tasks never leave the approved boundary
- Tools cannot access more than they should

---

## Milestone Definition

### M1 — Working Runtime

A task can be routed, executed, verified, and returned.

### M2 — Reusable Intelligence

Skills, memory, retrieval, and budgets work together.

### M3 — Production Readiness

Routing, observability, fallback, and eval are stable enough for team use.

---

## Definition of Done

ITFS is not done when the architecture looks elegant.

ITFS is done when:

- tasks complete reliably end-to-end,
- skills are reusable and versioned,
- tools are typed and deterministic,
- routing is intelligent,
- memory improves future runs,
- and local execution saves real cost without sacrificing quality.

---

## Non-Goals

- No giant framework before the runtime works
- No agent swarms before single-agent reliability
- No fancy UI before the core loop is stable
- No model fine-tuning as a dependency for v1
- No hidden magic that cannot be traced or debugged

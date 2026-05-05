# srs

# **ITFS**

**Inference-Time First Stack**

Software Requirements Specification

Version 1.0  |  May 2026  |  DRAFT

Abstract

ITFS is an open, language-agnostic framework built on a single thesis: a smaller local model equipped with structured tooling, a curated knowledge system, web access, and inference-time reasoning infrastructure can match or beat a large frontier model for specific, well-scoped tasks. ITFS defines the architecture, contracts, and integration patterns for this hybrid-first approach, where a cloud orchestrator handles broad reasoning and planning, while local agents execute domain-specific agentic work with full tool access.

---

# **1. Introduction**

## **1.1 Background & Motivation**

Recent research has established a critical insight in AI systems design: inference-time scaling — allocating more compute during inference rather than simply increasing parameter count — can be more cost-effective for targeted reasoning tasks. A Google paper from 2024 demonstrated that scaling test-time compute optimally can outperform scaling model parameters for many reasoning workloads.

Simultaneously, the economics of cloud-only LLM deployments have shifted. Not every subtask in a workflow requires a frontier-class model. Simple classification, code generation for known patterns, structured document work, and domain-specific pipelines run well on local models in the 7B–14B parameter range when paired with the right tooling scaffold.

ITFS codifies this insight into a reproducible, extensible framework philosophy.

## **1.2 Core Thesis**

Local Model  +  Good Harness  +  Web Access  +  Inference-Time Reasoning Infra  >  Big Model alone  (on a specific task)

---

## **1.3 Intended Audience**

- AI/ML engineers building domain-specific coding, mobile, or web automation agents
- Platform architects designing hybrid cloud+local LLM infrastructure
- Researchers exploring inference-time compute allocation strategies
- Developers seeking ROI-optimal alternatives to full frontier-model deployments

## **1.4 Scope**

This SRS covers the ITFS runtime, its layered architecture, the Skills & Knowledge System, tooling contracts, and integration adapters for external AI frameworks. It does not prescribe a specific LLM model — ITFS is model-agnostic and compatible with any OpenAI-API-compatible local endpoint (Ollama, LM Studio, vLLM) and cloud providers (Anthropic, OpenAI, Google).

# **2. Framework Philosophy**

## **2.1 The Five Pillars**

ITFS is governed by five architectural pillars. All design decisions must serve at least one pillar.

| **Pillar**                | **Definition**                                                                                                                                 | **Why It Matters**                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Inference-Time Reasoning  | Prefer sequential or parallel test-time scaling over raw parameter count. Budget compute at inference, not pre-training.                       | Allows smaller models to rival larger ones on specific tasks at a fraction of the cost. |
| Layered Architecture      | Separate Orchestration, Execution, Tooling, Knowledge, and Memory into discrete, replaceable layers.                                           | Each layer can be upgraded, swapped, or scaled independently.                           |
| Structured Tooling        | Every capability is a named, versioned, self-describing Tool with a typed contract. Tools are composable and discoverable.                     | Prevents capability sprawl; enables the local model to reason about what it can do.     |
| Skills & Knowledge System | Domain knowledge is encoded in SKILL.md files — structured prompt templates consumed by any compatible model.                                  | Transfers expert context into inference-time reasoning without fine-tuning.             |
| Hybrid Orchestration      | Cloud model (e.g. Claude) handles broad planning & high-complexity synthesis. Local agents handle execution loops, tooling, and agentic tasks. | Optimizes cost-vs-capability trade-off per task segment.                                |

## **2.2 Inference-Time vs Parameter Scaling — The Research Basis**

ITFS's primary design driver is grounded in a growing body of research on test-time compute scaling:

- Parallel scaling (Best-of-N, majority voting) generates multiple candidate solutions and selects the best, improving accuracy without changing model size.
- Sequential scaling (iterative refinement, chain-of-thought, self-correction) allocates additional reasoning steps within a single inference pass.
- S\* (a coding-specific TTS method) combines both strategies: generating multiple solutions then iteratively debugging using execution feedback — a pattern ITFS implements natively in its Code Execution Tool layer.
- Research shows that for tasks with verifiable outputs (code execution, test suites, structured data), inference-time scaling produces Pareto-optimal cost-performance trade-offs versus scaling model parameters.

ITFS operationalizes these findings through its Reasoning Budget system (Section 4.3).

## **2.3 The ROI Argument**

For teams building on specific domains — mobile coding, web scraping, AI-assisted coding workflows — the cost of routing every token to a frontier model is prohibitive at scale. ITFS's hybrid model enables:

- Frontier model (Cloud): Complex reasoning, architectural planning, broad synthesis — paid per-token but used sparingly.
- Local model (7B–14B): Task execution, code generation, structured output, tool invocation — free after hardware cost.
- Result: 60–80% of tokens stay local; frontier model handles 20–40% requiring genuine broad intelligence.

# **3. System Architecture**

## **3.1 Layered Architecture Overview**

ITFS uses a five-layer stack. Layers communicate only through defined contracts — no layer has direct knowledge of another layer's implementation.

| **Layer** | **Name**                 | **Responsibility**                                                                   | **Replaceable By**                             |
| --------- | ------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| L5        | Orchestration Layer      | High-level planning, task decomposition, routing decisions. Cloud model preferred.   | Any LLM with system prompt + tool call support |
| L4        | Execution Layer          | Agent loop control, sub-task dispatch, context window management, memory writes.     | LangGraph, AutoGen, custom loop                |
| L3        | Tooling Layer            | Named, versioned tool registry. Code execution, web access, file ops, external APIs. | MCP server, OpenAI Tools API, custom adapters  |
| L2        | Skills & Knowledge Layer | SKILL.md files, domain prompt templates, RAG knowledge retrieval, context injection. | Any retrieval system returning text context    |
| L1        | Model Layer              | Inference endpoint. Local (Ollama, vLLM) or cloud (Anthropic, OpenAI). Stateless.    | Any OpenAI-API-compatible endpoint             |

## **3.2 Request Flow**

1. User or upstream system submits a Task with a domain tag (e.g. coding:mobile, web:scraping).
2. Orchestration Layer (L5) decomposes the task into subtasks and sets a Reasoning Budget per subtask.
3. Router determines: does this subtask need cloud reasoning or can it be executed locally? Routing factors: task complexity score, data sensitivity, token estimate, tool dependencies.
4. Execution Layer (L4) spins up an agent context, injects relevant SKILL.md contexts from L2, and loads required tools from L3.
5. Model Layer (L1) executes with the injected context. For inference-time scaling, multiple candidates are generated in parallel or iterative refinement is applied.
6. Tool results feed back into the agent loop at L4. Execution continues until task completion or budget exhaustion.
7. Results are returned to L5 for synthesis and delivery.

## **3.3 Hybrid Cloud-Local Routing**

The routing layer classifies each request on three axes, consistent with production hybrid LLM architecture patterns:

- Sensitivity: Does the request involve private data? If yes, stays local.
- Complexity: Multi-step reasoning, long-context synthesis, agentic tool chains with unknown structure go to cloud.
- Availability: Local GPU saturation triggers cloud overflow; cloud outage triggers local fallback.

Routing is configured via a MODEL_ROUTING.md file at the project root — a human-writable context file (research shows developer-written context files outperform LLM-generated ones by ~4% on task success rates).

# **4. Functional Requirements**

## **4.1 Skills & Knowledge System**

The Skills & Knowledge System is the primary mechanism by which ITFS transfers domain expertise into local model inference without fine-tuning.

### **4.1.1 SKILL.md Standard**

Skills follow the open SKILL.md standard (released as an open standard in December 2025 by Anthropic). Each skill file contains:

- A name and description for triggering logic
- Prerequisites and dependencies
- Step-by-step instructions optimized for LLM consumption
- Example inputs and outputs
- Error handling guidance

Skills are stored in a /skills directory and loaded at inference time by the Execution Layer based on the task domain tag.

### **4.1.2 Knowledge Retrieval**

For domain knowledge exceeding the context window, ITFS integrates a lightweight RAG layer:

- Vector store: any embedding-compatible store (ChromaDB, pgvector, FAISS)
- Retrieval is triggered automatically when a SKILL.md references a knowledge base
- Retrieved context is injected before the user task in the model prompt

## **4.2 Tooling Layer Requirements**

| **Tool Category** | **Examples**                              | **Contract Requirements**                                                                |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Code Execution    | Python runner, Node.js runner, shell exec | Returns stdout, stderr, exit code, execution time. Supports iterative refinement loop.   |
| Web Access        | Search, fetch, scrape, sitemap            | Returns structured result with source URL and timestamp. Rate-limit aware.               |
| File System       | Read, write, diff, patch                  | Sandboxed to project root. Returns diff on write. Supports undo.                         |
| External APIs     | GitHub, Jira, Slack, Google Workspace     | MCP-compatible. Auth handled by adapter, not model.                                      |
| Knowledge Query   | RAG retrieval, SKILL.md lookup            | Returns ranked chunks with relevance score. Max 5 chunks per call.                       |
| Memory R/W        | Short-term context, long-term persistent  | Short-term: current session. Long-term: key-value JSON store, persisted across sessions. |

## **4.3 Reasoning Budget System**

Each task is assigned a Reasoning Budget — a configurable allocation of inference-time compute expressed in tokens or steps. The budget governs:

- Max parallel candidates to generate (for Best-of-N strategies)
- Max sequential refinement steps (for iterative debugging loops)
- Escalation threshold: if budget exhausted without success, escalate to cloud orchestrator

Budget levels are: nano (quick classification), standard (default), deep (complex multi-step), and max (parallel + sequential combined — reserved for high-stakes tasks).

## **4.4 Domain Specialization Profiles**

ITFS ships with pre-configured domain profiles. Each profile bundles a default skill set, tool selection, reasoning budget, and routing preference:

| **Domain**                  | **Default Model Tier**                 | **Key Tools**                            | **Reasoning Strategy**                        |
| --------------------------- | -------------------------------------- | ---------------------------------------- | --------------------------------------------- |
| AI Coding                   | Local 14B (DeepSeek-Coder, Qwen-Coder) | Code exec, file system, GitHub MCP       | Sequential: generate → test → fix loop        |
| Mobile Coding (iOS/Android) | Local 14B + Cloud for architecture     | Code exec, simulator runner, file system | Parallel: Best-of-3 implementation candidates |
| Web Scraping / Automation   | Local 7B                               | Web fetch, DOM parser, sitemap tool      | Sequential: plan → execute → verify           |
| AI Workflow Automation      | Cloud orchestrator + local executor    | All tools + memory R/W                   | Hybrid: cloud plan, local execute             |
| General Coding              | Local 14B                              | Code exec, file system, web search       | Adaptive: budget set by complexity score      |

# **5. Integration & Interoperability**

## **5.1 Model Provider Adapters**

ITFS uses an adapter pattern for model providers. All adapters expose a common interface:

- complete(messages, tools, budget) → response
- stream(messages, tools, budget) → async iterator
- estimate_tokens(messages) → int

Built-in adapters:

| **Adapter**      | **Target**              | **Notes**                                                                        |
| ---------------- | ----------------------- | -------------------------------------------------------------------------------- |
| OllamaAdapter    | Local Ollama server     | Supports any quantized model via /api/chat                                       |
| AnthropicAdapter | Claude API              | Recommended for L5 orchestration; supports extended thinking                     |
| OpenAIAdapter    | OpenAI API / compatible | Compatible with LM Studio, vLLM, Together AI, Groq                               |
| LiteLLMAdapter   | Unified proxy           | Routes to any backend via LiteLLM proxy — recommended for production deployments |

## **5.2 MCP (Model Context Protocol) Integration**

ITFS tooling is MCP-native. Any MCP server can be plugged into the Tooling Layer (L3) with zero code changes. The framework:

- Auto-discovers available MCP tools at agent initialization
- Generates tool schemas in the format expected by the active model adapter
- Handles tool result routing back into the agent context

This makes ITFS immediately compatible with the growing ecosystem of MCP servers (Google Workspace, GitHub, Slack, Jira, Asana, and hundreds of community connectors).

## **5.3 Framework Compatibility**

| **Framework**         | **Integration Mode**                                                                                                                 | **Maturity** |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| LangChain / LangGraph | ITFS Execution Layer can be replaced with LangGraph StateGraph. Skill context injected via system message.                           | Stable       |
| AutoGen               | ITFS agents expose AutoGen-compatible ConversableAgent interface.                                                                    | Beta         |
| Claude Code           | ITFS SKILL.md files are directly compatible with Claude Code's skills system. Share skills between ITFS and Claude Code deployments. | Stable       |
| OpenAI Agents SDK     | ITFS Tool contracts map to OpenAI function calling schema. Adapter provided.                                                         | Stable       |
| CrewAI                | ITFS agents can be wrapped as CrewAI Agents with Tool injection.                                                                     | Beta         |
| LlamaIndex            | ITFS Knowledge Layer can use LlamaIndex as the retrieval backend.                                                                    | Stable       |

## **5.4 Hybrid Cloud Routing — LiteLLM Integration**

For production deployments, ITFS recommends LiteLLM as the unified gateway (consistent with hybrid cloud-local LLM architecture best practices for 2026). The three-pillar routing model:

- Pillar 1 — Sensitivity: PII or private data detected server-side → force local, never cloud
- Pillar 2 — Complexity: Task complexity score above threshold → route to cloud (Anthropic Claude or equivalent)
- Pillar 3 — Availability: Monitor GPU saturation and API p99 latency; trigger fallback direction automatically

# **6. Non-Functional Requirements**

| **Category**     | **Requirement**                                      | **Target**                                                                       |
| ---------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Latency          | Time-to-first-token for local model on standard task | < 500ms on consumer GPU (RTX 3080+)                                              |
| Throughput       | Concurrent agent sessions per local instance         | > 4 parallel agents on 24GB VRAM                                                 |
| Portability      | Runtime support                                      | Linux, macOS, Windows (via WSL2). Docker image provided.                         |
| Extensibility    | Adding a new Tool                                    | < 30 lines of code. Tool auto-registered via decorator.                          |
| Extensibility    | Adding a new Skill                                   | Author a SKILL.md file. Zero code.                                               |
| Interoperability | Model switching                                      | Zero code change. Update MODEL_ROUTING.md only.                                  |
| Observability    | Telemetry                                            | OpenTelemetry traces per agent loop, per tool call, per model call.              |
| Privacy          | Local-first data flow                                | No user data leaves the local machine unless explicitly routed to cloud adapter. |
| Reliability      | Cloud fallback on local failure                      | < 2s automatic failover to cloud adapter.                                        |

# **7. Roadmap**

## **Phase 1 — Core Runtime (Milestone: M1)**

- L1–L4 layer implementation with Ollama + Anthropic adapters
- Skills loader (SKILL.md parser and context injector)
- Tool registry with Code Execution and Web Access tools
- LiteLLM routing integration
- CLI: itfs run <task> --domain <profile>

## **Phase 2 — Domain Profiles & MCP (Milestone: M2)**

- All 5 domain profiles (AI Coding, Mobile, Web, Workflow, General)
- Full MCP tool auto-discovery
- Reasoning Budget system (nano / standard / deep / max)
- Memory Layer (session + persistent key-value)
- VS Code extension for in-editor ITFS agent

## **Phase 3 — Ecosystem & Scale (Milestone: M3)**

- Skill marketplace (community SKILL.md library)
- Multi-agent coordination (parallel subagents per task)
- ITFS Cloud: managed orchestration layer for teams without local GPU
- Eval framework: benchmark any local model on domain profiles with ITFS harness

# **8. Glossary**

| **Term**               | **Definition**                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inference-Time Scaling | Allocating more compute during inference (rather than pre-training) to improve model output quality. Methods include parallel sampling, iterative refinement, and chain-of-thought. |
| SKILL.md               | A structured Markdown file encoding expert domain knowledge as a prompt template consumable by any LLM at inference time. Open standard.                                            |
| Reasoning Budget       | A per-task allocation of inference-time compute expressed in tokens or steps, governing how much test-time scaling to apply.                                                        |
| Hybrid Orchestration   | An architecture where a cloud frontier model handles planning/reasoning and local models handle task execution.                                                                     |
| MCP                    | Model Context Protocol. An open standard for tool/resource exposure to LLMs, enabling any MCP server to integrate with ITFS.                                                        |
| Best-of-N              | A parallel inference-time scaling strategy: generate N candidate outputs, select the best via a verifier or majority vote.                                                          |
| Sequential Scaling     | Iterative inference-time scaling: refine a single answer over multiple steps using feedback (e.g. code execution results).                                                          |
| L1–L5                  | ITFS layer numbering. L1 = Model, L2 = Skills/Knowledge, L3 = Tooling, L4 = Execution, L5 = Orchestration.                                                                          |

ITFS Framework  —  SRS v1.0  —  May 2026  —  Draft for review

---

# 📘 ITFS — Inference-Time First Stack

**Full Framework Specification (Reconstructed)**

_Version 1.0 — May 2026_

---

# 1. Core Thesis

A local model, when combined with:

- a programmable reasoning runtime
- structured reusable skills
- deterministic tool execution
- dynamic knowledge retrieval
- and intelligent orchestration

can match or outperform frontier cloud models on **bounded, structured tasks** at significantly lower cost.

---

# 2. System Philosophy

### Traditional LLM systems fail because:

- reasoning is implicit
- tools are unstructured
- memory is shallow
- orchestration is hidden in prompts

---

### ITFS Principle:

> **Separate intelligence into layers with strict contracts**

---

# 3. Layered Architecture

```
L7 Hybrid Intelligence
L6 Orchestration
L5 Reasoning
L4 Skills
L3 Tooling
L2 Knowledge
L1 Model
```

Each layer:

- has a **single responsibility**
- communicates via **typed contracts**
- is **replaceable independently**

---

# 🧠 4. Layer 5 — Reasoning Layer (Core Engine)

## 4.1 Role

Controls:

- how the model thinks
- how long it thinks
- how it verifies itself
- when it retries or stops

---

## 4.2 Reasoning Strategies

### 1. Chain-of-Thought (CoT)

- Linear reasoning
- Produces structured trace

```
trace = {
  steps: [...],
  conclusion: ...
}
```

---

### 2. Tree-of-Thought (ToT)

- Explores multiple reasoning paths

Key components:

- Node expansion
- Node scoring
- Pruning

---

### 3. Retrieval-Augmented Thought (RAT)

- Retrieval happens inside reasoning

```
step → retrieve(query) → inject → continue
```

---

### 4. Reflexion

- Self-correction loop

```
fail → critique → update → retry
```

---

### 5. Budget-Controlled Reasoning

```
Budget = {
  strategy,
  max_tokens,
  max_depth,
  max_branches,
  max_retries
}
```

---

## 4.3 Verifier System

### Purpose:

Validate outputs before acceptance

---

### Types:

| Type             | Mechanism         |
| ---------------- | ----------------- |
| Execution        | Run code          |
| Syntax           | Schema validation |
| Self-consistency | Majority voting   |
| Reward model     | Step scoring      |
| Human            | Manual approval   |

---

## 4.4 Runtime Loop

```
while not done:
  generate step
  verify step
  if fail:
    reflexion or retry
  if budget exceeded:
    escalate
```

---

# 🧩 5. Layer 4 — Skill Layer

## 5.1 Why Skills

Tools = atomic

Skills = structured workflows

---

## 5.2 Skill Structure

```
skills/<name>/
  SKILL.md
  schema.json
  tools.json
  examples/
  tests/
  METADATA.json
```

---

## 5.3 SKILL.md Contract

- trigger_conditions
- procedure
- tool_usage_policy
- output_contract
- failure_modes
- budget_hint

---

## 5.4 Lifecycle

1. Acquire (human or distilled)
2. Store (versioned)
3. Discover (retrieval)
4. Inject (into context)
5. Execute
6. Verify
7. Evolve

---

## 5.5 Skill Composition

```
Skill A → Skill B → Skill C
```

Constraints:

- schema compatibility
- no circular dependencies
- bounded depth

---

# 🛠️ 6. Layer 3 — Tooling Layer

## 6.1 Principle

Tools must be:

- deterministic
- stateless
- sandboxed

---

## 6.2 Tool Interface

```
execute(input) → {
  output,
  success,
  error,
  duration,
  resource_usage
}
```

---

## 6.3 Tool Categories

- Code execution
- Web automation
- File system
- APIs
- Memory
- Utility

---

## 6.4 Tool Contract

```
{
  name,
  input_schema,
  output_schema,
  permissions,
  sandbox_profile
}
```

---

## 6.5 Key Rule

> Tools do NOT contain logic
>
> Skills contain logic

---

# 📚 7. Layer 2 — Knowledge Layer

## 7.1 Role

Provides:

- context
- memory
- domain awareness

---

## 7.2 Three-Tier Retrieval

### 1. Vector Store

- semantic similarity
- hybrid search (dense + sparse)

---

### 2. Knowledge Graph

- entities + relationships
- multi-hop reasoning

---

### 3. Agentic RAG

- retrieval inside reasoning loop

---

## 7.3 Memory System

| Type     | Scope            |
| -------- | ---------------- |
| Working  | current task     |
| Session  | current session  |
| Episodic | past tasks       |
| Semantic | global knowledge |
| User     | personalized     |

---

# 🎯 8. Layer 6 — Orchestration Layer

## 8.1 Role

Turns goals into execution plans

---

## 8.2 Task Decomposition

```
Task → DAG of skills
```

Supports:

- parallel execution
- dependency tracking

---

## 8.3 Skill Routing

Selection logic:

1. Tag match
2. Semantic match
3. Version priority

---

## 8.4 Failure Handling

| Failure           | Response              |
| ----------------- | --------------------- |
| Verification fail | Reflexion             |
| Tool error        | Retry / abort         |
| Budget exceeded   | Escalate              |
| No skill          | Synthesize / escalate |

---

## 8.5 Escalation

```
{
  task,
  trace,
  reason,
  budget_hint
}
```

---

# ☁️ 9. Layer 7 — Hybrid Intelligence

## 9.1 Purpose

Decide:

- local vs cloud

---

## 9.2 Routing Axes

### 1. Privacy

Sensitive → local

### 2. Complexity

High → cloud

### 3. Availability

Fallback handling

---

## 9.3 Output

```
ModelRoute = {
  provider,
  model,
  cost_estimate,
  privacy_mode
}
```

---

## 9.4 Strategy

- 80% local execution
- 20% cloud escalation

→ massive cost reduction

---

# ⚡ 10. Layer 1 — Model Layer

## 10.1 Role

Pure inference

---

## 10.2 Key Principle

> Model is NOT the system
>
> It is just a component

---

## 10.3 Context Structure

1. System instructions
2. Skill definition
3. Knowledge context
4. Memory
5. User input

---

# 11. Inter-Layer Contracts

Strict typed interfaces:

```
L6 → L5 : ReasoningTask
L5 → L4 : SkillInvocation
L4 → L3 : ToolCall
L4 → L2 : KnowledgeQuery
L5 → L1 : ModelRequest
```

---

# 12. Configuration

### Files:

- `MODEL_ROUTING.md`
- `ITFS.yaml`

---

# 13. Observability

Each layer emits traces:

- reasoning steps
- skill execution
- tool calls
- token usage
- latency

---

# 14. Final Insight

This system is not about:

> making LLMs smarter

It is about:

> **structuring intelligence around them**

---

# 15. What You Actually Built

Be very clear:

This is NOT:

- a tutorial
- a random idea
- a small project

This is:

> **A full agent architecture framework**

---

# If you want the next level

We can now:

1. Turn this into a **20–30 page whitepaper**
2. Add **diagrams + system flows**
3. Build a **real implementation roadmap**
4. Convert it into a **startup-grade product spec**

# roadmap

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

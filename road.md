# Vision
ITFS (Inference-Time First Stack) is an open framework for hybrid intelligence, enabling small local models to rival frontier cloud models through structured reasoning, tooling, and knowledge.

# Current Product State
The project is in Phase 1 of the roadmap. The monorepo scaffold is in place, L1 Model Adapters support inference and embeddings, and the L2 Knowledge Layer is initialized with a local vector store and Corrective RAG (CRAG) capabilities.

# Current Architecture
Layered architecture (L1-L7):
- L1: Model (Stateless inference & embeddings)
- L2: Knowledge (Local Vector Store, CRAG Retriever)
- L3: Tooling (Atomic actions, MCP support)
- L4: Skill (Workflow bundles)
- L5: Reasoning (Inference-time scaling)
- L6: Orchestration (Task decomposition, DAG execution)
- L7: Hybrid (Cloud/Local routing)

# Current Repository Health
- Monorepo scaffolded with pnpm workspaces.
- TypeScript 5.x strict mode.
- Linting and testing configured.
- Core packages (L1, L2, L3, L5, L6) have initial implementations.

# Active Task
Enhance L3 Tooling (File system, Web access).

# Queued Tasks
1. Enhance L3 Tooling (File system, Web access).
2. Implement L4 Skill Layer (SKILL.md loader).
3. Mature L5 Reasoning (ToT, RAT).
4. Implement L7 Hybrid Routing Policy.
5. Implement Observability/Telemetry (L8).
6. Build CLI for itfs run.
7. Implement L2 Embedding pipeline (batching, persistence).
8. Add Web Search tool to L3 for CRAG "incorrect" fallback.
9. Implement multi-modal L1 adapters (Vision).

# System Bottlenecks
- L1 AnthropicAdapter lacks native embedding support.
- L2 VectorStore is in-memory only (needs persistence).
- Lack of real-world skills in /skills.

# Technical Debt
- `LocalCodeExecutionTool` uses `node:vm` (unsecured).
- Task synthesis in `TaskExecutor` is naive.

# AI/Research Integrations
- Grounded in 'Parallelized Planning-Acting' (ArXiv:2503.03505v2).
- S* Strategy for execution-grounded reasoning.
- Corrective RAG (CRAG) for robust knowledge retrieval (ArXiv:2401.15884).

# Security State
- Preliminary security audit needed.
- `node:vm` usage flagged as a risk for untrusted code.

# Performance State
- Baseline performance metrics not yet established.
- Ollama embedding calls are parallelized.

# UX State
- CLI-focused initially. UX is developer-centric.

# Infrastructure State
- Local development environment uses Node.js and pnpm.
- Dockerization planned for M3.

# Testing State
- Vitest configured.
- Coverage increasing; L2 Knowledge layer has unit tests.

# Scalability Risks
- Orchestration DAG execution overhead for very large graphs.
- Local model VRAM limits.
- In-memory VectorStore size limits.

# Current Blockers
- None.

# Recently Completed Tasks
- Monorepo scaffolding.
- Shared types definition.
- Initial Reasoning, Tooling, and Orchestration logic.
- Atlas Prime Intelligence initialization.
- L1 Model Adapters (Ollama, Anthropic) with Embedding support.
- L2 Knowledge Layer (LocalVectorStore, CRAG Retriever).

# Next 10 Priorities
1. L3 File System tools (read, write, diff).
2. L4 Skill loader and matcher.
3. L5 Verifier system (execution, syntax).
4. L6 Parallel branch execution in Orchestrator.
5. L7 Routing Policy Engine.
6. itfs run CLI implementation.
7. L2 Persistence (File-based or SQLite).
8. L3 Web Search tool.
9. L5 Metacognitive strategy.
10. L8 Telemetry (Trace logging).

# Next 100 Improvements
- [ ] Distributed orchestration.
- [ ] Web UI for trace visualization.
- [ ] Skill marketplace.
- [ ] Automated skill distillation.

# Execution Log
- 2025-05-24: Started initialization of Atlas Prime system intelligence files.
- 2025-05-24: Initialized Atlas Prime Intelligence and implemented L1 Model Adapters (Ollama, Anthropic).
- 2025-05-24: Implemented L2 Knowledge Layer with LocalVectorStore and Corrective RAG (CRAG) primitive. Added embedding support to L1 adapters.

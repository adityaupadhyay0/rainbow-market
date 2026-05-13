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
- L3 enhanced with filesystem and web access tools.

# Active Task
Implement L5 RAT Strategy.

# Queued Tasks
1. Mature L5 Reasoning (ToT).
2. Implement L7 Hybrid Routing Policy.
3. Implement L5 Verifier system (execution, syntax).
4. Implement Observability/Telemetry (L8).
5. Build CLI for itfs run.
6. Implement L2 Embedding pipeline (batching, persistence).
7. Add Web Search tool to L3 for CRAG "incorrect" fallback.
8. Implement multi-modal L1 adapters (Vision).

# System Bottlenecks
- L1 AnthropicAdapter lacks native embedding support.
- L2 VectorStore is in-memory only (needs persistence).

# Technical Debt
- `LocalCodeExecutionTool` uses `node:vm` (unsecured).
- Task synthesis in `TaskExecutor` is naive.
- `DiffFileTool` uses a naive line-by-line comparison (fragile to insertions).
- `WebFetchTool` lacks SSRF protections (domain whitelisting/internal IP blocking).

# AI/Research Integrations
- Grounded in 'Parallelized Planning-Acting' (ArXiv:2503.03505v2).
- S* Strategy for execution-grounded reasoning.
- Corrective RAG (CRAG) for robust knowledge retrieval (ArXiv:2401.15884).

# Security State
- Preliminary security audit completed.
- `node:vm` usage flagged as a risk for untrusted code.
- Filesystem tools hardened with path traversal protection (using `path.relative`).
- SSRF risk in `WebFetchTool` identified.

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
- Coverage increasing; L2 Knowledge and L3 Tooling layers have unit tests.

# Scalability Risks
- Orchestration DAG execution overhead for very large graphs.
- Local model VRAM limits.
- In-memory VectorStore size limits.

# Current Blockers
- None.

# Recently Completed Tasks
- Deep Project Understanding and Analysis.
- Monorepo scaffolding.
- Shared types definition.
- Initial Reasoning, Tooling, and Orchestration logic.
- Atlas Prime Intelligence initialization.
- L1 Model Adapters (Ollama, Anthropic) with Embedding support.
- L2 Knowledge Layer (LocalVectorStore, CRAG Retriever).
- Enhanced L3 Tooling (ReadFileTool, WriteFileTool, DiffFileTool, WebFetchTool).
- L4 Skill Layer (SkillLoader implementation).

# Next 10 Priorities
1. Mature L5 Reasoning (ToT).
2. L5 Verifier system (execution, syntax).
3. L6 Parallel branch execution in Orchestrator.
4. L7 Routing Policy Engine.
5. itfs run CLI implementation.
6. L2 Persistence (File-based or SQLite).
7. L3 Web Search tool.
8. L5 Metacognitive strategy.
9. L8 Telemetry (Trace logging).
10. Multi-modal L1 adapters.

# Next 100 Improvements
- [ ] Distributed orchestration.
- [ ] Web UI for trace visualization.
- [ ] Skill marketplace.
- [ ] Automated skill distillation.

# Execution Log
- 2025-05-24: Started initialization of Atlas Prime system intelligence files.
- 2025-05-24: Initialized Atlas Prime Intelligence and implemented L1 Model Adapters (Ollama, Anthropic).
- 2025-05-24: Implemented L2 Knowledge Layer with LocalVectorStore and Corrective RAG (CRAG) primitive. Added embedding support to L1 adapters.
- 2025-05-24: Enhanced L3 Tooling with ReadFileTool, WriteFileTool, DiffFileTool, and WebFetchTool. Added path traversal protections and documented technical debt.
- 2025-05-24: Implemented L4 Skill Layer with `SkillLoader`. Defined `Skill` and `SkillMetadata` types. Added unit tests for skill loading.
- 2026-05-24: Completed deep repository analysis and initialized task sequence for L5 Reasoning maturity.

# Vision
ITFS (Inference-Time First Stack) is an open framework for hybrid intelligence, enabling small local models to rival frontier cloud models through structured reasoning, tooling, and knowledge.

# Current Product State
The project is in Phase 0/1 of the roadmap. The monorepo scaffold is in place with core packages defined. Basic L3 (Tooling), L5 (Reasoning), and L6 (Orchestration) skeletons exist.

# Current Architecture
Layered architecture (L1-L7):
- L1: Model (Stateless inference)
- L2: Knowledge (Retrieval, memory)
- L3: Tooling (Atomic actions)
- L4: Skill (Workflow bundles)
- L5: Reasoning (Inference-time scaling)
- L6: Orchestration (Task decomposition, DAG execution)
- L7: Hybrid (Cloud/Local routing)

# Current Repository Health
- Monorepo scaffolded with pnpm workspaces.
- TypeScript 5.x strict mode.
- Basic linting and testing configured.
- Core packages exist but some are empty (e.g., L1).

# Active Task
Implement L2 Knowledge Layer (RAG, Vector Store).

# Queued Tasks
1. Implement L2 Knowledge Layer (RAG, Vector Store).
2. Enhance L3 Tooling (File system, Web access).
3. Enhance L3 Tooling (File system, Web access).
4. Implement L4 Skill Layer (SKILL.md loader).
5. Mature L5 Reasoning (ToT, RAT).
6. Implement L7 Hybrid Routing Policy.
7. Integrate MCP for L3.
8. Implement Observability/Telemetry (L8).
9. Build CLI for itfs run.

# System Bottlenecks
- L1 is currently empty, no real inference possible.
- L5 Reasoning strategies are initial implementations.
- Lack of real-world skills in /skills.

# Technical Debt
- `LocalCodeExecutionTool` uses `node:vm` (unsecured).
- Task synthesis in `TaskExecutor` is naive (uses last terminal node).

# AI/Research Integrations
- Grounded in 'Parallelized Planning-Acting' (ArXiv:2503.03505v2).
- S* Strategy for execution-grounded reasoning.

# Security State
- Preliminary security audit needed.
- `node:vm` usage flagged as a risk for untrusted code.

# Performance State
- Baseline performance metrics not yet established.

# UX State
- CLI-focused initially. UX is developer-centric.

# Infrastructure State
- Local development environment uses Node.js and pnpm.
- Dockerization planned for M3.

# Testing State
- Vitest configured.
- Low coverage currently as implementation is starting.

# Scalability Risks
- Orchestration DAG execution overhead for very large graphs.
- Local model VRAM limits.

# Current Blockers
- None.

# Recently Completed Tasks
- Monorepo scaffolding.
- Shared types definition.
- Initial Reasoning, Tooling, and Orchestration logic.
- Atlas Prime Intelligence initialization.
- L1 Model Adapters (Ollama, Anthropic).

# Next 10 Priorities
1. L2 Vector Store integration.
4. L2 Embedding pipeline.
5. L3 File System tools (read, write, diff).
6. L4 Skill loader and matcher.
7. L5 Verifier system (execution, syntax).
8. L6 Parallel branch execution in Orchestrator.
9. L7 Routing Policy Engine.
10. itfs run CLI implementation.

# Next 100 Improvements
- [ ] Distributed orchestration.
- [ ] Web UI for trace visualization.
- [ ] Skill marketplace.
- [ ] Automated skill distillation.

# Execution Log
- 2025-05-24: Started initialization of Atlas Prime system intelligence files.
- 2025-05-24: Initialized Atlas Prime Intelligence and implemented L1 Model Adapters (Ollama, Anthropic).

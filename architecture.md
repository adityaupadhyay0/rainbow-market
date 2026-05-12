# Architecture

## System Overview
ITFS is a 7-layer stack designed for Inference-Time Scaling.

## Component Map
- `packages/types`: The "Truth". All inter-layer contracts. Includes knowledge and retrieval types.
- `packages/l1-model`: The "I/O". Stateless model communication (Chat, Stream, Embed).
- `packages/l2-knowledge`: The "Memory". Local vector storage and CRAG-based retrieval.
- `packages/l3-tooling`: The "Hands". Deterministic actions.
- `packages/l4-skill`: The "Workflows". Procedural knowledge loading and management.
- `packages/l5-reasoning`: The "Brain". Controls test-time compute.
- `packages/l6-orchestration`: The "Manager". Plans and executes DAGs.

## Data Flow
User Task -> L7 (Route) -> L6 (Decompose) -> L6 (Dispatch to L4/L5) -> L5 (Reason via L1) -> L4 (Use Tools from L3 / Knowledge from L2 via CRAG) -> L6 (Synthesize) -> User.

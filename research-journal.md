# Research Journal

## 2026-05-24 — Corrective RAG (CRAG) for L2 Knowledge Layer

### Source
ArXiv:2401.15884 (Corrective Retrieval Augmented Generation)

### Insight
Traditional RAG blindly trusts the retriever. If the retriever fails (returns irrelevant documents), the generator hallucinates or fails. CRAG introduces a "Retrieval Evaluator" between retrieval and generation to classify the quality of retrieved documents and trigger corrective actions.

### Core Mechanism
- **Retrieval Evaluator**: Assigns a confidence score to retrieved documents (Correct, Ambiguous, Incorrect).
- **Corrective Actions**:
    - **Correct**: Perform "knowledge refinement" (decompose-then-recompose) to extract key information and filter noise.
    - **Incorrect**: Discard retrieved documents and trigger an external search (e.g., Web Search).
    - **Ambiguous**: Combine retrieved knowledge with external search results.
- **Decompose-then-Recompose**: Breaking documents into "knowledge strips" and ranking them to ensure only high-signal data reaches the context window.

### Adaptation
In ITFS, we will implement this as a `KnowledgeRetriever` primitive that can:
1. Rank retrieved documents by similarity (Standard RAG).
2. Filter documents below a certain threshold (Evaluator).
3. (Future) Trigger Web Search tools from L3 if the result is "Incorrect" or "Ambiguous".

### Simplification
We will simplify CRAG into a "Threshold-based Retrieval Filter" and a "Knowledge Strip" re-ranker. Instead of a separate evaluator model initially, we can use a small local model or even a simple similarity threshold as a baseline.

### Reusable Pattern
`EvaluatedRetriever`: A wrapper around a standard retriever that adds an evaluation step to decide whether to proceed, refine, or augment.

### Limitations
- Evaluator overhead (latency).
- Dependency on external search for "Incorrect" cases.
- Complexity in "recomposing" knowledge strips without losing context.

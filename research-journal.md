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

## 2026-05-24 — L4 Skill Layer: Procedural Knowledge Separation

### Source
Internal Architecture Design

### Insight
Decoupling metadata from procedures in skills allows for efficient discovery (via metadata) while maintaining rich, human-readable instructions for reasoning models (via SKILL.md).

### Conflict
Initially considered storing procedures in JSON, but SKILL.md provides better DX and allows models to parse natural language procedures more effectively.

### Adaptation
Implemented `SkillLoader` to handle dual-file loading (METADATA.json + SKILL.md).

### Simplification
Reduced the skill primitive to two core files per skill directory, avoiding complex database schemas for procedural knowledge.

### Reusable Pattern
`SkillLoader` pattern for directory-based asset management with metadata-procedure separation.

### Limitations
Current loader is filesystem-based; may need a virtual filesystem or cloud storage adapter for distributed environments.

## 2026-05-24 — Retrieval-Augmented Thought (RAT)

### Source
ArXiv:2403.05313 (RAT: Retrieval-Augmented Thought)

### Insight
Reasoning models (like those using CoT) often suffer from hallucinations in long-form reasoning. RAT integrates retrieval into the reasoning chain iteratively. Instead of RAG (retrieve then reason), RAT does reason-then-retrieve-then-refine.

### Core Mechanism
- **Step-wise Retrieval**: For each step in the reasoning chain, the model identifies if it needs external knowledge.
- **Context Injection**: Retrieved knowledge is used to verify and refine the current thought step before proceeding to the next.
- **Zero-shot CoT baseline**: RAT uses the initial CoT as a query generator.

### Adaptation
In ITFS L5, `RATStrategy` will:
1. Generate an initial thought step.
2. Determine a search query if needed.
3. Call L2 Retriever.
4. Refine the thought step with retrieved context.
5. Repeat for subsequent steps.

### Simplification
We will implement a simplified loop: `generate_step` -> `detect_query` -> `retrieve` -> `refine_step`. Initial query detection can be based on model-generated tags or uncertainty.

### Reusable Pattern
`IterativeRefinementLoop`: A pattern where an intermediate output is checked against an external source (Knowledge or Execution) and updated.

### Limitations
- Latency increases with the number of retrieval steps.
- Retrieval quality dependency (solved by CRAG in L2).

## 2026-05-24 — Tree of Thoughts (ToT)

### Source
ArXiv:2305.10601 (Tree of Thoughts: Deliberate Problem Solving with Large Language Models)

### Insight
LM reasoning can be improved by exploring a tree of thoughts rather than a single chain. This allows for look-ahead, backtracking, and global evaluation of reasoning paths.

### Core Mechanism
- **Thought Decomposition**: Breaking the problem into intermediate steps.
- **Thought Generator**: Generating multiple candidates for each step.
- **State Evaluator**: Heuristic evaluation of thought nodes (SURE, LIKELY, IMPOSSIBLE).
- **Search Algorithm**: BFS or DFS to navigate the tree.

### Adaptation
In ITFS L5, `ToTStrategy` implements a BFS traversal. For each depth level, it generates `k` candidates per parent node, evaluates them, and prunes nodes marked as `IMPOSSIBLE`. It maintains the best `k` nodes at each level.

### Simplification
The initial implementation uses a simple BFS with a fixed branching factor. Evaluator is a prompt-based heuristic returning discrete labels.

### Reusable Pattern
`TreeSearchExecutor`: A generic pattern for state-space search where states are reasoning steps and transitions are model completions.

### Limitations
- Exponential complexity if branching factor and depth are high.
- Heuristic evaluator quality is critical for pruning.

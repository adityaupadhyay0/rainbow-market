# Performance Log

## Status: BASELINE

## 2026-05-24 — Orchestration Parallelization Efficiency
- **Observation**: Reactive parallel execution in L6 allows subtasks to trigger immediately upon dependency satisfaction.
- **Improvement**: Significant reduction in total execution time for wide DAGs compared to previous batch-based execution.
- **Metric**: For a DAG with width $W$ and depth $D$, total time is now approximately $\sum_{i=1}^{D} \max(latency_{subtask\_ij})$ where $j \in [1, W]$, rather than $\sum_{i=1}^{D} \sum_{j=1}^{W} latency_{subtask\_ij}$ (sequential) or $\sum_{i=1}^{D} \text{batch\_latency}_i$ (batch-based).
Last Updated: 2026-05-24

## Bottlenecks
- **Ollama API Latency**: Sequential embedding generation for large batches was identified.
    - *Improvement*: Parallelized embedding requests in `OllamaAdapter` using `Promise.all`.
- **Reasoning Latency (RAT)**: Iterative retrieval in the reasoning loop adds overhead per step.
    - *Improvement*: Planned use of small models for query generation and retrieval confidence scoring.

## Metrics
- **Orchestration Overhead**: TBD.
- **Reasoning Latency**: TBD.
- **Retrieval Speed**: `LocalVectorStore` search is currently O(N) due to in-memory scanning.
    - *Threshold*: Acceptable for < 10,000 documents.

## Recent Optimizations
- **L1**: Parallelized `embed` calls for Ollama.
- **L2**: Document "refinement" filter in CRAG reduces context window noise.

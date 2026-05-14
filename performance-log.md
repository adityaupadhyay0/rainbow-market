# Performance Log

## Status: BASELINE
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

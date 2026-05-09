# Security Audit

## Status: PRE-ALPHA

## Critical Risks
1. **Unsecured Code Execution**: `LocalCodeExecutionTool` uses `node:vm`. Risk of sandbox escape.
   - *Mitigation*: Restrict to local-only use. Plan for Docker/Wasm-based isolation.
2. **Data Leakage**: Hybrid routing might send sensitive data to cloud models.
   - *Mitigation*: Implement privacy-mode tags in `TaskEnvelope`. L7 must strictly enforce `local_only`.

## Vulnerability Log
- [S-001]: `node:vm` is not a secure sandbox. (2025-05-24)

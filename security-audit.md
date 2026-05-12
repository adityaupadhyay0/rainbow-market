# Security Audit

## Status: PRELIMINARY
Last Updated: 2026-05-24

## Critical Risks
1. **Unsecured Code Execution**: `LocalCodeExecutionTool` (L3) uses `node:vm`, which is not a secure sandbox.
    - *Mitigation*: Planned migration to Docker or gVisor for untrusted code.
2. **Local Model Data Leakage**: Risks of sensitive data being sent to local models if not properly sanitized.
    - *Mitigation*: Privacy modes implemented in `TaskEnvelope`.
3. **SSRF Risk**: `WebFetchTool` (L3) allows raw web access without domain whitelisting or internal IP blocking.
    - *Mitigation*: Logged as technical debt; planned implementation of whitelisting.

## Recently Hardened
- **Filesystem Tools (L3)**: `ReadFileTool`, `WriteFileTool`, and `DiffFileTool` implement strict path traversal protection using `path.relative` to ensure resolved paths are within the repository root.
- **Knowledge Layer (L2)**: `cosineSimilarity` guarded against division by zero (NaN) which could lead to unpredictable sorting/retrieval behavior.

## Pending Audits
- MCP Tool Adapter security.
- Auth boundary validation in hybrid mode.
- Comprehensive SSRF protection for WebFetchTool.

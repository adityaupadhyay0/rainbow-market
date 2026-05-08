## ⚡ Atlas Prime: MCP-Native Tooling Evolution

💡 Source:
*Model Context Protocol (MCP)* Specification (Anthropic/Community, 2024-2026)

🧠 Core Insight:
Standardizing tool access through a common protocol allows agents to dynamically discover and consume capabilities from a vast ecosystem of servers (local or remote) without manual integration for every new tool.

🔧 Implementation:
- `ToolRegistry` in `packages/l3-tooling`: Central registry for both local and MCP tools.
- `MCPToolAdapter` in `packages/l3-tooling`: Client-side adapter for the MCP SDK.
- `ReasoningEngine` in `packages/l5-reasoning`: Refactored to use the registry, decoupling reasoning strategies from tool implementations.

🔁 Adaptation:
- **Registry Pattern:** Instead of having strategies instantiate tools directly, the system now uses a registry. This aligns with the SRS L3/L5 layer separation and enables "hot-swapping" tools at runtime.
- **Unified Tool Interface:** Both the legacy `LocalCodeExecutionTool` and the new `MCPToolAdapter` implement a common `Tool` interface with structured input/output contracts.
- **Stdio Transport:** The initial integration focuses on stdio-based MCP servers for local-first reliability.

📊 Impact:
- **Extensibility:** ITFS can now instantly use any MCP-compatible tool (e.g., GitHub, Google Calendar, Brave Search).
- **Decoupling:** L5 reasoning strategies (like S*) no longer need to know about the specifics of L3 tool implementations.

🧪 Testing:
- Unit tests in `packages/l3-tooling/src/index.test.ts` verify registry registration and calling.
- Verified that `SStarStrategy` tests in `packages/l5-reasoning` still pass with the registry-based execution.

🛡️ Security Audit:
- **Stability:** Added timeout handling (default 10s) to MCP calls to prevent remote failures from blocking the agent.
- **Sandboxing:** MCP tools run in their own server processes, providing a natural isolation boundary compared to local VM execution.
- **Safety:** Continued the policy of marking local VM execution as unsecured.

⚠️ Limitations:
- Currently limited to stdio transport for MCP.
- No support for MCP "Resources" or "Prompts" yet, focusing strictly on "Tools".

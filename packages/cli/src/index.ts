import { OllamaAdapter } from "@itfs/l1-model";
import { ToolRegistry, ReadFileTool, WriteFileTool } from "@itfs/l3-tooling";
import { ReasoningLoop } from "@itfs/l5-reasoning";
import { Orchestrator } from "@itfs/l6-orchestration";
import { HybridGateway } from "@itfs/l7-hybrid";
import { TaskEnvelope } from "@itfs/types";

export const name = "cli";

export async function run() {
  console.log("ITFS CLI - Inference-Time First Stack v1.0");

  // Initialize components
  const model = new OllamaAdapter({ model: "llama3" });
  const tools = new ToolRegistry();
  tools.register(new ReadFileTool());
  tools.register(new WriteFileTool());

  const reasoning = new ReasoningLoop(model, tools);
  const orchestrator = new Orchestrator(reasoning);
  const _gateway = new HybridGateway(orchestrator);

  const _task: TaskEnvelope = {
    task_id: "cli-task-1",
    domain: "general",
    title: "CLI Test Run",
    description: "A test run from the CLI",
    budget: {
      strategy: "cot",
      max_tokens: 1000,
      max_depth: 5,
      max_branches: 1,
      max_retries: 3,
      verifier: "null",
      on_budget_exceeded: "fail",
    },
    privacy_mode: "local_only",
  };

  console.log("System initialized. Ready to execute task.");
}

run().catch(console.error);

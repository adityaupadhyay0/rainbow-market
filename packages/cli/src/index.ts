import { OllamaAdapter } from "@itfs/l1-model";
import {
  ToolRegistry,
  ReadFileTool,
  WriteFileTool,
  WebAccessTool,
  CodeExecutionTool,
  RetrievalTool,
} from "@itfs/l3-tooling";
import { ReasoningLoop } from "@itfs/l5-reasoning";
import { Orchestrator } from "@itfs/l6-orchestration";
import { HybridGateway, RoutingPolicyEngine } from "@itfs/l7-hybrid";
import { TaskEnvelope, Telemetry } from "@itfs/types";
import { EvalHarness } from "./eval";

export const name = "cli";

export async function run() {
  console.log("ITFS CLI - Inference-Time First Stack v1.0");

  // Initialize components
  const model = new OllamaAdapter({ model: "llama3" });
  const _store = { query: async () => [] };
  const tools = new ToolRegistry();
  tools.register(new ReadFileTool());
  tools.register(new WriteFileTool());
  tools.register(new WebAccessTool());
  tools.register(new CodeExecutionTool());
  tools.register(new RetrievalTool(_store));

  const reasoning = new ReasoningLoop(model, tools);
  const orchestrator = new Orchestrator(reasoning, model); // Pass model as planner
  const policy = new RoutingPolicyEngine('Default Rules');
  const gateway = new HybridGateway(orchestrator, policy);

  const tasks: TaskEnvelope[] = [
    {
      task_id: "task-1",
      domain: "general",
      title: "Simple Task",
      description: "Read the README.md file",
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
    },
    {
      task_id: 'task-2',
      domain: 'coding:general',
      title: 'Complex Coding Task',
      description: 'Write a python script and save it and then run it to verify',
      budget: {
        strategy: 'reflexion', // Demonstrate 10x reflexion
        max_tokens: 2000,
        max_depth: 10,
        max_branches: 1,
        max_retries: 5,
        verifier: 'execution',
        on_budget_exceeded: 'escalate',
      },
      privacy_mode: 'hybrid',
    },
  ];

  console.log("System initialized. Running evaluation harness...");
  const harness = new EvalHarness(gateway);
  const results = await harness.runEval(tasks);

  console.log("\nEvaluation Results:");
  console.table(results);

  console.log("\nTotal Traces captured:", Telemetry.getTraces().length);
}

run().catch((e) => {
  // If Ollama is not running, we expect a failure in handleTask
  console.log(
    "\nTask execution failed (Expected if Ollama is offline):",
    e.message,
  );
});

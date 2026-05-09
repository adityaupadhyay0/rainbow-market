import {
  ModelAdapter,
  TaskEnvelope,
  TaskGraph,
  Message,
} from "@itfs/types";

export class TaskDecomposer {
  constructor(private model: ModelAdapter) {}

  async decompose(envelope: TaskEnvelope): Promise<TaskGraph> {
    const systemPrompt = `You are a task decomposition expert. Your goal is to break down a complex task into a Directed Acyclic Graph (DAG) of subtasks.
Each subtask must have:
- subtask_id: a unique string identifier.
- title: a short descriptive title.
- description: clear instructions for what this subtask should achieve.
- dependencies: a list of subtask_ids that MUST be completed before this subtask can start.

Return ONLY a JSON object representing the TaskGraph:
{
  "task_id": "${envelope.task_id}",
  "subtasks": [
    {
      "subtask_id": "...",
      "title": "...",
      "description": "...",
      "dependencies": [],
      "status": "pending"
    },
    ...
  ]
}`;

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Decompose this task:
Title: ${envelope.title}
Description: ${envelope.description}
Domain: ${envelope.domain}
Inputs: ${JSON.stringify(envelope.inputs ?? {})}`,
      },
    ];

    const response = await this.model.complete(messages);
    const content = response.message.content;

    try {
      // Basic JSON extraction from markdown if needed
      const jsonStr = content.match(/```json\n([\s\S]*?)```/)?.[1] ?? content;
      const graph = JSON.parse(jsonStr) as TaskGraph;

      // Ensure status is initialized to pending
      graph.subtasks = graph.subtasks.map((s) => ({
        ...s,
        status: "pending",
      }));

      return graph;
    } catch (_e) {
      throw new Error(
        `Failed to parse task decomposition: ${(_e as Error).message}\nContent: ${content}`,
        { cause: _e },
      );
    }
  }
}

import { TaskEnvelope, Telemetry } from '@itfs/types';
import { HybridGateway } from '@itfs/l7-hybrid';

export interface EvalResult {
  task_id: string;
  success: boolean;
  duration_ms: number;
  steps: number;
}

export class EvalHarness {
  private gateway: HybridGateway;

  constructor(gateway: HybridGateway) {
    this.gateway = gateway;
  }

  async runEval(tasks: TaskEnvelope[]): Promise<EvalResult[]> {
    const results: EvalResult[] = [];
    for (const task of tasks) {
      const start = Date.now();
      try {
        await this.gateway.handleTask(task);
        const traces = Telemetry.getTraces().filter(t => t.data?.task_id === task.task_id || t.event === 'model_response');
        results.push({
          task_id: task.task_id,
          success: true,
          duration_ms: Date.now() - start,
          steps: traces.filter(t => t.event === 'reasoning_step_start').length
        });
      } catch (_e) {
        results.push({
          task_id: task.task_id,
          success: false,
          duration_ms: Date.now() - start,
          steps: 0
        });
      }
    }
    return results;
  }
}

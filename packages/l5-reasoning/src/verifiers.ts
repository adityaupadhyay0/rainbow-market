import { VerifierResult, VerifierType, ReasoningBudget } from "@itfs/types";
import { ToolRegistry } from "@itfs/l3-tooling";

export interface Verifier {
  verify(content: string): Promise<VerifierResult>;
}

export class NullVerifier implements Verifier {
  async verify(_content: string): Promise<VerifierResult> {
    return {
      valid: true,
      score: 1,
    };
  }
}

export class SyntaxVerifier implements Verifier {
  async verify(content: string): Promise<VerifierResult> {
    const code = this.extractCode(content);
    if (!code) {
      return {
        valid: false,
        score: 0,
        feedback: "No code block found for syntax verification.",
      };
    }

    try {
      new Function(code);
      return {
        valid: true,
        score: 1,
      };
    } catch (_e) {
      const error = _e as Error;
      return {
        valid: false,
        score: 0,
        feedback: `Syntax error: ${error.message}`,
      };
    }
  }

  private extractCode(content: string): string {
    const match = content.match(/```(?:javascript|typescript|js)?\n([\s\S]*?)```/);
    return match ? match[1] : content;
  }
}

export class ExecutionVerifier implements Verifier {
  constructor(private registry: ToolRegistry) {}

  async verify(content: string): Promise<VerifierResult> {
    const code = this.extractCode(content);
    if (!code) {
      return {
        valid: false,
        score: 0,
        feedback: "No code block found for execution verification.",
      };
    }

    const result = await this.registry.call({
      tool_id: "local_code_execution",
      input: { code },
    });

    return {
      valid: result.success,
      score: result.success ? 1 : 0,
      feedback: result.success ? undefined : `Runtime error: ${result.error}`,
      metadata: { execution: result },
    };
  }

  private extractCode(content: string): string {
    const match = content.match(/```(?:javascript|typescript|js)?\n([\s\S]*?)```/);
    return match ? match[1] : content;
  }
}

export class VerifierFactory {
  static create(type: VerifierType, registry?: ToolRegistry): Verifier {
    switch (type) {
      case "syntax":
        return new SyntaxVerifier();
      case "execution":
        if (!registry) {
          throw new Error("ExecutionVerifier requires a ToolRegistry");
        }
        return new ExecutionVerifier(registry);
      case "null":
      default:
        return new NullVerifier();
    }
  }
}

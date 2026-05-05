import { Message, VerifierType } from "@itfs/types";

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

export class VerifierSystem {
  static verify(message: Message, type: VerifierType): VerificationResult {
    if (type === "null") return { valid: true };

    if (type === "syntax") {
      if (
        !message.content &&
        (!message.tool_calls || message.tool_calls.length === 0)
      ) {
        return { valid: false, reason: "Empty response" };
      }
    }

    if (type === "execution") {
      // Logic for checking if a tool call was successful would go here
      const hasFailedTool = message.tool_result && !message.tool_result.success;
      if (hasFailedTool) {
        return { valid: false, reason: "Tool execution failed" };
      }
    }

    return { valid: true };
  }
}

import { describe, it, expect, vi } from "vitest";
import { SyntaxVerifier, ExecutionVerifier, NullVerifier, VerifierFactory } from "./verifiers.js";
import { ToolRegistry } from "@itfs/l3-tooling";

describe("Verifiers", () => {
  describe("NullVerifier", () => {
    it("should always return valid", async () => {
      const verifier = new NullVerifier();
      const result = await verifier.verify("any content");
      expect(result.valid).toBe(true);
      expect(result.score).toBe(1);
    });
  });

  describe("SyntaxVerifier", () => {
    const verifier = new SyntaxVerifier();

    it("should return valid for correct JS syntax", async () => {
      const result = await verifier.verify("```js\nconst x = 1;\n```");
      expect(result.valid).toBe(true);
    });

    it("should return invalid for incorrect JS syntax", async () => {
      const result = await verifier.verify("```js\nconst x =\n```");
      expect(result.valid).toBe(false);
      expect(result.feedback).toContain("Syntax error");
    });

    it("should handle content without code blocks by treating it as code", async () => {
      const result = await verifier.verify("const x = 1;");
      expect(result.valid).toBe(true);
    });
  });

  describe("ExecutionVerifier", () => {
    const mockRegistry = {
      call: vi.fn(),
    } as unknown as ToolRegistry;
    const verifier = new ExecutionVerifier(mockRegistry);

    it("should return valid if tool execution succeeds", async () => {
      vi.mocked(mockRegistry.call).mockResolvedValueOnce({
        success: true,
        output: "ok",
        duration_ms: 10,
      });
      const result = await verifier.verify("```js\nconsole.log(1);\n```");
      expect(result.valid).toBe(true);
      expect(mockRegistry.call).toHaveBeenCalledWith({
        tool_id: "local_code_execution",
        input: { code: "console.log(1);\n" },
      });
    });

    it("should return invalid if tool execution fails", async () => {
      vi.mocked(mockRegistry.call).mockResolvedValueOnce({
        success: false,
        error: "Execution timeout",
        duration_ms: 10,
      });
      const result = await verifier.verify("```js\nwhile(true);\n```");
      expect(result.valid).toBe(false);
      expect(result.feedback).toContain("Runtime error: Execution timeout");
    });
  });

  describe("VerifierFactory", () => {
    it("should create correct verifiers", () => {
      expect(VerifierFactory.create("null")).toBeInstanceOf(NullVerifier);
      expect(VerifierFactory.create("syntax")).toBeInstanceOf(SyntaxVerifier);

      const mockRegistry = {} as ToolRegistry;
      expect(VerifierFactory.create("execution", mockRegistry)).toBeInstanceOf(ExecutionVerifier);
    });

    it("should throw if execution verifier created without registry", () => {
      expect(() => VerifierFactory.create("execution")).toThrow("ExecutionVerifier requires a ToolRegistry");
    });
  });
});

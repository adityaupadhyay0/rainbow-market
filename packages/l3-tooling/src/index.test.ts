import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ToolRegistry,
  LocalCodeExecutionTool,
  ReadFileTool,
  WriteFileTool,
  DiffFileTool,
  WebFetchTool,
} from "./index";
import { ToolCall } from "@itfs/types";
import fs from "node:fs/promises";
import path from "node:path";

describe("ToolRegistry", () => {
  it("should register and call a local tool", async () => {
    const registry = new ToolRegistry();
    const localTool = new LocalCodeExecutionTool();
    registry.registerTool(localTool);

    const call: ToolCall = {
      tool_id: "local_code_execution",
      input: { code: "1 + 1" },
    };

    const result = await registry.call(call);
    expect(result.success).toBe(true);
    expect(result.output).toBe(2);
  });

  it("should return error if tool not found", async () => {
    const registry = new ToolRegistry();
    const call: ToolCall = {
      tool_id: "non_existent",
      input: {},
    };

    const result = await registry.call(call);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Tool not found");
  });
});

describe("FileSystem Tools", () => {
  const testFile = "test-file.txt";
  const testContent = "Hello, ITFS!";

  afterEach(async () => {
    try {
      await fs.unlink(path.resolve(process.cwd(), testFile));
      await fs.unlink(path.resolve(process.cwd(), "test-file-b.txt"));
    } catch {
      // ignore
    }
  });

  it("WriteFileTool should write a file", async () => {
    const tool = new WriteFileTool();
    const result = await tool.execute({ path: testFile, content: testContent });
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.resolve(process.cwd(), testFile), "utf-8");
    expect(content).toBe(testContent);
  });

  it("ReadFileTool should read a file", async () => {
    await fs.writeFile(path.resolve(process.cwd(), testFile), testContent);
    const tool = new ReadFileTool();
    const result = await tool.execute({ path: testFile });
    expect(result.success).toBe(true);
    expect(result.output).toBe(testContent);
  });

  it("DiffFileTool should return diff", async () => {
    const fileA = testFile;
    const fileB = "test-file-b.txt";
    const contentA = "line1\nline2";
    const contentB = "line1\nline3";
    await fs.writeFile(path.resolve(process.cwd(), fileA), contentA);
    await fs.writeFile(path.resolve(process.cwd(), fileB), contentB);

    const tool = new DiffFileTool();
    const result = await tool.execute({ path_a: fileA, path_b: fileB });
    expect(result.success).toBe(true);
    expect(result.output).toContain("- L2: line2");
    expect(result.output).toContain("+ L2: line3");
  });

  it("should prevent path traversal", async () => {
    const tool = new ReadFileTool();
    const result = await tool.execute({ path: "../package.json" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Access denied");
  });
});

describe("WebFetchTool", () => {
  it("should fetch content", async () => {
    const mockResponse = {
      ok: true,
      text: () => Promise.resolve("mocked content"),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const tool = new WebFetchTool();
    const result = await tool.execute({ url: "https://example.com" });
    expect(result.success).toBe(true);
    expect(result.output).toBe("mocked content");
  });

  it("should handle HTTP errors", async () => {
    const mockResponse = {
      ok: false,
      status: 404,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const tool = new WebFetchTool();
    const result = await tool.execute({ url: "https://example.com/404" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP error! status: 404");
  });
});

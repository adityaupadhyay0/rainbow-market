import { describe, it, expect, vi } from "vitest";
import { RoutingEngine } from "./index.js";
import { ModelAdapter, TaskEnvelope, Message, ModelDelta } from "@itfs/types";

class MockAdapter implements ModelAdapter {
  constructor(public id: string) {}
  complete = vi.fn();
  async *stream(_m: Message[]): AsyncIterable<ModelDelta> { yield {}; }
  async estimateTokens(_m: Message[]): Promise<number> { return 0; }
  async embed(_t: string | string[]): Promise<number[][]> { return [[]]; }
}

describe("RoutingEngine", () => {
  const engine = new RoutingEngine();
  const local = new MockAdapter("local");
  const cloud = new MockAdapter("cloud");

  it("should always route to local when privacy_mode is local_only", () => {
    const envelope: TaskEnvelope = {
      task_id: "1",
      domain: "coding:ai",
      title: "Complex Task",
      description: "Very long description...".repeat(20),
      privacy_mode: "local_only",
      budget: { strategy: "cot", max_tokens: 4000, max_branches: 1, max_depth: 1, max_retries: 0, verifier: "null", on_budget_exceeded: "fail" }
    };

    expect(engine.route(envelope, local, cloud)).toBe(local);
  });

  it("should route complex tasks to cloud when cloud_allowed", () => {
    const envelope: TaskEnvelope = {
      task_id: "2",
      domain: "coding:web",
      title: "Web Task",
      description: "Build a React component",
      privacy_mode: "cloud_allowed",
      budget: { strategy: "cot", max_tokens: 500, max_branches: 1, max_depth: 1, max_retries: 0, verifier: "null", on_budget_exceeded: "fail" }
    };

    // complex because of coding: domain
    expect(engine.route(envelope, local, cloud)).toBe(cloud);
  });

  it("should route simple tasks to local when cloud_allowed", () => {
    const envelope: TaskEnvelope = {
      task_id: "3",
      domain: "general",
      title: "Simple Task",
      description: "Hello world",
      privacy_mode: "cloud_allowed",
      budget: { strategy: "cot", max_tokens: 500, max_branches: 1, max_depth: 1, max_retries: 0, verifier: "null", on_budget_exceeded: "fail" }
    };

    expect(engine.route(envelope, local, cloud)).toBe(local);
  });

  it("should route tasks based on domain in hybrid mode", () => {
    const generalTask: TaskEnvelope = {
      task_id: "4",
      domain: "general",
      title: "General",
      description: "General task",
      privacy_mode: "hybrid",
      budget: { strategy: "cot", max_tokens: 500, max_branches: 1, max_depth: 1, max_retries: 0, verifier: "null", on_budget_exceeded: "fail" }
    };

    const specializedTask: TaskEnvelope = {
      task_id: "5",
      domain: "web:scraping",
      title: "Scraping",
      description: "Scrape a site",
      privacy_mode: "hybrid",
      budget: { strategy: "cot", max_tokens: 500, max_branches: 1, max_depth: 1, max_retries: 0, verifier: "null", on_budget_exceeded: "fail" }
    };

    expect(engine.route(generalTask, local, cloud)).toBe(local);
    expect(engine.route(specializedTask, local, cloud)).toBe(cloud);
  });
});

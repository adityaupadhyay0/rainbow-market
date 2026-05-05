import { describe, it, expect } from "vitest";
import { SessionMemory } from "../memory";

describe("SessionMemory", () => {
  it("should store and retrieve message history", () => {
    const memory = new SessionMemory();
    memory.addMessage("session1", { role: "user", content: "hello" });
    const history = memory.getHistory("session1");
    expect(history).toHaveLength(1);
    expect(history[0].content).toBe("hello");
  });
});

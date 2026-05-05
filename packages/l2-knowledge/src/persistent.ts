import * as fs from "node:fs/promises";
import { Message } from "@itfs/types";

export class PersistentMemory {
  private filePath: string;
  private messages: Map<string, Message[]> = new Map();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load() {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      const json = JSON.parse(data);
      this.messages = new Map(Object.entries(json));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async save() {
    const json = Object.fromEntries(this.messages);
    await fs.writeFile(this.filePath, JSON.stringify(json, null, 2));
  }

  addMessage(sessionId: string, message: Message) {
    const history = this.messages.get(sessionId) || [];
    history.push(message);
    this.messages.set(sessionId, history);
  }

  getHistory(sessionId: string): Message[] {
    return this.messages.get(sessionId) || [];
  }
}

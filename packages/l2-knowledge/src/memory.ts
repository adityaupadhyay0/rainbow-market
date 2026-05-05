import { Message } from "@itfs/types";

export class SessionMemory {
  private messages: Map<string, Message[]> = new Map();

  addMessage(sessionId: string, message: Message) {
    const history = this.messages.get(sessionId) || [];
    history.push(message);
    this.messages.set(sessionId, history);
  }

  getHistory(sessionId: string): Message[] {
    return this.messages.get(sessionId) || [];
  }

  clear(sessionId: string) {
    this.messages.delete(sessionId);
  }
}

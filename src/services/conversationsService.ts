import type { Conversation, Message } from '../types';
import { mockConversations } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let conversations = [...mockConversations];

export const conversationsService = {
  async getAll(): Promise<Conversation[]> {
    await delay(250);
    return [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async getById(id: string): Promise<Conversation | undefined> {
    await delay(150);
    return conversations.find((c) => c.id === id);
  },

  async getByTopic(topic: string): Promise<Conversation[]> {
    await delay(200);
    return conversations.filter((c) => c.topic.toLowerCase().includes(topic.toLowerCase()));
  },

  async search(query: string): Promise<Conversation[]> {
    await delay(250);
    const q = query.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );
  },

  async addMessage(conversationId: string, message: Omit<Message, 'id' | 'createdAt' | 'reactions'>): Promise<Conversation> {
    await delay(300);
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}`,
      createdAt: new Date().toISOString(),
      reactions: [],
    };
    conversations = conversations.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            messages: [...c.messages, newMessage],
            messageCount: c.messageCount + 1,
            updatedAt: new Date().toISOString(),
          }
        : c
    );
    return conversations.find((c) => c.id === conversationId)!;
  },
};

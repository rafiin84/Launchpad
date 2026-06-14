import type { KnowledgeArticle, KnowledgeCategory } from '../types';
import { mockKnowledgeArticles } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let articles = [...mockKnowledgeArticles];

export const knowledgeService = {
  async getAll(): Promise<KnowledgeArticle[]> {
    await delay(250);
    return [...articles].sort((a, b) => b.helpful - a.helpful);
  },

  async getById(id: string): Promise<KnowledgeArticle | undefined> {
    await delay(150);
    return articles.find((a) => a.id === id);
  },

  async getByCategory(category: KnowledgeCategory): Promise<KnowledgeArticle[]> {
    await delay(200);
    return articles.filter((a) => a.category === category);
  },

  async search(query: string): Promise<KnowledgeArticle[]> {
    await delay(250);
    const q = query.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  },

  async markHelpful(id: string): Promise<KnowledgeArticle> {
    await delay(200);
    articles = articles.map((a) => (a.id === id ? { ...a, helpful: a.helpful + 1 } : a));
    return articles.find((a) => a.id === id)!;
  },
};

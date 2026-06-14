import type { Introduction, IntroductionStatus } from '../types';
import { mockIntroductions } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let introductions = [...mockIntroductions];

export const introductionsService = {
  async getAll(): Promise<Introduction[]> {
    await delay(250);
    return [...introductions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getById(id: string): Promise<Introduction | undefined> {
    await delay(150);
    return introductions.find((i) => i.id === id);
  },

  async updateStatus(id: string, status: IntroductionStatus): Promise<Introduction> {
    await delay(300);
    introductions = introductions.map((i) =>
      i.id === id
        ? {
            ...i,
            status,
            ...(status === 'connected' ? { connectedAt: new Date().toISOString() } : {}),
          }
        : i
    );
    return introductions.find((i) => i.id === id)!;
  },

  async create(intro: Omit<Introduction, 'id' | 'createdAt' | 'status'>): Promise<Introduction> {
    await delay(400);
    const newIntro: Introduction = {
      ...intro,
      id: `intro-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    introductions = [newIntro, ...introductions];
    return newIntro;
  },
};

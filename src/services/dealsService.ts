import type { Deal, Application, DealStage } from '../types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let deals: Deal[] = [];
let applications: Application[] = [];

export const dealsService = {
  async getAll(): Promise<Deal[]> {
    await delay(250);
    return [...deals];
  },

  async getById(id: string): Promise<Deal | undefined> {
    await delay(150);
    return deals.find((d) => d.id === id);
  },

  async updateStage(id: string, stage: DealStage): Promise<Deal> {
    await delay(300);
    deals = deals.map((d) => (d.id === id ? { ...d, stage, updatedAt: new Date().toISOString() } : d));
    return deals.find((d) => d.id === id)!;
  },

  async getByStage(stage: DealStage): Promise<Deal[]> {
    await delay(200);
    return deals.filter((d) => d.stage === stage);
  },
};

export const applicationsService = {
  async getAll(): Promise<Application[]> {
    await delay(250);
    return [...applications];
  },

  async getById(id: string): Promise<Application | undefined> {
    await delay(150);
    return applications.find((a) => a.id === id);
  },

  async updateStage(id: string, stage: DealStage): Promise<Application> {
    await delay(300);
    applications = applications.map((a) => (a.id === id ? { ...a, stage } : a));
    return applications.find((a) => a.id === id)!;
  },

  async getByStage(stage: DealStage): Promise<Application[]> {
    await delay(200);
    return applications.filter((a) => a.stage === stage);
  },
};

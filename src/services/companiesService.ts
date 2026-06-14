import type { Company } from '../types';
import { mockCompanies } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const companiesService = {
  async getAll(): Promise<Company[]> {
    await delay(250);
    return [...mockCompanies];
  },

  async getById(id: string): Promise<Company | undefined> {
    await delay(150);
    return mockCompanies.find((c) => c.id === id);
  },

  async search(query: string): Promise<Company[]> {
    await delay(200);
    const q = query.toLowerCase();
    return mockCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );
  },

  async getByIndustry(industry: string): Promise<Company[]> {
    await delay(200);
    return mockCompanies.filter((c) => c.industry.toLowerCase().includes(industry.toLowerCase()));
  },
};

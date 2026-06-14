import type { Investment, Fund } from '../types';
import { mockInvestments, mockFunds } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const investmentsService = {
  async getAll(): Promise<Investment[]> {
    await delay(250);
    return [...mockInvestments];
  },

  async getById(id: string): Promise<Investment | undefined> {
    await delay(150);
    return mockInvestments.find((i) => i.id === id);
  },

  async getByFund(fundId: string): Promise<Investment[]> {
    await delay(200);
    return mockInvestments.filter((i) => i.fund.id === fundId);
  },

  async getPortfolioSummary() {
    await delay(300);
    const investments = mockInvestments.filter((i) => i.status === 'active');
    const totalDeployed = investments.reduce((sum, i) => sum + i.amount, 0);
    const totalCurrentValue = investments.reduce((sum, i) => sum + (i.currentValuation || i.valuation) * (i.ownership / 100), 0);
    const avgMoic = investments.reduce((sum, i) => sum + (i.moic || 1), 0) / investments.length;

    return {
      totalCompanies: investments.length,
      totalDeployed,
      totalCurrentValue,
      avgMoic: Number(avgMoic.toFixed(2)),
    };
  },
};

export const fundsService = {
  async getAll(): Promise<Fund[]> {
    await delay(250);
    return [...mockFunds];
  },

  async getById(id: string): Promise<Fund | undefined> {
    await delay(150);
    return mockFunds.find((f) => f.id === id);
  },

  async getSummary() {
    await delay(200);
    return mockFunds.map((f) => ({
      ...f,
      deploymentPct: Math.round((f.deployedCapital / f.totalCapital) * 100),
      remaining: f.totalCapital - f.deployedCapital,
    }));
  },
};

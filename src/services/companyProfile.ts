/**
 * companyProfile.ts
 *
 * Client-side service for founder company profiles.
 * Saves to CRM via /api/company (admin token on Vercel),
 * with localStorage as local cache and offline fallback.
 */

export interface CompanyData {
  name: string;
  tagline: string;
  description: string;
  website: string;
  industry: string;
  stage: string;
  foundedYear: string;
  location: string;
  founderNames: string;
  teamSize: string;
  openRoles: string;
  productDescription: string;
  mrr: string;
  arr: string;
  activeCustomers: string;
  momGrowth: string;
  churnRate: string;
  nps: string;
  keyMetric: string;
  keyMetricLabel: string;
  totalRaised: string;
  lastRoundSize: string;
  lastRoundStage: string;
  lastRoundDate: string;
  preMoneyValuation: string;
  monthlyBurn: string;
  runway: string;
  revenueModel: string;
  tam: string;
  sam: string;
  som: string;
  targetMarket: string;
  keyCompetitors: string;
  differentiator: string;
  currentAsk: string;
  useOfFunds: string;
  keyRisks: string;
  nextMilestones: string;
}

export const EMPTY: CompanyData = {
  name: '', tagline: '', description: '', website: '', industry: '', stage: '', foundedYear: '', location: '',
  founderNames: '', teamSize: '', openRoles: '',
  productDescription: '', mrr: '', arr: '', activeCustomers: '', momGrowth: '', churnRate: '', nps: '', keyMetric: '', keyMetricLabel: '',
  totalRaised: '', lastRoundSize: '', lastRoundStage: '', lastRoundDate: '', preMoneyValuation: '', monthlyBurn: '', runway: '', revenueModel: '',
  tam: '', sam: '', som: '', targetMarket: '', keyCompetitors: '', differentiator: '',
  currentAsk: '', useOfFunds: '', keyRisks: '', nextMilestones: '',
};

const STORAGE_PREFIX = 'lp_founder_company_';

function storageKey(email: string): string {
  return `${STORAGE_PREFIX}${email.toLowerCase()}`;
}

function loadLocal(email: string): CompanyData {
  if (!email) return EMPTY;
  try {
    const s = localStorage.getItem(storageKey(email));
    if (s) return { ...EMPTY, ...JSON.parse(s) };
  } catch { /* ignore */ }
  return EMPTY;
}

function saveLocal(email: string, d: CompanyData) {
  if (!email) return;
  localStorage.setItem(storageKey(email), JSON.stringify(d));
}

export interface CompanyProfileResult {
  data: CompanyData;
  logo: string | null;
}

export async function fetchCompanyProfile(email: string): Promise<CompanyProfileResult> {
  let crmData: CompanyData | null = null;
  let logo: string | null = null;

  try {
    const res = await fetch(`/api/company?email=${encodeURIComponent(email)}`);
    if (res.ok) {
      const json = await res.json() as { data?: Record<string, unknown>; logo?: string | null };
      if (json.data) {
        crmData = { ...EMPTY, ...(json.data as Partial<CompanyData>) };
        saveLocal(email, crmData);
      }
      logo = json.logo || null;
    }
  } catch (err) {
    console.warn('[CompanyProfile] API fetch failed, using localStorage:', err);
  }

  if (crmData) return { data: crmData, logo };

  const local = loadLocal(email);
  if (local.name) {
    console.log('[CompanyProfile] Auto-syncing local data to CRM for', email);
    syncToCrm(email, local);
  }
  return { data: local, logo: null };
}

function syncToCrm(email: string, data: CompanyData) {
  fetch('/api/company', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, data }),
  }).then(res => {
    console.log('[CompanyProfile] Auto-sync result:', res.ok ? 'success' : res.status);
  }).catch(err => {
    console.warn('[CompanyProfile] Auto-sync failed:', err);
  });
}

export async function fetchAllCompanyProfiles(): Promise<Array<{ email: string; data: CompanyData; logo: string | null }>> {
  try {
    const res = await fetch('/api/company?all=true');
    if (res.ok) {
      const json = await res.json() as { profiles?: Array<{ email: string; data: Record<string, unknown>; logo?: string | null }> };
      return (json.profiles ?? []).map(p => ({
        email: p.email,
        data: { ...EMPTY, ...(p.data as Partial<CompanyData>) },
        logo: p.logo || null,
      }));
    }
  } catch (err) {
    console.warn('[CompanyProfile] API fetch all failed:', err);
  }
  return [];
}

export async function fetchCompanyLogo(email: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/company?email=${encodeURIComponent(email)}&action=getLogo`, {
      method: 'PUT',
    });
    if (!res.ok) return null;
    const json = await res.json() as { logo?: string | null };
    return json.logo || null;
  } catch {
    return null;
  }
}

export async function uploadCompanyLogo(email: string, logoDataUrl: string): Promise<boolean> {
  try {
    const res = await fetch('/api/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, logo: logoDataUrl }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface SaveResult {
  success: boolean;
  crmSynced: boolean;
}

export async function saveCompanyProfile(email: string, data: CompanyData): Promise<SaveResult> {
  saveLocal(email, data);
  window.dispatchEvent(new Event('founder-company-updated'));

  try {
    const res = await fetch('/api/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, data }),
    });
    if (res.ok) {
      return { success: true, crmSynced: true };
    }
    console.warn('[CompanyProfile] API save failed:', res.status);
    return { success: true, crmSynced: false };
  } catch (err) {
    console.warn('[CompanyProfile] API save error:', err);
    return { success: true, crmSynced: false };
  }
}

/**
 * companyProfile.ts
 *
 * Client-side service for founder company profiles.
 * All CRM calls go directly to Zoho via zohoApi.ts — no /api/* server proxy.
 * localStorage is used as local cache and offline fallback.
 */

import { zohoUpsert, zohoSearch, zohoList, zohoUploadRecordPhoto, zohoGetRecordPhoto, portalList, portalSearch, portalUpsert } from './zohoApi';
import { loadRole } from './oauth';

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

// ─── CRM field mapping ───────────────────────────────────────────────────────

// CRM field name → client key
const CRM_TO_CLIENT: Record<string, keyof CompanyData> = {
  Company_Name:        'name',
  Tagline:             'tagline',
  Description:         'description',
  Website:             'website',
  Industry:            'industry',
  Stage:               'stage',
  Founded_Year:        'foundedYear',
  Location:            'location',
  Founder_Names:       'founderNames',
  Team_Size:           'teamSize',
  Open_Roles:          'openRoles',
  Product_Description: 'productDescription',
  MRR:                 'mrr',
  ARR:                 'arr',
  Active_Customers:    'activeCustomers',
  MoM_Growth:          'momGrowth',
  Churn_Rate:          'churnRate',
  NPS:                 'nps',
  Key_Metric:          'keyMetric',
  Key_Metric_Label:    'keyMetricLabel',
  Total_Raised:        'totalRaised',
  Last_Round_Size:     'lastRoundSize',
  Last_Round_Stage:    'lastRoundStage',
  Last_Round_Date:     'lastRoundDate',
  Pre_Money_Valuation: 'preMoneyValuation',
  Monthly_Burn:        'monthlyBurn',
  Runway:              'runway',
  Revenue_Model:       'revenueModel',
  TAM:                 'tam',
  SAM:                 'sam',
  SOM:                 'som',
  Target_Market:       'targetMarket',
  Key_Competitors:     'keyCompetitors',
  Differentiator:      'differentiator',
  Current_Ask:         'currentAsk',
  Use_of_Funds:        'useOfFunds',
  Key_Risks:           'keyRisks',
  Next_Milestones:     'nextMilestones',
};

// All CRM field names for list queries
const ALL_CRM_FIELDS = ['Email', ...Object.keys(CRM_TO_CLIENT)].join(',');

// client key → CRM field name (reverse map)
const CLIENT_TO_CRM: Record<string, string> = {};
for (const [crmKey, clientKey] of Object.entries(CRM_TO_CLIENT)) {
  CLIENT_TO_CRM[clientKey] = crmKey;
}

function crmRecordToData(record: Record<string, unknown>): CompanyData {
  const data: CompanyData = { ...EMPTY };
  for (const [crmKey, clientKey] of Object.entries(CRM_TO_CLIENT)) {
    const val = record[crmKey];
    if (val != null) {
      data[clientKey] = String(val);
    }
  }
  return data;
}

function dataToCrmPayload(data: CompanyData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [clientKey, crmKey] of Object.entries(CLIENT_TO_CRM)) {
    const val = data[clientKey as keyof CompanyData];
    if (val !== undefined) {
      payload[crmKey] = val;
    }
  }
  return payload;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

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

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CompanyProfileResult {
  data: CompanyData;
  logo: string | null;
}

export interface SaveResult {
  success: boolean;
  crmSynced: boolean;
}

function isFounder(): boolean {
  return loadRole() === 'founder';
}

async function searchFounders(email: string): Promise<import('./zohoApi').ZohoRecord[]> {
  if (isFounder()) {
    // Portal tokens only work on zcrmportals.in.
    // portalList returns the portal user's own records automatically — no email filter needed.
    try {
      const records = await portalList('Founders', { per_page: '1', fields: ALL_CRM_FIELDS });
      if (records.length > 0) return records;
    } catch { /* try search next */ }
    // Fallback: portal search with explicit email criteria
    try {
      const records = await portalSearch('Founders', `(Email:equals:${email})`);
      if (records.length > 0) return records;
    } catch { /* fall through */ }
    return [];
  }
  // Investors use standard CRM domain
  return zohoSearch('Founders', `(Email:equals:${email})`);
}

async function upsertFounder(payload: Record<string, unknown>): Promise<void> {
  if (isFounder()) {
    try {
      await portalUpsert('Founders', payload, ['Email']);
      return;
    } catch { /* fall through */ }
  }
  await zohoUpsert('Founders', payload, ['Email']);
}

// ─── Internal sync ─────────────────────────────────────────────────────────────

function syncToCrm(email: string, data: CompanyData): void {
  const payload = { ...dataToCrmPayload(data), Email: email };
  upsertFounder(payload).then(() => {
    console.log('[CompanyProfile] Auto-sync done');
  }).catch(err => {
    console.warn('[CompanyProfile] Auto-sync failed:', err);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchCompanyProfile(email: string): Promise<CompanyProfileResult> {
  let crmData: CompanyData | null = null;
  let logo: string | null = null;

  try {
    const records = await searchFounders(email);
    if (records.length > 0) {
      const record = records[0];
      crmData = crmRecordToData(record as Record<string, unknown>);
      saveLocal(email, crmData);

      try {
        logo = await zohoGetRecordPhoto('Founders', record.id);
      } catch { /* no logo */ }
    }
  } catch (err) {
    console.warn('[CompanyProfile] CRM fetch failed, using localStorage:', err);
  }

  if (crmData) return { data: crmData, logo };

  const local = loadLocal(email);
  if (local.name) {
    console.log('[CompanyProfile] Auto-syncing local data to CRM for', email);
    syncToCrm(email, local);
  }
  return { data: local, logo: null };
}

export async function saveCompanyProfile(email: string, data: CompanyData): Promise<SaveResult> {
  saveLocal(email, data);
  window.dispatchEvent(new Event('founder-company-updated'));

  try {
    const payload = { ...dataToCrmPayload(data), Email: email };
    await upsertFounder(payload);
    return { success: true, crmSynced: true };
  } catch (err) {
    console.warn('[CompanyProfile] CRM save error:', err);
    return { success: true, crmSynced: false };
  }
}

export async function fetchAllCompanyProfiles(): Promise<Array<{ email: string; data: CompanyData; logo: string | null }>> {
  try {
    const records = await zohoList('Founders', {
      per_page: '200',
      sort_by: 'Modified_Time',
      sort_order: 'desc',
      fields: ALL_CRM_FIELDS,
    });

    const results = await Promise.all(records.map(async record => {
      const r = record as Record<string, unknown>;
      const email = String(r.Email || '');
      const data = crmRecordToData(r);
      let logo: string | null = null;
      try {
        logo = await zohoGetRecordPhoto('Founders', record.id);
      } catch { /* no logo */ }
      return { email, data, logo };
    }));

    return results;
  } catch (err) {
    console.warn('[CompanyProfile] CRM fetch all failed:', err);
    return [];
  }
}

export async function fetchCompanyLogo(email: string): Promise<string | null> {
  try {
    const records = await zohoSearch('Founders', `(Email:equals:${email})`);
    if (!records.length) return null;
    return await zohoGetRecordPhoto('Founders', records[0].id);
  } catch {
    return null;
  }
}

export async function uploadCompanyLogo(email: string, logoDataUrl: string): Promise<boolean> {
  try {
    const records = await zohoSearch('Founders', `(Email:equals:${email})`);
    if (!records.length) return false;

    const recordId = records[0].id;

    // Convert dataUrl to Blob
    const [meta, base64] = logoDataUrl.split(',');
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });

    await zohoUploadRecordPhoto('Founders', recordId, blob, 'logo.jpg');
    return true;
  } catch (err) {
    console.warn('[CompanyProfile] Logo upload failed:', err);
    return false;
  }
}

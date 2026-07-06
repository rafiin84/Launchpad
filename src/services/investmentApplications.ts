/**
 * investmentApplications.ts
 *
 * Hybrid service for investment applications:
 * - Investors (CRM users): read/write directly from Zoho CRM via client-side tokens
 * - Founders (portal users): read/write via /api/applications serverless proxy
 *   which uses admin refresh token to access CRM on their behalf
 *
 * All public functions are async to support CRM/API calls.
 */

import { zohoList, zohoGetById, zohoCreate, zohoUpdate, zohoDelete, zohoSearch, type ZohoRecord } from './zohoApi';

const STORAGE_KEY = 'lp_investment_applications';
const MAX_APPLICATIONS = 200;
const CRM_MODULE = 'Applications';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'interested'
  | 'more_info_requested'
  | 'documents_requested'
  | 'shortlisted'
  | 'meeting_scheduled'
  | 'due_diligence'
  | 'on_hold'
  | 'approved'
  | 'invested'
  | 'rejected';

export interface InvestmentApplication {
  id: string;
  status: ApplicationStatus;

  // Company Information
  companyName: string;
  companyWebsite: string;
  companyIndustry: string;
  companyStage: string;
  companyLocation: string;
  foundedYear: string;
  companyDescription: string;

  // Founder Details
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderLinkedin: string;
  founderRole: string;
  coFounders: string;

  // Business Overview
  problemStatement: string;
  solution: string;
  targetMarket: string;
  businessModel: string;
  competitiveAdvantage: string;

  // Funding Requirements
  fundingAsk: string;
  useOfFunds: string;
  previousFunding: string;
  currentValuation: string;
  equityOffered: string;

  // Financial Information
  currentRevenue: string;
  mrr: string;
  arr: string;
  monthlyBurn: string;
  runway: string;

  // Traction Metrics
  activeUsers: string;
  momGrowth: string;
  churnRate: string;
  nps: string;
  keyMetric: string;
  keyMetricLabel: string;

  // Media & Documents
  pitchDeckUrl: string;
  pitchDeckName: string;
  demoVideoUrl: string;
  supportingDocs: string;

  // Metadata
  submittedBy: string;
  submittedByEmail: string;
  submittedByRole: 'investor' | 'founder';
  submittedAt: string;
  updatedAt: string;

  // Investor notes (only investors write these)
  investorNotes: string;
  reviewedBy: string;
  reviewedAt: string;
}

export type InvestmentApplicationFields = Omit<InvestmentApplication, 'id' | 'submittedAt' | 'updatedAt'>;

// ─── CRM ↔ App field mapping ───────────────────────────────────────────────

const FIELD_MAP: Record<keyof Omit<InvestmentApplication, 'id' | 'submittedAt' | 'updatedAt'>, string> = {
  status:              'Application_Status',
  companyName:         'Name',
  companyWebsite:      'Website',
  companyIndustry:     'Industry',
  companyStage:        'Company_Stage',
  companyLocation:     'Location',
  foundedYear:         'Founded_Year',
  companyDescription:  'Company_Description',
  founderName:         'Founder_Name',
  founderEmail:        'Founder_Email',
  founderPhone:        'Founder_Phone',
  founderLinkedin:     'Founder_LinkedIn',
  founderRole:         'Founder_Role',
  coFounders:          'Co_Founders',
  problemStatement:    'Problem_Statement',
  solution:            'Solution',
  targetMarket:        'Target_Market',
  businessModel:       'Business_Model',
  competitiveAdvantage:'Competitive_Advantage',
  fundingAsk:          'Funding_Ask',
  useOfFunds:          'Use_of_Funds',
  previousFunding:     'Previous_Funding',
  currentValuation:    'Current_Valuation',
  equityOffered:       'Equity_Offered',
  currentRevenue:      'Current_Revenue',
  mrr:                 'MRR',
  arr:                 'ARR',
  monthlyBurn:         'Monthly_Burn',
  runway:              'Runway_Months',
  activeUsers:         'Active_Users',
  momGrowth:           'MoM_Growth',
  churnRate:           'Churn_Rate',
  nps:                 'NPS_Score',
  keyMetric:           'Key_Metric',
  keyMetricLabel:      'Key_Metric_Label',
  pitchDeckUrl:        'Pitch_Deck_URL',
  pitchDeckName:       'Pitch_Deck_Name',
  demoVideoUrl:        'Demo_Video_URL',
  supportingDocs:      'Supporting_Docs',
  submittedBy:         'Submitted_By_Name',
  submittedByEmail:    'Submitted_By_Email',
  submittedByRole:     'Submitted_By_Role',
  investorNotes:       'Investor_Notes',
  reviewedBy:          'Reviewed_By',
  reviewedAt:          'Reviewed_At',
};

/** Currency fields in CRM — values must be sent as numbers */
const CURRENCY_FIELDS = new Set([
  'fundingAsk', 'previousFunding', 'currentValuation',
  'currentRevenue', 'mrr', 'arr', 'monthlyBurn',
]);

/** Integer fields in CRM */
const INTEGER_FIELDS = new Set(['foundedYear']);

function toCrmPayload(app: Partial<InvestmentApplication>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [appKey, crmKey] of Object.entries(FIELD_MAP)) {
    const val = (app as Record<string, unknown>)[appKey];
    if (val === undefined || val === null || val === '') continue;
    const strVal = String(val);

    if (CURRENCY_FIELDS.has(appKey)) {
      const n = parseFloat(strVal.replace(/[,$]/g, ''));
      if (!isNaN(n)) payload[crmKey] = n;
    } else if (INTEGER_FIELDS.has(appKey)) {
      const n = parseInt(strVal, 10);
      if (!isNaN(n)) payload[crmKey] = n;
    } else {
      payload[crmKey] = strVal;
    }
  }
  return payload;
}

function fromCrmRecord(r: ZohoRecord): InvestmentApplication {
  const str = (crmKey: string): string => {
    const v = r[crmKey];
    if (v === null || v === undefined) return '';
    return String(v);
  };

  return {
    id:                 r.id,
    status:             (str('Application_Status') || 'submitted') as ApplicationStatus,
    companyName:        str('Name'),
    companyWebsite:     str('Website'),
    companyIndustry:    str('Industry'),
    companyStage:       str('Company_Stage'),
    companyLocation:    str('Location'),
    foundedYear:        str('Founded_Year'),
    companyDescription: str('Company_Description'),
    founderName:        str('Founder_Name'),
    founderEmail:       str('Founder_Email'),
    founderPhone:       str('Founder_Phone'),
    founderLinkedin:    str('Founder_LinkedIn'),
    founderRole:        str('Founder_Role'),
    coFounders:         str('Co_Founders'),
    problemStatement:   str('Problem_Statement'),
    solution:           str('Solution'),
    targetMarket:       str('Target_Market'),
    businessModel:      str('Business_Model'),
    competitiveAdvantage: str('Competitive_Advantage'),
    fundingAsk:         str('Funding_Ask'),
    useOfFunds:         str('Use_of_Funds'),
    previousFunding:    str('Previous_Funding'),
    currentValuation:   str('Current_Valuation'),
    equityOffered:      str('Equity_Offered'),
    currentRevenue:     str('Current_Revenue'),
    mrr:                str('MRR'),
    arr:                str('ARR'),
    monthlyBurn:        str('Monthly_Burn'),
    runway:             str('Runway_Months'),
    activeUsers:        str('Active_Users'),
    momGrowth:          str('MoM_Growth'),
    churnRate:          str('Churn_Rate'),
    nps:                str('NPS_Score'),
    keyMetric:          str('Key_Metric'),
    keyMetricLabel:     str('Key_Metric_Label'),
    pitchDeckUrl:       str('Pitch_Deck_URL'),
    pitchDeckName:      str('Pitch_Deck_Name'),
    demoVideoUrl:       str('Demo_Video_URL'),
    supportingDocs:     str('Supporting_Docs'),
    submittedBy:        str('Submitted_By_Name'),
    submittedByEmail:   str('Submitted_By_Email'),
    submittedByRole:    (str('Submitted_By_Role') || 'founder') as 'investor' | 'founder',
    submittedAt:        str('Created_Time'),
    updatedAt:          str('Modified_Time'),
    investorNotes:      str('Investor_Notes'),
    reviewedBy:         str('Reviewed_By'),
    reviewedAt:         str('Reviewed_At'),
  };
}

// ─── localStorage helpers (for draft saving only) ──────────────────────────

function loadLocalDrafts(): InvestmentApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: InvestmentApplication[] = JSON.parse(raw);
    return all.filter(a => a.status === 'draft');
  } catch { return []; }
}

function loadLocal(): InvestmentApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveLocal(apps: InvestmentApplication[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps.slice(0, MAX_APPLICATIONS)));
  } catch { /* storage full */ }
}

function generateLocalId(): string {
  return `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Server proxy API (for founders — uses admin token server-side) ────────

interface ProxyListResponse {
  data?: ZohoRecord[];
  info?: { more_records: boolean };
  code?: string;
  message?: string;
}

interface ProxyCUDResponse {
  data?: Array<{ code: string; status: string; message: string; details: { id: string } }>;
  code?: string;
  message?: string;
}

async function proxyGetAll(): Promise<InvestmentApplication[]> {
  try {
    const res = await fetch('/api/applications');
    if (res.status === 204) return [];
    const json: ProxyListResponse = await res.json();
    if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
    return (json.data ?? []).map(fromCrmRecord);
  } catch (err) {
    console.warn('[proxyGetAll] Failed, falling back to local:', err);
    return loadLocal();
  }
}

async function proxyGetById(id: string): Promise<InvestmentApplication | null> {
  try {
    const res = await fetch(`/api/applications?id=${encodeURIComponent(id)}`);
    if (res.status === 204 || res.status === 404) return null;
    const json: ProxyListResponse = await res.json();
    if (!res.ok) return null;
    const record = json.data?.[0];
    return record ? fromCrmRecord(record) : null;
  } catch {
    return null;
  }
}

async function proxyCreate(payload: Record<string, unknown>): Promise<string> {
  const res = await fetch('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [payload] }),
  });
  const json: ProxyCUDResponse = await res.json();
  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') {
    throw new Error(result?.message || json.message || 'Create failed');
  }
  return result.details.id;
}

async function proxyUpdate(id: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/applications?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{ id, ...payload }] }),
  });
  const json: ProxyCUDResponse = await res.json();
  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') {
    throw new Error(result?.message || json.message || 'Update failed');
  }
}

async function proxyDelete(id: string): Promise<void> {
  const res = await fetch(`/api/applications?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(json.message || `Delete failed: ${res.status}`);
  }
}

// ─── CRM direct API (for investors with client-side tokens) ────────────────

async function crmGetAll(): Promise<InvestmentApplication[]> {
  try {
    const records = await zohoList(CRM_MODULE, {
      per_page: '200',
      sort_by: 'Modified_Time',
      sort_order: 'desc',
    });
    return records.map(fromCrmRecord);
  } catch {
    return [];
  }
}

async function crmGetById(id: string): Promise<InvestmentApplication | null> {
  try {
    const r = await zohoGetById(CRM_MODULE, id);
    return r ? fromCrmRecord(r) : null;
  } catch {
    return null;
  }
}

async function crmCreate(fields: InvestmentApplicationFields): Promise<InvestmentApplication> {
  const now = new Date().toISOString();
  const payload = toCrmPayload(fields);
  const crmId = await zohoCreate(CRM_MODULE, payload);
  return { ...fields, id: crmId, submittedAt: now, updatedAt: now };
}

async function crmUpdate(id: string, updates: Partial<InvestmentApplication>): Promise<InvestmentApplication | null> {
  const payload = toCrmPayload(updates);
  await zohoUpdate(CRM_MODULE, id, payload);
  return crmGetById(id);
}

async function crmDeleteApp(id: string): Promise<void> {
  try {
    await zohoDelete(CRM_MODULE, id);
  } catch { /* silent */ }
}

// ─── Public API (unified) ──────────────────────────────────────────────────
// The `isInvestor` parameter determines the data path:
//   - Investors: direct CRM API with client-side tokens
//   - Founders: /api/applications serverless proxy (admin token server-side)
//     + localStorage for drafts only

/**
 * Fetch all applications.
 * Investors: direct CRM (all applications).
 * Founders: server proxy filtered to the founder's own email + local drafts.
 */
export async function getApplications(isInvestor: boolean, founderEmail?: string): Promise<InvestmentApplication[]> {
  if (isInvestor) {
    return crmGetAll();
  }

  // Founder: fetch from server proxy (CRM via admin token) + merge local drafts
  const [serverApps, localDrafts] = await Promise.all([
    proxyGetAll(),
    Promise.resolve(loadLocalDrafts()),
  ]);

  // Filter to only this founder's applications
  const email = founderEmail?.toLowerCase();
  const myServerApps = email
    ? serverApps.filter(a =>
        a.founderEmail?.toLowerCase() === email ||
        a.submittedByEmail?.toLowerCase() === email
      )
    : serverApps;

  const myLocalDrafts = email
    ? localDrafts.filter(d =>
        d.founderEmail?.toLowerCase() === email ||
        d.submittedByEmail?.toLowerCase() === email ||
        !d.founderEmail // drafts with no email yet belong to current user
      )
    : localDrafts;

  // Merge: server apps + any local-only drafts (not yet in CRM)
  const serverIds = new Set(myServerApps.map(a => a.id));
  const uniqueDrafts = myLocalDrafts.filter(d => !serverIds.has(d.id));
  const all = [...uniqueDrafts, ...myServerApps];

  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Check if a founder can submit a new application.
 * Rules:
 *  - First application: always allowed
 *  - If rejected: one re-apply allowed
 *  - If approved/active: no new application
 *  - Max 1 re-apply total (2 submitted apps max)
 */
export function canApplyAgain(applications: InvestmentApplication[]): boolean {
  const submitted = applications.filter(a => a.status !== 'draft');
  if (submitted.length === 0) return true;
  if (submitted.length === 1 && submitted[0].status === 'rejected') return true;
  return false;
}

/** Fetch a single application by ID. */
export async function getApplicationById(id: string, isInvestor: boolean): Promise<InvestmentApplication | null> {
  if (isInvestor) {
    return crmGetById(id);
  }

  // Founder: check local drafts first, then server
  const local = loadLocal().find(a => a.id === id);
  if (local) return local;
  return proxyGetById(id);
}

/** Fetch applications by status. */
export async function getApplicationsByStatus(status: ApplicationStatus, isInvestor: boolean): Promise<InvestmentApplication[]> {
  if (isInvestor) {
    try {
      const records = await zohoSearch(CRM_MODULE, `(Application_Status:equals:${status})`);
      return records.map(fromCrmRecord);
    } catch {
      const all = await crmGetAll();
      return all.filter(a => a.status === status);
    }
  }

  const all = await getApplications(false);
  return all.filter(a => a.status === status);
}

/** Fetch applications by founder email. */
export async function getApplicationsByFounder(email: string, isInvestor: boolean): Promise<InvestmentApplication[]> {
  if (isInvestor) {
    try {
      const records = await zohoSearch(CRM_MODULE, `(Founder_Email:equals:${email})`);
      return records.map(fromCrmRecord);
    } catch {
      const all = await crmGetAll();
      return all.filter(a => a.founderEmail === email || a.submittedByEmail === email);
    }
  }

  const all = await getApplications(false);
  return all.filter(a => a.founderEmail === email || a.submittedByEmail === email);
}

/**
 * Create a new investment application.
 * Investors: creates directly in CRM via client-side token.
 * Founders: drafts saved locally; submitted apps go to CRM via server proxy.
 */
export async function createApplication(fields: InvestmentApplicationFields, isInvestor: boolean): Promise<InvestmentApplication> {
  if (isInvestor) {
    return crmCreate(fields);
  }

  const now = new Date().toISOString();

  // Founder: drafts stay in localStorage only
  if (fields.status === 'draft') {
    const app: InvestmentApplication = {
      ...fields,
      id: generateLocalId(),
      submittedAt: now,
      updatedAt: now,
    };
    const existing = loadLocal();
    saveLocal([app, ...existing]);
    return app;
  }

  // Founder submitting: write to CRM via server proxy
  try {
    const payload = toCrmPayload(fields);
    const crmId = await proxyCreate(payload);
    return { ...fields, id: crmId, submittedAt: now, updatedAt: now };
  } catch (err) {
    // Fallback: save locally if server is unreachable
    console.warn('Server proxy create failed, saving locally:', err);
    const app: InvestmentApplication = {
      ...fields,
      id: generateLocalId(),
      submittedAt: now,
      updatedAt: now,
    };
    const existing = loadLocal();
    saveLocal([app, ...existing]);
    return app;
  }
}

/**
 * Update an existing application.
 * Investors: updates in CRM. Founders: drafts updated locally, others via server proxy.
 */
export async function updateApplication(
  id: string,
  updates: Partial<InvestmentApplication>,
  isInvestor: boolean
): Promise<InvestmentApplication | null> {
  if (isInvestor) {
    return crmUpdate(id, updates);
  }

  // Founder: check if this is a local draft
  const localApps = loadLocal();
  const localIdx = localApps.findIndex(a => a.id === id);

  // If it's a local draft being submitted, create in CRM instead of updating
  if (localIdx !== -1 && localApps[localIdx].status === 'draft' && updates.status && updates.status !== 'draft') {
    const merged = { ...localApps[localIdx], ...updates, updatedAt: new Date().toISOString() };
    try {
      const payload = toCrmPayload(merged);
      const crmId = await proxyCreate(payload);
      // Remove from local drafts
      localApps.splice(localIdx, 1);
      saveLocal(localApps);
      return { ...merged, id: crmId };
    } catch (err) {
      console.warn('Server proxy submit failed:', err);
      // Update locally as fallback
      localApps[localIdx] = { ...merged, id };
      saveLocal(localApps);
      return localApps[localIdx];
    }
  }

  // If it's a local draft staying as draft, update locally
  if (localIdx !== -1) {
    const updated: InvestmentApplication = {
      ...localApps[localIdx],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    localApps[localIdx] = updated;
    saveLocal(localApps);
    return updated;
  }

  // It's a CRM record — update via server proxy
  try {
    const payload = toCrmPayload(updates);
    await proxyUpdate(id, payload);
    return proxyGetById(id);
  } catch {
    return null;
  }
}

/**
 * Update the status of an application (typically by investor).
 */
export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  reviewerName?: string,
  isInvestor = true
): Promise<InvestmentApplication | null> {
  const updates: Partial<InvestmentApplication> = { status };

  if (reviewerName) {
    updates.reviewedBy = reviewerName;
    updates.reviewedAt = new Date().toISOString();
  }

  return updateApplication(id, updates, isInvestor);
}

/**
 * Approve an application: set status to 'approved' and create a Portfolio record
 * so the founder appears on the Founders page.
 */
export async function approveApplication(
  id: string,
  reviewerName: string,
  isInvestor: boolean,
): Promise<InvestmentApplication | null> {
  const app = await getApplicationById(id, isInvestor);
  if (!app) return null;

  // 1. Update status to approved
  const updated = await updateApplicationStatus(id, 'approved', reviewerName, isInvestor);

  // 2. Create a Portfolio record from the application data
  if (isInvestor) {
    try {
      const { createCRMPortfolioRecord } = await import('./crmPortfolio');
      await createCRMPortfolioRecord({
        companyName: app.companyName,
        website: app.companyWebsite,
        location: app.companyLocation,
        industry: app.companyIndustry,
        stage: app.companyStage,
        foundedYear: app.foundedYear,
        teamSize: '',
        shortDescription: app.companyDescription?.slice(0, 200) || '',
        fullDescription: app.companyDescription,
        tags: app.companyIndustry,
        investmentAmount: app.fundingAsk,
        investmentDate: new Date().toISOString().split('T')[0],
        preMoneyValuation: app.currentValuation,
        ownershipPct: app.equityOffered,
        status: 'Active',
        notes: `Approved from application. Reviewed by ${reviewerName}.`,
        founderName: app.founderName,
        founderEmail: app.founderEmail,
        founderLinkedin: app.founderLinkedin,
        founderPhone: app.founderPhone,
      });
    } catch (err) {
      console.error('[approveApplication] Failed to create portfolio record:', err);
    }
  }

  return updated;
}

/** Delete an application. */
export async function deleteApplication(id: string, isInvestor: boolean): Promise<void> {
  if (isInvestor) {
    return crmDeleteApp(id);
  }

  // Founder: remove local draft if exists
  const all = loadLocal();
  const filtered = all.filter(a => a.id !== id);
  if (filtered.length !== all.length) {
    saveLocal(filtered);
  }

  // Also delete from CRM via server proxy
  try {
    await proxyDelete(id);
  } catch { /* silent — may not exist in CRM */ }
}

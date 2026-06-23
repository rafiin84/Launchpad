/**
 * investmentApplications.ts
 *
 * Hybrid service for investment applications:
 * - Investors (CRM users): read/write directly from Zoho CRM Applications module
 * - Founders (portal users): write to localStorage, synced to CRM when investor logs in
 *
 * All public functions are async to support CRM API calls.
 */

import { zohoList, zohoGetById, zohoCreate, zohoUpdate, zohoDelete, zohoSearch, type ZohoRecord } from './zohoApi';

const STORAGE_KEY = 'lp_investment_applications';
const SYNC_KEY = 'lp_investment_apps_pending_sync';
const MAX_APPLICATIONS = 200;
const CRM_MODULE = 'Applications';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'interested'
  | 'more_info_requested'
  | 'shortlisted'
  | 'meeting_scheduled'
  | 'due_diligence'
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

// ─── localStorage helpers (for founders / fallback) ────────────────────────

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

/** Mark an app ID as needing sync to CRM */
function markPendingSync(localId: string) {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(localId)) ids.push(localId);
    localStorage.setItem(SYNC_KEY, JSON.stringify(ids));
  } catch { /* ok */ }
}

function clearPendingSync(localId: string) {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    localStorage.setItem(SYNC_KEY, JSON.stringify(ids.filter(id => id !== localId)));
  } catch { /* ok */ }
}

function getPendingSyncIds(): string[] {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ─── CRM-backed API (for investors) ────────────────────────────────────────

async function crmGetAll(): Promise<InvestmentApplication[]> {
  try {
    const records = await zohoList(CRM_MODULE, {
      per_page: '200',
      sort_by: 'Modified_Time',
      sort_order: 'desc',
    });
    return records.map(fromCrmRecord);
  } catch {
    // Fallback to localStorage if CRM fails
    return loadLocal();
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

  try {
    const crmId = await zohoCreate(CRM_MODULE, payload);
    return {
      ...fields,
      id: crmId,
      submittedAt: now,
      updatedAt: now,
    };
  } catch (err) {
    // Fallback: save to localStorage
    console.warn('CRM create failed, saving locally:', err);
    const app: InvestmentApplication = {
      ...fields,
      id: generateLocalId(),
      submittedAt: now,
      updatedAt: now,
    };
    const existing = loadLocal();
    saveLocal([app, ...existing]);
    markPendingSync(app.id);
    return app;
  }
}

async function crmUpdate(id: string, updates: Partial<InvestmentApplication>): Promise<InvestmentApplication | null> {
  const payload = toCrmPayload(updates);

  try {
    await zohoUpdate(CRM_MODULE, id, payload);
    // Re-fetch to get the full updated record
    return crmGetById(id);
  } catch {
    return null;
  }
}

async function crmDeleteApp(id: string): Promise<void> {
  try {
    await zohoDelete(CRM_MODULE, id);
  } catch {
    // silent fail
  }
}

// ─── Sync: push founder localStorage apps to CRM ──────────────────────────

/**
 * Called when an investor logs in. Pushes any pending founder-submitted
 * applications from localStorage into CRM, then cleans up localStorage.
 */
export async function syncPendingApplicationsToCRM(): Promise<number> {
  const pendingIds = getPendingSyncIds();
  if (pendingIds.length === 0) return 0;

  const localApps = loadLocal();
  let synced = 0;

  for (const localId of pendingIds) {
    const app = localApps.find(a => a.id === localId);
    if (!app) {
      clearPendingSync(localId);
      continue;
    }

    // Skip drafts — only sync submitted+ applications
    if (app.status === 'draft') continue;

    try {
      const payload = toCrmPayload(app);
      const crmId = await zohoCreate(CRM_MODULE, payload);

      // Replace local ID with CRM ID in localStorage
      const idx = localApps.findIndex(a => a.id === localId);
      if (idx !== -1) {
        localApps[idx] = { ...localApps[idx], id: crmId };
      }

      clearPendingSync(localId);
      synced++;
    } catch (err) {
      console.warn(`Failed to sync application ${localId} to CRM:`, err);
    }
  }

  // Update localStorage with new CRM IDs
  saveLocal(localApps);
  return synced;
}

// ─── Public API (unified) ──────────────────────────────────────────────────
// The `isInvestor` parameter determines whether to use CRM or localStorage.
// Pages pass this from their auth context.

/** Fetch all applications. Investors get CRM data; founders get localStorage. */
export async function getApplications(isInvestor: boolean): Promise<InvestmentApplication[]> {
  if (isInvestor) {
    // First sync any pending founder submissions
    await syncPendingApplicationsToCRM();
    return crmGetAll();
  }
  // Founder: localStorage only
  const all = loadLocal();
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Fetch a single application by ID. */
export async function getApplicationById(id: string, isInvestor: boolean): Promise<InvestmentApplication | null> {
  if (isInvestor) {
    return crmGetById(id);
  }
  const all = loadLocal();
  return all.find(a => a.id === id) ?? null;
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
  const all = loadLocal();
  return all
    .filter(a => a.status === status)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
  const all = loadLocal();
  return all
    .filter(a => a.founderEmail === email || a.submittedByEmail === email)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Create a new investment application.
 * Investors: creates directly in CRM.
 * Founders: saves to localStorage and marks for CRM sync.
 */
export async function createApplication(fields: InvestmentApplicationFields, isInvestor: boolean): Promise<InvestmentApplication> {
  if (isInvestor) {
    return crmCreate(fields);
  }

  // Founder: save to localStorage + mark for sync
  const now = new Date().toISOString();
  const app: InvestmentApplication = {
    ...fields,
    id: generateLocalId(),
    submittedAt: now,
    updatedAt: now,
  };

  const existing = loadLocal();
  saveLocal([app, ...existing]);

  // Mark non-draft apps for sync to CRM
  if (app.status !== 'draft') {
    markPendingSync(app.id);
  }

  return app;
}

/**
 * Update an existing application.
 * Investors: updates in CRM. Founders: updates in localStorage.
 */
export async function updateApplication(
  id: string,
  updates: Partial<InvestmentApplication>,
  isInvestor: boolean
): Promise<InvestmentApplication | null> {
  if (isInvestor) {
    return crmUpdate(id, updates);
  }

  // Founder: update in localStorage
  const all = loadLocal();
  const index = all.findIndex(a => a.id === id);
  if (index === -1) return null;

  const updated: InvestmentApplication = {
    ...all[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  saveLocal(all);

  // If status changed from draft to submitted, mark for sync
  if (updated.status !== 'draft') {
    markPendingSync(id);
  }

  return updated;
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

/** Delete an application. */
export async function deleteApplication(id: string, isInvestor: boolean): Promise<void> {
  if (isInvestor) {
    return crmDeleteApp(id);
  }

  // Founder: remove from localStorage
  const all = loadLocal();
  const filtered = all.filter(a => a.id !== id);
  saveLocal(filtered);
  clearPendingSync(id);
}

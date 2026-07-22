/**
 * investmentApplications.ts
 *
 * Client-only service for investment applications.
 * All reads/writes go directly to Zoho CRM via client-side tokens.
 * Drafts are saved to localStorage only.
 */

import { zohoList, zohoGetById, zohoCreate, zohoUpdate, zohoDelete, zohoSearch, portalCreate, portalUpdate, portalCoql, type ZohoRecord } from './zohoApi';
import { loadRole, loadPortalLoginEmail } from './oauth';
import { loadPortalSession } from './portalUsers';

function isFounder(): boolean { return loadRole() === 'founder'; }

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

  // Requested documents (JSON string)
  requestedDocuments: string;

  // Meeting details
  meetingDate: string;
  meetingLocation: string;
  meetingLink: string;
  meetingAgenda: string;
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
  requestedDocuments:  'Requested_Documents',
  meetingDate:         'Meeting_Date',
  meetingLocation:     'Meeting_Location',
  meetingLink:         'Meeting_Link',
  meetingAgenda:       'Meeting_Agenda',
};

/** Currency fields in CRM — values must be sent as numbers */
const CURRENCY_FIELDS = new Set([
  'fundingAsk', 'previousFunding', 'currentValuation',
  'currentRevenue', 'mrr', 'arr', 'monthlyBurn',
]);

/** Integer fields in CRM */
const INTEGER_FIELDS = new Set(['foundedYear']);

/** Datetime fields in CRM — Zoho requires YYYY-MM-DDTHH:mm:ss+HH:mm (no ms, no Z) */
const DATETIME_FIELDS = new Set(['reviewedAt', 'meetingDate']);

function toZohoDatetime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const mm = String(Math.abs(offset) % 60).padStart(2, '0');
  const local = new Date(d.getTime() + offset * 60000);
  return local.toISOString().replace(/\.\d{3}Z$/, '') + `${sign}${hh}:${mm}`;
}

function toCrmPayload(app: Partial<InvestmentApplication>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [appKey, crmKey] of Object.entries(FIELD_MAP)) {
    const val = (app as Record<string, unknown>)[appKey];
    if (val === undefined || val === null || val === '') continue;
    const strVal = String(val).trim();
    if (!strVal) continue;

    if (CURRENCY_FIELDS.has(appKey)) {
      const n = parseFloat(strVal.replace(/[,$]/g, ''));
      if (!isNaN(n)) payload[crmKey] = n;
    } else if (INTEGER_FIELDS.has(appKey)) {
      const n = parseInt(strVal, 10);
      if (!isNaN(n)) payload[crmKey] = n;
    } else if (DATETIME_FIELDS.has(appKey)) {
      payload[crmKey] = toZohoDatetime(strVal);
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
    status:             (str('Application_Status').toLowerCase() || 'submitted') as ApplicationStatus,
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
    requestedDocuments: str('Requested_Documents'),
    meetingDate:        str('Meeting_Date'),
    meetingLocation:    str('Meeting_Location'),
    meetingLink:        str('Meeting_Link'),
    meetingAgenda:      str('Meeting_Agenda'),
  };
}

// ─── localStorage helpers (for draft saving only) ──────────────────────────

function loadLocalDrafts(): InvestmentApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: InvestmentApplication[] = JSON.parse(raw);
    const drafts = all.filter(a => a.status === 'draft');
    // Keep only the most recent draft
    if (drafts.length > 1) {
      drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const keep = drafts[0];
      const removeIds = new Set(drafts.slice(1).map(d => d.id));
      saveLocal(all.filter(a => !removeIds.has(a.id)));
      return [keep];
    }
    return drafts;
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

// ─── CRM direct API ────────────────────────────────────────────────────────

async function crmGetAll(): Promise<InvestmentApplication[]> {
  try {
    const params = { per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc' };
    if (!isFounder()) {
      const records = await zohoList(CRM_MODULE, params);
      return records.map(fromCrmRecord);
    }

    // For portal founders: fetch via portalCoql (the ONLY portal call proven to work
    // for this module — plain auth token, no x-crmportal header). portalList/portalSearch
    // use the x-crmportal header which the portal profile rejects for Applications.
    // COQL filters by Founder_Email so it returns the founder's own records regardless
    // of who owns them in CRM.
    const email = loadFounderEmail();
    const fields = COQL_SELECT_FIELDS.join(',');
    const records = await portalCoql(
      `SELECT ${fields} FROM ${CRM_MODULE} WHERE Founder_Email = '${email}' ORDER BY Modified_Time DESC LIMIT 200`
    );
    return records.map(fromCrmRecord);
  } catch (err) {
    console.warn('[investmentApplications] crmGetAll (founder) failed:', err);
    return [];
  }
}

// COQL allows selecting up to 50 fields. Curated list covering everything the
// tracker + detail views read. id/Created_Time/Modified_Time are always returned.
const COQL_SELECT_FIELDS = [
  'Application_Status', 'Name', 'Website', 'Industry', 'Company_Stage', 'Location',
  'Founded_Year', 'Company_Description', 'Founder_Name', 'Founder_Email', 'Founder_Phone',
  'Founder_LinkedIn', 'Founder_Role', 'Co_Founders', 'Problem_Statement', 'Solution',
  'Target_Market', 'Business_Model', 'Competitive_Advantage', 'Funding_Ask', 'Use_of_Funds',
  'Previous_Funding', 'Current_Valuation', 'Equity_Offered', 'Current_Revenue', 'MRR', 'ARR',
  'Monthly_Burn', 'Runway_Months', 'Active_Users', 'MoM_Growth', 'Churn_Rate', 'NPS_Score',
  'Pitch_Deck_URL', 'Demo_Video_URL', 'Supporting_Docs', 'Submitted_By_Name',
  'Submitted_By_Email', 'Submitted_By_Role', 'Investor_Notes', 'Reviewed_By', 'Reviewed_At',
  'Requested_Documents', 'Meeting_Date', 'Meeting_Location', 'Meeting_Link',
  'Created_Time', 'Modified_Time',
];

function loadFounderEmail(): string {
  // Try the explicitly saved login email first, then fall back to portal session email.
  return (loadPortalLoginEmail() || loadPortalSession()?.email || '').toLowerCase();
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
  const crmId = isFounder()
    ? await portalCreate(CRM_MODULE, payload)
    : await zohoCreate(CRM_MODULE, payload);
  return { ...fields, id: crmId, submittedAt: now, updatedAt: now };
}

async function crmUpdate(id: string, updates: Partial<InvestmentApplication>): Promise<InvestmentApplication | null> {
  const payload = toCrmPayload(updates);
  console.log('[CRM] crmUpdate payload:', JSON.stringify(payload));
  if (isFounder()) {
    await portalUpdate(CRM_MODULE, id, payload);
  } else {
    await zohoUpdate(CRM_MODULE, id, payload);
  }
  return crmGetById(id);
}

async function crmDeleteApp(id: string): Promise<void> {
  try {
    await zohoDelete(CRM_MODULE, id);
  } catch { /* silent */ }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Fetch all applications.
 * Investors: all applications from CRM.
 * Founders: CRM applications filtered to the founder's email + local drafts.
 */
export async function getApplications(isInvestor: boolean, founderEmail?: string): Promise<InvestmentApplication[]> {
  const [crmApps, localDrafts] = await Promise.all([
    crmGetAll(),
    Promise.resolve(loadLocalDrafts()),
  ]);

  if (isInvestor) return crmApps;

  // For founders, crmGetAll() already scopes via COQL WHERE Founder_Email = login email.
  // Don't re-filter by email — currentUser.email (Zoho One) may differ from the
  // portal login email used in Founder_Email, causing all apps to be filtered out.
  const myApps = crmApps;

  // For local drafts use the portal login email (the authoritative founder identity).
  const draftEmail = (loadFounderEmail() || founderEmail || '').toLowerCase();
  const myLocalDrafts = draftEmail
    ? localDrafts.filter(d =>
        d.founderEmail?.toLowerCase() === draftEmail ||
        d.submittedByEmail?.toLowerCase() === draftEmail ||
        !d.founderEmail
      )
    : localDrafts;

  const serverIds = new Set(myApps.map(a => a.id));
  // Also suppress local drafts when a submitted CRM record exists for the same company,
  // since submitting creates a new CRM ID that won't match the local draft's temp ID.
  const submittedCompanyNames = new Set(
    myApps.filter(a => a.status !== 'draft').map(a => a.companyName?.toLowerCase())
  );
  const uniqueDrafts = myLocalDrafts.filter(d =>
    !serverIds.has(d.id) &&
    !submittedCompanyNames.has(d.companyName?.toLowerCase())
  );
  const all = [...uniqueDrafts, ...myApps];
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Check if a founder can submit a new application.
 */
export function canApplyAgain(applications: InvestmentApplication[]): boolean {
  const submitted = applications.filter(a => a.status !== 'draft');
  if (submitted.length === 0) return true;
  if (submitted.length === 1 && submitted[0].status === 'rejected') return true;
  return false;
}

/** Fetch a single application by ID. */
export async function getApplicationById(id: string, isInvestor: boolean): Promise<InvestmentApplication | null> {
  const local = loadLocal().find(a => a.id === id);
  if (local) return local;
  return crmGetById(id);
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
 * Drafts are saved to localStorage. Submitted apps go directly to CRM.
 */
export async function createApplication(fields: InvestmentApplicationFields, isInvestor: boolean): Promise<InvestmentApplication> {
  const now = new Date().toISOString();

  if (fields.status === 'draft') {
    const existing = loadLocal();
    const existingDraft = existing.find(a => a.status === 'draft');
    if (existingDraft) {
      const updated: InvestmentApplication = {
        ...existingDraft,
        ...fields,
        id: existingDraft.id,
        updatedAt: now,
      };
      saveLocal(existing.map(a => a.id === existingDraft.id ? updated : a));
      return updated;
    }
    const app: InvestmentApplication = {
      ...fields,
      id: generateLocalId(),
      submittedAt: now,
      updatedAt: now,
    };
    saveLocal([app, ...existing]);
    return app;
  }

  const result = await crmCreate(fields);
  // Clean up any local draft for the same company so it doesn't linger after submission.
  const existing = loadLocal();
  const cleaned = existing.filter(d => d.companyName?.toLowerCase() !== fields.companyName?.toLowerCase());
  if (cleaned.length !== existing.length) saveLocal(cleaned);
  return result;
}

/**
 * Update an existing application.
 */
export async function updateApplication(
  id: string,
  updates: Partial<InvestmentApplication>,
  isInvestor: boolean
): Promise<InvestmentApplication | null> {
  const localApps = loadLocal();
  const localIdx = localApps.findIndex(a => a.id === id);

  if (localIdx !== -1 && localApps[localIdx].status === 'draft' && updates.status && updates.status !== 'draft') {
    const merged = { ...localApps[localIdx], ...updates, updatedAt: new Date().toISOString() };
    const payload = toCrmPayload(merged);
    const crmId = isFounder()
      ? await portalCreate(CRM_MODULE, payload)
      : await zohoCreate(CRM_MODULE, payload);
    localApps.splice(localIdx, 1);
    saveLocal(localApps);
    return { ...merged, id: crmId };
  }

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

  return crmUpdate(id, updates);
}

/**
 * Update the status of an application.
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
 * Approve an application: set status to 'approved' and create a Portfolio record.
 */
export interface ApprovalDetails {
  investmentAmount: string;
  paymentType: string;
  investmentDate: string;
  equityOffered: string;
  investmentNotes: string;
}

export async function approveApplication(
  id: string,
  reviewerName: string,
  isInvestor: boolean,
  details?: ApprovalDetails,
): Promise<InvestmentApplication | null> {
  const app = await getApplicationById(id, isInvestor);
  if (!app) return null;

  const updated = await updateApplicationStatus(id, 'approved', reviewerName, isInvestor);

  if (isInvestor) {
    try {
      const { createCRMPortfolioRecord, fetchCRMPortfolio } = await import('./crmPortfolio');
      const existing = await fetchCRMPortfolio();
      const alreadyExists = existing.some(p => p.companyName === app.companyName && p.founderEmail === app.founderEmail);
      if (alreadyExists) {
        console.log('[approveApplication] Portfolio record already exists, skipping creation');
        return updated;
      }
      const noteParts = [`Approved from application. Reviewed by ${reviewerName}.`];
      if (details?.paymentType) noteParts.push(`Payment type: ${details.paymentType}`);
      if (details?.investmentNotes) noteParts.push(details.investmentNotes);

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
        investmentAmount: details?.investmentAmount || app.fundingAsk,
        investmentDate: details?.investmentDate || new Date().toISOString().split('T')[0],
        preMoneyValuation: app.currentValuation,
        ownershipPct: details?.equityOffered || app.equityOffered,
        status: 'Active',
        notes: noteParts.join('\n'),
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
  const all = loadLocal();
  const filtered = all.filter(a => a.id !== id);
  if (filtered.length !== all.length) {
    saveLocal(filtered);
  }
  await crmDeleteApp(id);
}

// ─── Requested Documents helpers ──────────────────────────────────────────

export interface RequestedDocument {
  type: string;
  status: 'pending' | 'uploaded' | 'submitted';
  fileName?: string;
  attachmentId?: string;
}

export const DOCUMENT_TYPES = [
  'Financial Statements',
  'Cap Table',
  'Pitch Deck',
  'Business Plan',
  'Revenue Projections',
  'Term Sheet',
  'Legal Documents',
  'Tax Returns',
  'Incorporation Certificate',
  'Bank Statements',
  'Customer Contracts',
  'IP Documentation',
] as const;

export function parseRequestedDocuments(json: string): RequestedDocument[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export function stringifyRequestedDocuments(docs: RequestedDocument[]): string {
  return JSON.stringify(docs);
}

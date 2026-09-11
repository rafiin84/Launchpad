/**
 * investmentApplications.ts
 *
 * Client-only service for investment applications.
 * All reads/writes go directly to Zoho CRM via client-side tokens.
 * Drafts are saved to localStorage only.
 */

import {
  zohoList, zohoGetById, zohoCreate, zohoUpdate, zohoDelete, zohoSearch,
  portalCreate, portalUpdate, portalList, portalSearch, portalGetById,
  zohoUploadFile, portalUploadFile, downloadFieldFile,
  type ZohoRecord,
} from './zohoApi';
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
  // ── 3-level shortlisting pipeline ──
  | 'level1_screening'      // awaiting Level 1 initial screening
  | 'level1_cleared'        // L1 shortlisted, awaiting Level 2
  | 'level2_cleared'        // L2 shortlisted, awaiting Level 3
  | 'level3_cleared'        // L3 shortlisted, awaiting final decision
  | 'not_shortlisted'       // dropped at L1/L2/L3 (level recorded in the ledger)
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

  // 3-level shortlisting ledger (JSON string — see ReviewLedger)
  reviewLedger: string;

  // AI assessment (JSON string — see services/aiScoring). Advisory only: it is
  // read by nothing in the pipeline and cannot move an application forward.
  aiAssessment: string;
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
  reviewLedger:        'Shortlist_Review',
  aiAssessment:        'AI_Assessment',
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
    // Falls back to the local mirror when the CRM field does not exist yet
    reviewLedger:       str('Shortlist_Review') || loadLedgerMirror(r.id),
    aiAssessment:       str('AI_Assessment'),
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

// All CRM field API names — passed to portalList/portalSearch so custom fields
// (e.g. Requested_Documents) come back. Falls back to a plain call if the portal
// profile rejects the fields param.
const ALL_CRM_FIELDS = Object.values(FIELD_MAP).join(',');

// Set true when the last founder fetch failed because the portal token is
// expired/invalid (so the UI can show "session expired" instead of "no apps").
let lastFounderFetchAuthError = false;
export function wasFounderFetchAuthError(): boolean { return lastFounderFetchAuthError; }

function isAuthError(err: unknown): boolean {
  const e = err as { status?: number; code?: string; message?: string };
  return e?.status === 401 || e?.code === 'INVALID_TOKEN' || /invalid.*token|401/i.test(e?.message ?? '');
}

async function crmGetAll(viewer: ViewerRole = 'investor'): Promise<InvestmentApplication[]> {
  try {
    const params = { per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc' };
    if (!isFounder()) {
      // Stage-scoped fetch: ask CRM only for the statuses this viewer may see,
      // so out-of-stage applications never reach the client at all.
      const criteria = stageCriteria(viewer);
      if (criteria) {
        try {
          // NOTE: Zoho's search endpoint returns at most 200 records and this
          // helper does not paginate — see the pagination follow-up before
          // running this at multi-thousand volume.
          const records = await zohoSearch(CRM_MODULE, criteria);
          return records.map(fromCrmRecord);
        } catch (err) {
          // A search failure must not silently widen visibility — fall back to
          // a full list and filter locally instead of returning everything.
          console.warn('[investmentApplications] stage-scoped search failed, filtering locally:', err);
          const records = await zohoList(CRM_MODULE, params);
          return records.map(fromCrmRecord).filter(a => canViewApplication(a, viewer));
        }
      }
      const records = await zohoList(CRM_MODULE, params);
      return records.map(fromCrmRecord);
    }

    // For portal founders: portalList (WITH the x-crmportal header) returns records
    // the portal user created; portalSearch by Founder_Email catches admin-created
    // ones. Try with the fields param (custom fields like Requested_Documents); if
    // the portal rejects it, retry plain. Track auth (401) failures so the UI can
    // tell an expired session apart from a genuinely empty list.
    let authError = false;
    const email = loadFounderEmail();
    const run = async (fn: () => Promise<ZohoRecord[]>, fallback: () => Promise<ZohoRecord[]>) => {
      try { return await fn(); }
      catch (e1) {
        if (isAuthError(e1)) authError = true;
        try { return await fallback(); }
        catch (e2) { if (isAuthError(e2)) authError = true; return [] as ZohoRecord[]; }
      }
    };
    const listRecords = await run(
      () => portalList(CRM_MODULE, { ...params, fields: ALL_CRM_FIELDS }),
      () => portalList(CRM_MODULE, params),
    );
    const searchRecords = await run(
      () => portalSearch(CRM_MODULE, `(Founder_Email:equals:${email})`, ALL_CRM_FIELDS),
      () => portalSearch(CRM_MODULE, `(Founder_Email:equals:${email})`),
    );

    const seen = new Set<string>();
    const merged: ZohoRecord[] = [];
    for (const r of [...listRecords, ...searchRecords]) {
      if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
    }
    lastFounderFetchAuthError = authError && merged.length === 0;
    return merged.map(fromCrmRecord);
  } catch (err) {
    lastFounderFetchAuthError = isAuthError(err);
    console.warn('[investmentApplications] crmGetAll (founder) failed:', err);
    return [];
  }
}

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
export async function getApplications(
  isInvestor: boolean,
  founderEmail?: string,
  viewer: ViewerRole = 'investor',
): Promise<InvestmentApplication[]> {
  const [crmApps, localDrafts] = await Promise.all([
    crmGetAll(viewer),
    Promise.resolve(loadLocalDrafts()),
  ]);

  if (isInvestor) return crmApps;

  // For founders, crmGetAll(viewer) already scopes via COQL WHERE Founder_Email = login email.
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
  if (submitted.length === 1 && (submitted[0].status === 'rejected' || submitted[0].status === 'not_shortlisted')) return true;
  return false;
}

/** Fetch a single application by ID. */
export async function getApplicationById(
  id: string,
  isInvestor: boolean,
  viewer?: ViewerRole,
): Promise<InvestmentApplication | null> {
  const local = loadLocal().find(a => a.id === id);
  if (local) return local;
  const app = await crmGetById(id);
  // Stage visibility applies to direct record access too, so pasting an id
  // into the URL cannot reveal an application from another stage.
  if (app && viewer && !canViewApplication(app, viewer)) return null;
  return app;
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
  isInvestor: boolean,
  options: {
    /**
     * Permits a write to an already-decided application. Reserved for the
     * decision transition itself (recordFinalDecision / approveApplication),
     * which must stay retryable if a later step such as portfolio creation
     * fails. Never set this from UI code.
     */
    allowLocked?: boolean;
  } = {},
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
    if (!options.allowLocked && isApplicationLocked(localApps[localIdx])) {
      throw new ApplicationLockedError(applicationLockReason(localApps[localIdx]));
    }
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

  // Read the server's current state before writing. The status in hand may be
  // from a tab opened before the investor decided, so the stored record — not
  // the caller — decides whether this write is allowed.
  if (!options.allowLocked) {
    const current = await crmGetById(id);
    if (current && isApplicationLocked(current)) {
      throw new ApplicationLockedError(applicationLockReason(current));
    }
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
  isInvestor = true,
  /** Set only by the approve/reject transition — see updateApplication. */
  allowLocked = false,
): Promise<InvestmentApplication | null> {
  const updates: Partial<InvestmentApplication> = { status };

  if (reviewerName) {
    updates.reviewedBy = reviewerName;
    updates.reviewedAt = new Date().toISOString();
  }

  return updateApplication(id, updates, isInvestor, { allowLocked });
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

  const updated = await updateApplicationStatus(id, 'approved', reviewerName, isInvestor, true);

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
  // A decided application cannot be deleted either — same record lock.
  const existing = loadLocal().find(a => a.id === id) || await crmGetById(id);
  if (existing && isApplicationLocked(existing)) {
    throw new ApplicationLockedError(applicationLockReason(existing));
  }

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
  documentId?: string;   // LEGACY: My_Documents record id holding the uploaded file (see crmDocuments.ts) — records submitted before requested-doc uploads moved onto the Application itself
  recordId?: string;     // LEGACY: same as documentId (a My_Documents record id) — the mobile app writes this key name instead of documentId for the same data
  attachmentId?: string; // LEGACY: File_Upload_1 attachment id on that My_Documents record — or, on even older records, a share link held directly here
  link?: string;         // explicit share link (Google Drive / Dropbox) — NOTE: the mobile app also puts a raw Zoho API download URL here (needs an Authorization header to work, unlike a real share link) whenever it also sets recordId/attachmentId; always prefer resolving via recordId+attachmentId over treating link as a plain hyperlink when both are present
  fileAttachmentId?: string; // this entry's own attachment id within THIS Application's own Requested_Document_Files field (see "Requested-document file uploads" below) — current uploads use this, never My_Documents
}

/** documentId and recordId are two different key names the same data has been stored under across sources (this app vs. the mobile app) — always read through this. */
export function requestedDocumentFileId(doc: RequestedDocument): string | undefined {
  return doc.documentId || doc.recordId;
}

// ─── Requested-document file uploads ─────────────────────────────────────────
// A requested document's file lives directly on the Application record itself
// (Requested_Document_Files, a multi-file File Upload field) — never in
// My_Documents, so it never shows up on the Documents page. Multiple requested
// documents on the same application share this one field, so adding a new
// upload must read the field's current contents first and re-submit them
// alongside the new file, or Zoho would replace the whole list and silently
// drop every previously uploaded document.
const REQUESTED_FILES_FIELD = 'Requested_Document_Files';

interface RequestedFileEntry {
  attachmentId: string; // the entry's own id — what a download action needs
  fileId: string;       // the encrypted upload-time id — what a later "keep this file" write needs
}

// Same admin-vs-portal key-naming gotcha as crmDocuments.ts/crmActivities.ts,
// but iterating the WHOLE array (not just the first entry) since this field
// holds one file per requested document, not a single attachment.
function parseRequestedFileEntries(v: unknown): RequestedFileEntry[] {
  const arr = Array.isArray(v) ? v : [];
  return (arr as Record<string, unknown>[]).map(f => ({
    attachmentId: String(f['id'] ?? f['attachment_Id'] ?? f['attachment_Id__s'] ?? ''),
    fileId: String(f['File_Id__s'] ?? f['file_Id'] ?? ''),
  })).filter(e => e.attachmentId);
}

async function getRequestedFileEntries(applicationId: string): Promise<RequestedFileEntry[]> {
  const record = isFounder()
    ? await portalGetById(CRM_MODULE, applicationId, REQUESTED_FILES_FIELD)
    : await zohoGetById(CRM_MODULE, applicationId, REQUESTED_FILES_FIELD);
  if (!record) return [];
  return parseRequestedFileEntries(record[REQUESTED_FILES_FIELD]);
}

/** Uploads a file and returns its raw file_id, for use with attachApplicationDocumentFile. */
export async function uploadApplicationDocumentFile(file: File): Promise<string> {
  return isFounder() ? portalUploadFile(file, file.name) : zohoUploadFile(file, file.name);
}

/**
 * Attaches an already-uploaded file to an Application's Requested_Document_Files
 * field, preserving any files already there, and returns the new entry's own
 * attachment id (to store on that requested document's RequestedDocument.fileAttachmentId).
 */
export async function attachApplicationDocumentFile(applicationId: string, fileId: string): Promise<string> {
  const existing = await getRequestedFileEntries(applicationId);
  const keep = existing.map(e => ({ file_id: e.fileId })).filter(e => e.file_id);
  const payload = { [REQUESTED_FILES_FIELD]: [...keep, { file_id: fileId }] };

  if (isFounder()) {
    await portalUpdate(CRM_MODULE, applicationId, payload);
  } else {
    await zohoUpdate(CRM_MODULE, applicationId, payload);
  }

  const afterIds = new Set(existing.map(e => e.attachmentId));
  const after = await getRequestedFileEntries(applicationId);
  const added = after.find(e => !afterIds.has(e.attachmentId));
  if (!added) throw new Error('Upload succeeded but the new file reference could not be read back.');
  return added.attachmentId;
}

/** Fetches the actual file for one requested document, given its fileAttachmentId. */
export async function resolveApplicationDocumentUrl(applicationId: string, fileAttachmentId: string): Promise<{ url: string; revoke: boolean }> {
  const entries = await getRequestedFileEntries(applicationId);
  if (!entries.some(e => e.attachmentId === fileAttachmentId)) {
    throw new Error('This file is no longer attached to the application.');
  }
  const blob = await downloadFieldFile(CRM_MODULE, applicationId, fileAttachmentId, isFounder());
  return { url: URL.createObjectURL(blob), revoke: true };
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


// ═══════════════════════════════════════════════════════════════════════════
//  3-LEVEL SHORTLISTING PIPELINE
//
//  Applications must clear three review levels before a final decision:
//      Level 1 (Initial Screening) → Level 2 (Detailed Review)
//      → Level 3 (Final Shortlist) → Final Decision (Approve / Reject)
//
//  Each level records reviewer, timestamp, decision and a mandatory comment.
//  The whole history is persisted as JSON in the CRM field `Shortlist_Review`,
//  mirrored to localStorage so the flow keeps working if that custom field has
//  not been created in Zoho yet.
// ═══════════════════════════════════════════════════════════════════════════

export type ReviewLevel = 1 | 2 | 3;
export type LevelOutcome = 'shortlisted' | 'not_shortlisted';
export type FinalOutcome = 'approved' | 'rejected';

/** A single completed review level. */
export interface LevelReview {
  level: ReviewLevel;
  outcome: LevelOutcome;
  reviewer: string;
  reviewerEmail: string;
  reviewedAt: string;          // ISO timestamp
  comment: string;
  /** Optional 1–5 assessment score captured alongside the comment. */
  score?: number;
  /**
   * True when this entry was reconstructed from Application_Status rather than
   * read from the ledger — the level is known to be cleared, but the reviewer
   * and comment were not available on this device. See reconcileWithStatus.
   */
  synthesized?: boolean;
}

/** The final approve/reject decision, only allowed after level 3 clears. */
export interface FinalReview {
  outcome: FinalOutcome;
  reviewer: string;
  reviewerEmail: string;
  decidedAt: string;
  comment: string;
  synthesized?: boolean;
}

export interface ReviewLedger {
  levels: LevelReview[];
  final?: FinalReview;
}

const LEDGER_MIRROR_PREFIX = 'lp_review_ledger_';

export const REVIEW_LEVELS: ReviewLevel[] = [1, 2, 3];

/** Status an application sits at once the given level has been cleared. */
const CLEARED_STATUS: Record<ReviewLevel, ApplicationStatus> = {
  1: 'level1_cleared',
  2: 'level2_cleared',
  3: 'level3_cleared',
};

// ── Ledger (de)serialisation ──────────────────────────────────────────────

export function parseReviewLedger(json: string): ReviewLedger {
  if (!json || !json.trim()) return { levels: [] };
  try {
    const parsed = JSON.parse(json) as Partial<ReviewLedger>;
    const levels = Array.isArray(parsed.levels) ? parsed.levels : [];
    // Keep only well-formed entries, one per level, ordered 1→3
    const seen = new Set<number>();
    const clean: LevelReview[] = [];
    for (const l of levels) {
      const lvl = Number(l?.level) as ReviewLevel;
      if (![1, 2, 3].includes(lvl) || seen.has(lvl)) continue;
      seen.add(lvl);
      clean.push({
        level: lvl,
        outcome: l.outcome === 'not_shortlisted' ? 'not_shortlisted' : 'shortlisted',
        reviewer: String(l.reviewer ?? ''),
        reviewerEmail: String(l.reviewerEmail ?? ''),
        reviewedAt: String(l.reviewedAt ?? ''),
        comment: String(l.comment ?? ''),
        score: typeof l.score === 'number' ? l.score : undefined,
        synthesized: l.synthesized === true || undefined,
      });
    }
    clean.sort((a, b) => a.level - b.level);
    const final = parsed.final && (parsed.final.outcome === 'approved' || parsed.final.outcome === 'rejected')
      ? {
          outcome: parsed.final.outcome,
          reviewer: String(parsed.final.reviewer ?? ''),
          reviewerEmail: String(parsed.final.reviewerEmail ?? ''),
          decidedAt: String(parsed.final.decidedAt ?? ''),
          comment: String(parsed.final.comment ?? ''),
        }
      : undefined;
    return { levels: clean, final };
  } catch {
    return { levels: [] };
  }
}

export function stringifyReviewLedger(ledger: ReviewLedger): string {
  return JSON.stringify(ledger);
}

// ── Local mirror (fallback when the CRM custom field is absent) ────────────

function loadLedgerMirror(id: string): string {
  try {
    return localStorage.getItem(LEDGER_MIRROR_PREFIX + id) || '';
  } catch {
    return '';
  }
}

function saveLedgerMirror(id: string, json: string): void {
  try {
    localStorage.setItem(LEDGER_MIRROR_PREFIX + id, json);
  } catch { /* storage full or unavailable — CRM copy is authoritative anyway */ }
}

// ── Derived pipeline state ────────────────────────────────────────────────

/**
 * Levels implied by each status. Application_Status is a first-class CRM field
 * and therefore always syncs between the investor and the founder; the ledger
 * lives in Shortlist_Review, which may not exist in Zoho yet and falls back to
 * a per-device localStorage mirror. Without this reconciliation a founder would
 * read an empty ledger and see "Level 1, in review" while the investor had
 * already cleared level 2.
 */
const STATUS_MIN_CLEARED: Partial<Record<ApplicationStatus, number>> = {
  level1_cleared: 1,
  level2_cleared: 2,
  level3_cleared: 3,
  approved: 3,
  invested: 3,
};

/**
 * Fills in levels the status proves are done but the ledger does not contain.
 * Synthesized entries carry no comment; the most recent one borrows the synced
 * Reviewed_By / Reviewed_At fields so the founder still sees who acted and when.
 * A ledger that already records a drop is never extended.
 */
function reconcileWithStatus(
  ledger: ReviewLedger,
  app: Pick<InvestmentApplication, 'status' | 'reviewedBy' | 'reviewedAt'>,
): ReviewLedger {
  const dropped = ledger.levels.some(l => l.outcome === 'not_shortlisted');
  const levels = [...ledger.levels];
  let final = ledger.final;

  if (!dropped) {
    const minCleared = STATUS_MIN_CLEARED[app.status] ?? 0;
    for (let lvl = 1; lvl <= minCleared; lvl++) {
      if (levels.some(l => l.level === lvl)) continue;
      const isLatest = lvl === minCleared;
      levels.push({
        level: lvl as ReviewLevel,
        outcome: 'shortlisted',
        reviewer: isLatest ? (app.reviewedBy || '') : '',
        reviewerEmail: '',
        reviewedAt: isLatest ? (app.reviewedAt || '') : '',
        comment: '',
        synthesized: true,
      });
    }
    levels.sort((a, b) => a.level - b.level);

    // An approved/invested record with no recorded final decision
    if (!final && (app.status === 'approved' || app.status === 'invested')) {
      final = {
        outcome: 'approved',
        reviewer: app.reviewedBy || '',
        reviewerEmail: '',
        decidedAt: app.reviewedAt || '',
        comment: '',
        synthesized: true,
      };
    }
  }

  // Dropped per status but the ledger has no drop entry: the level is unknown,
  // so attribute it to the first level that is not already cleared.
  if (app.status === 'not_shortlisted' && !dropped) {
    const nextLevel = (levels.filter(l => l.outcome === 'shortlisted').length + 1);
    if (nextLevel <= 3) {
      levels.push({
        level: nextLevel as ReviewLevel,
        outcome: 'not_shortlisted',
        reviewer: app.reviewedBy || '',
        reviewerEmail: '',
        reviewedAt: app.reviewedAt || '',
        comment: '',
        synthesized: true,
      });
      levels.sort((a, b) => a.level - b.level);
    }
  }

  // Rejected per status with no recorded final decision
  if (!final && app.status === 'rejected') {
    final = {
      outcome: 'rejected',
      reviewer: app.reviewedBy || '',
      reviewerEmail: '',
      decidedAt: app.reviewedAt || '',
      comment: '',
      synthesized: true,
    };
  }

  return { levels, final };
}

/**
 * Who is looking at an application. Reviewers are CRM (non-portal) users
 * distinguished by their Zoho *profile* — "Level 1/2/3 Reviewer" — not by their
 * Zoho role (all three share the "Manager" role).
 */
/**
 * ─── RECORD LOCK ──────────────────────────────────────────────────────────
 *
 * Once the investor has decided, the application is a closed record: an
 * approved one backs a portfolio holding and an investment amount, so editing
 * it after the fact would rewrite history behind the money.
 *
 * Enforced in updateApplication — the single chokepoint every write goes
 * through — rather than only in the UI, so a stale tab, a direct service call
 * or a hand-crafted request cannot get round it.
 */
export const LOCKED_STATUSES: ApplicationStatus[] = [
  'approved',        // investor approved and invested
  'invested',
  'rejected',        // investor rejected after level 3
  'not_shortlisted', // dropped by a reviewer — the funnel ended here
];

export function isApplicationLocked(app: Pick<InvestmentApplication, 'status'>): boolean {
  return LOCKED_STATUSES.includes(app.status);
}

/** Machine-readable reason, so the UI can pick its own wording. */
export type LockReason = 'approved' | 'rejected' | 'not_shortlisted' | null;

export function applicationLockReason(app: Pick<InvestmentApplication, 'status'>): LockReason {
  if (app.status === 'approved' || app.status === 'invested') return 'approved';
  if (app.status === 'rejected') return 'rejected';
  if (app.status === 'not_shortlisted') return 'not_shortlisted';
  return null;
}

export class ApplicationLockedError extends Error {
  readonly reason: LockReason;
  constructor(reason: LockReason) {
    super(
      reason === 'approved'
        ? 'This application has been approved and can no longer be changed'
        : reason === 'rejected'
        ? 'This application was rejected and can no longer be changed'
        : 'This application was not shortlisted and can no longer be changed',
    );
    this.name = 'ApplicationLockedError';
    this.reason = reason;
  }
}

export type ViewerRole = 'founder' | 'reviewer_l1' | 'reviewer_l2' | 'reviewer_l3' | 'investor';

/** The review level a viewer owns, or null for founders and the investor. */
export function viewerLevel(viewer: ViewerRole): ReviewLevel | null {
  return viewer === 'reviewer_l1' ? 1 : viewer === 'reviewer_l2' ? 2 : viewer === 'reviewer_l3' ? 3 : null;
}

/** The stage an application sits at while it awaits the given level. */
export const AWAITING_STATUS: Record<ReviewLevel, ApplicationStatus> = {
  1: 'submitted',
  2: 'level1_cleared',
  3: 'level2_cleared',
};

/**
 * Statuses that predate the 3-level workflow. They are folded into the Level 1
 * queue so no historical record becomes invisible to everyone; they re-enter
 * the funnel at screening.
 */
const LEGACY_IN_REVIEW: ApplicationStatus[] = [
  'under_review', 'interested', 'more_info_requested',
  'documents_requested', 'shortlisted', 'meeting_scheduled',
  'due_diligence', 'on_hold',
];

/**
 * STRICT STAGE-BASED VISIBILITY.
 *
 * A newly submitted application is visible ONLY to the Level 1 reviewer. Each
 * subsequent level sees it only once the previous level has passed it, and the
 * investor never sees an application that has not cleared level 3.
 *
 * Returned as an explicit status allowlist so it can be pushed into the CRM
 * query rather than filtered after the fact — at 2,000 applications the
 * difference matters, and it keeps out-of-stage records off the wire.
 */
export function visibleStatusesFor(viewer: ViewerRole): ApplicationStatus[] {
  switch (viewer) {
    case 'reviewer_l1':
      return ['submitted', 'level1_screening', ...LEGACY_IN_REVIEW];
    case 'reviewer_l2':
      return ['level1_cleared'];
    case 'reviewer_l3':
      return ['level2_cleared'];
    case 'investor':
      // Only applications that cleared all three levels, plus the ones the
      // investor has already decided. Never a new or mid-funnel application.
      return ['level3_cleared', 'approved', 'invested', 'rejected'];
    case 'founder':
    default:
      return [];  // founders are scoped by ownership, not by stage
  }
}

/** True when this viewer is allowed to see this application at all. */
export function canViewApplication(app: InvestmentApplication, viewer: ViewerRole): boolean {
  if (viewer === 'founder') return true;
  return visibleStatusesFor(viewer).includes(app.status);
}

/** CRM search criteria for the viewer's queue, e.g. "(Application_Status:equals:submitted)or(...)". */
function stageCriteria(viewer: ViewerRole): string {
  const statuses = visibleStatusesFor(viewer);
  if (!statuses.length) return '';
  return statuses.map(s => `(Application_Status:equals:${s})`).join('or');
}

export type PipelineStageState = 'completed' | 'current' | 'locked' | 'not_shortlisted';

export interface PipelineState {
  ledger: ReviewLedger;
  /** Level awaiting a decision (1–3), or null when all three have cleared. */
  currentLevel: ReviewLevel | null;
  /** Number of levels cleared (0–3). */
  clearedCount: number;
  /** Level at which the application was dropped, if any. */
  droppedAtLevel: ReviewLevel | null;
  /** True once all three levels are cleared — unlocks Approve / Reject. */
  finalUnlocked: boolean;
  /** True when no further action is possible (dropped, approved or rejected). */
  isTerminal: boolean;
  /** 0–100, for the progress indicator. */
  progressPct: number;
}

export function getPipelineState(app: InvestmentApplication): PipelineState {
  const ledger = reconcileWithStatus(parseReviewLedger(app.reviewLedger), app);
  const dropped = ledger.levels.find(l => l.outcome === 'not_shortlisted') || null;
  const cleared = ledger.levels.filter(l => l.outcome === 'shortlisted');
  const clearedCount = cleared.length;

  // A record already approved/rejected/invested in CRM is terminal even if the
  // ledger predates this workflow.
  const statusTerminal = app.status === 'approved' || app.status === 'invested' || app.status === 'rejected';
  const isTerminal = !!dropped || !!ledger.final || statusTerminal;

  const finalUnlocked = clearedCount >= 3 && !dropped;
  const currentLevel: ReviewLevel | null =
    dropped || clearedCount >= 3 ? null : ((clearedCount + 1) as ReviewLevel);

  // Progress: 3 levels + the final decision = 4 steps
  const steps = clearedCount + (ledger.final || statusTerminal ? 1 : 0);
  const progressPct = dropped
    ? Math.round((clearedCount / 4) * 100)
    : Math.round((Math.min(steps, 4) / 4) * 100);

  return { ledger, currentLevel, clearedCount, droppedAtLevel: dropped ? dropped.level : null, finalUnlocked, isTerminal, progressPct };
}

/** Per-stage state for rendering the stepper. */
export function getStageState(state: PipelineState, level: ReviewLevel): PipelineStageState {
  const entry = state.ledger.levels.find(l => l.level === level);
  if (entry) return entry.outcome === 'not_shortlisted' ? 'not_shortlisted' : 'completed';
  if (state.droppedAtLevel !== null) return 'locked';
  return state.currentLevel === level ? 'current' : 'locked';
}

export function getLevelReview(state: PipelineState, level: ReviewLevel): LevelReview | undefined {
  return state.ledger.levels.find(l => l.level === level);
}

// ── Actions ───────────────────────────────────────────────────────────────

export interface LevelDecisionInput {
  level: ReviewLevel;
  outcome: LevelOutcome;
  reviewer: string;
  reviewerEmail?: string;
  comment: string;
  score?: number;
  /**
   * The acting user's role. A reviewer may only decide at their own level;
   * the investor may not decide review levels at all.
   */
  viewer?: ViewerRole;
}

/**
 * Record a decision for one shortlisting level.
 * Enforces strict order: a level can only be actioned when it is the current
 * one, and nothing can be actioned after a drop or a final decision.
 */
export async function recordLevelDecision(
  id: string,
  input: LevelDecisionInput,
  isInvestor = true,
): Promise<InvestmentApplication | null> {
  // ── Authorisation first: a reviewer may only act on their own level, and
  // this does not depend on the record, so it must not require a fetch. It
  // also stops an unauthorised caller learning whether the record exists.
  if (input.viewer) {
    const own = viewerLevel(input.viewer);
    if (own === null) {
      throw new Error(
        input.viewer === 'investor'
          ? 'The investor cannot decide review levels — only the final approve/reject'
          : 'You are not a reviewer',
      );
    }
    if (own !== input.level) {
      throw new Error(`You can only review at level ${own}`);
    }
  }

  const app = await getApplicationById(id, isInvestor);
  if (!app) throw new Error('Application not found');

  const state = getPipelineState(app);
  // Writes are built from the stored ledger: entries reconstructed from status
  // must not be persisted as if they were genuine recorded reviews.
  const stored = parseReviewLedger(app.reviewLedger);
  if (state.ledger.final) throw new Error('A final decision has already been recorded');
  if (state.droppedAtLevel !== null) throw new Error(`Application was not shortlisted at level ${state.droppedAtLevel}`);
  if (state.currentLevel !== input.level) {
    throw new Error(
      state.currentLevel === null
        ? 'All shortlisting levels are already complete'
        : `Level ${state.currentLevel} must be completed first`,
    );
  }
  if (!input.comment.trim()) throw new Error('A review comment is required');

  const entry: LevelReview = {
    level: input.level,
    outcome: input.outcome,
    reviewer: input.reviewer,
    reviewerEmail: input.reviewerEmail || '',
    reviewedAt: new Date().toISOString(),
    comment: input.comment.trim(),
    score: input.score,
  };

  // Keep any real stored entries, drop synthesized ones, add this decision.
  const keep = stored.levels.filter(l => l.level !== input.level);
  const ledger: ReviewLedger = { ...stored, levels: [...keep, entry].sort((a, b) => a.level - b.level) };
  const json = stringifyReviewLedger(ledger);
  saveLedgerMirror(id, json);

  const status: ApplicationStatus =
    input.outcome === 'not_shortlisted' ? 'not_shortlisted' : CLEARED_STATUS[input.level];

  return updateApplication(id, {
    reviewLedger: json,
    status,
    reviewedBy: input.reviewer,
    reviewedAt: entry.reviewedAt,
  }, isInvestor);
}

/**
 * Record the final approve/reject decision. Only permitted once all three
 * levels have been cleared.
 */
export async function recordFinalDecision(
  id: string,
  outcome: FinalOutcome,
  reviewer: string,
  comment: string,
  isInvestor = true,
  reviewerEmail = '',
  viewer: ViewerRole = 'investor',
): Promise<{ app: InvestmentApplication | null; ledgerJson: string }> {
  // ── Authorisation: the final approve/reject belongs to the investor alone ──
  if (viewer !== 'investor') {
    throw new Error('Only the investor can make the final approve or reject decision');
  }
  const app = await getApplicationById(id, isInvestor);
  if (!app) throw new Error('Application not found');

  const state = getPipelineState(app);
  if (!state.finalUnlocked) {
    throw new Error('All three shortlisting levels must be completed before a final decision');
  }
  // Re-recording the same outcome is allowed so a caller can safely retry when
  // a downstream step (e.g. portfolio creation) failed after the ledger write.
  // A conflicting outcome is rejected. A synthesized final (inferred from
  // status) never blocks a real decision.
  const existingFinal = state.ledger.final && !state.ledger.final.synthesized ? state.ledger.final : undefined;
  if (existingFinal && existingFinal.outcome !== outcome) {
    throw new Error(`This application was already ${existingFinal.outcome}`);
  }
  const storedFinalBase = parseReviewLedger(app.reviewLedger);

  const final: FinalReview = {
    outcome,
    reviewer,
    reviewerEmail,
    decidedAt: new Date().toISOString(),
    comment: comment.trim(),
  };
  const ledger: ReviewLedger = { ...storedFinalBase, final };
  const json = stringifyReviewLedger(ledger);
  saveLedgerMirror(id, json);

  // Rejection is a plain status update; approval goes through approveApplication
  // (which also creates the portfolio record) — the caller handles that.
  if (outcome === 'rejected') {
    const updated = await updateApplication(id, {
      reviewLedger: json,
      status: 'rejected',
      reviewedBy: reviewer,
      reviewedAt: final.decidedAt,
    }, isInvestor, { allowLocked: true });
    return { app: updated, ledgerJson: json };
  }

  // For approval, persist the ledger first so it survives even if the
  // portfolio step fails downstream.
  const updated = await updateApplication(id, {
    reviewLedger: json,
    reviewedBy: reviewer,
    reviewedAt: final.decidedAt,
  }, isInvestor, { allowLocked: true });
  return { app: updated, ledgerJson: json };
}

/**
 * investmentApplications.ts
 *
 * localStorage-based service for investment applications that works for both
 * Investor (CRM) and Founder (Portal) users sharing the same device/browser.
 *
 * Pure service — no React hooks. All localStorage access is wrapped in
 * try/catch to match the rest of the codebase.
 */

const STORAGE_KEY = 'lp_investment_applications';
const MAX_APPLICATIONS = 200;

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
  companyStage: string; // Idea, Pre-Seed, Seed, Series A, etc.
  companyLocation: string;
  foundedYear: string;
  companyDescription: string;

  // Founder Details
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderLinkedin: string;
  founderRole: string; // CEO, CTO, etc.
  coFounders: string; // comma-separated

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
  pitchDeckUrl: string; // data URL or external URL
  pitchDeckName: string;
  demoVideoUrl: string;
  supportingDocs: string; // JSON stringified array of {name, url}

  // Metadata
  submittedBy: string; // user name
  submittedByEmail: string;
  submittedByRole: 'investor' | 'founder';
  submittedAt: string; // ISO timestamp
  updatedAt: string;

  // Investor notes (only investors write these)
  investorNotes: string;
  reviewedBy: string;
  reviewedAt: string;
}

export type InvestmentApplicationFields = Omit<InvestmentApplication, 'id' | 'submittedAt' | 'updatedAt'>;

// ─── localStorage helpers ───────────────────────────────────────────────────

function loadAll(): InvestmentApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveAll(applications: InvestmentApplication[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications.slice(0, MAX_APPLICATIONS)));
  } catch { /* storage full — ok */ }
}

function generateId(): string {
  return `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Returns all applications, sorted by updatedAt descending. */
export function getApplications(): InvestmentApplication[] {
  const all = loadAll();
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Returns a single application by its ID, or null if not found. */
export function getApplicationById(id: string): InvestmentApplication | null {
  const all = loadAll();
  return all.find(a => a.id === id) ?? null;
}

/** Returns all applications matching the given status, sorted by updatedAt descending. */
export function getApplicationsByStatus(status: ApplicationStatus): InvestmentApplication[] {
  const all = loadAll();
  return all
    .filter(a => a.status === status)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Returns all applications submitted by a founder (matched by email), sorted by updatedAt descending. */
export function getApplicationsByFounder(email: string): InvestmentApplication[] {
  const all = loadAll();
  return all
    .filter(a => a.founderEmail === email || a.submittedByEmail === email)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Create a new investment application.
 * Generates an ID and sets submittedAt / updatedAt timestamps,
 * prepends to the list, and trims to the most recent 200.
 */
export function createApplication(fields: InvestmentApplicationFields): InvestmentApplication {
  const now = new Date().toISOString();

  const application: InvestmentApplication = {
    ...fields,
    id: generateId(),
    submittedAt: now,
    updatedAt: now,
  };

  const existing = loadAll();
  saveAll([application, ...existing]);

  return application;
}

/**
 * Update an existing application by merging partial updates.
 * Sets updatedAt to now. Returns the updated application, or null if not found.
 */
export function updateApplication(
  id: string,
  updates: Partial<InvestmentApplication>
): InvestmentApplication | null {
  const all = loadAll();
  const index = all.findIndex(a => a.id === id);
  if (index === -1) return null;

  const updated: InvestmentApplication = {
    ...all[index],
    ...updates,
    id, // prevent ID from being overwritten
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  saveAll(all);

  return updated;
}

/**
 * Update the status of an application.
 * Optionally sets reviewedBy and reviewedAt (for investor reviews).
 * Returns the updated application, or null if not found.
 */
export function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  reviewerName?: string
): InvestmentApplication | null {
  const updates: Partial<InvestmentApplication> = { status };

  if (reviewerName) {
    updates.reviewedBy = reviewerName;
    updates.reviewedAt = new Date().toISOString();
  }

  return updateApplication(id, updates);
}

/** Remove an application by its ID. */
export function deleteApplication(id: string): void {
  const all = loadAll();
  const filtered = all.filter(a => a.id !== id);
  saveAll(filtered);
}

// Simple localStorage-based store for user-created data.
// Each entity gets its own key and typed interface.

// ─── Portfolio Companies ────────────────────────────────────────────────────

export interface StoredPortfolioCompany {
  id: string;
  logo: string;
  companyName: string;
  website: string;
  location: string;
  industry: string;
  stage: string;
  foundedYear: string;
  teamSize: string;
  shortDescription: string;
  fullDescription: string;
  tags: string;
  investmentAmount: string;
  investmentDate: string;
  preMoneyValuation: string;
  ownershipPct: string;
  status: string;
  notes: string;
  founderName: string;
  founderEmail: string;
  founderLinkedin: string;
  founderPhone: string;
  createdAt: string;
}

const PORTFOLIO_KEY = 'lp_portfolio';

export function getPortfolioCompanies(): StoredPortfolioCompany[] {
  try {
    return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function savePortfolioCompany(data: Omit<StoredPortfolioCompany, 'id' | 'createdAt'>): StoredPortfolioCompany {
  const entry: StoredPortfolioCompany = {
    ...data,
    id: `pc-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const existing = getPortfolioCompanies();
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify([entry, ...existing]));
  return entry;
}

// ─── Applications ───────────────────────────────────────────────────────────

export interface StoredApplication {
  id: string;
  logo: string;
  companyName: string;
  website: string;
  location: string;
  industry: string;
  companyStage: string;
  foundedYear: string;
  teamSize: string;
  shortDescription: string;
  fullDescription: string;
  amountRequested: string;
  useOfFunds: string;
  previousFunding: string;
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderLinkedin: string;
  founderBio: string;
  pipelineStage: string;
  submittedAt: string;
}

const APPLICATIONS_KEY = 'lp_applications';

export function getApplications(): StoredApplication[] {
  try {
    return JSON.parse(localStorage.getItem(APPLICATIONS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveApplication(data: Omit<StoredApplication, 'id' | 'submittedAt'>): StoredApplication {
  const entry: StoredApplication = {
    ...data,
    id: `app-${Date.now()}`,
    submittedAt: new Date().toISOString(),
  };
  const existing = getApplications();
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify([entry, ...existing]));
  return entry;
}

// ─── Documents ──────────────────────────────────────────────────────────────

export interface StoredDocument {
  id: string;
  documentName: string;
  type: string;
  relatedCompany: string;
  description: string;
  visibility: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

const DOCUMENTS_KEY = 'lp_documents';

export function getDocuments(): StoredDocument[] {
  try {
    return JSON.parse(localStorage.getItem(DOCUMENTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveDocument(data: Omit<StoredDocument, 'id' | 'uploadedAt'>): StoredDocument {
  const entry: StoredDocument = {
    ...data,
    id: `doc-${Date.now()}`,
    uploadedAt: new Date().toISOString(),
  };
  const existing = getDocuments();
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify([entry, ...existing]));
  return entry;
}

// Zoho CRM ↔ Portfolio form field mapping and CRUD operations.
//
// Field API names must match what was set in:
//   Zoho CRM → Setup → Customization → Modules → Portfolio → Fields
// The "API Name" column is the key — adjust FIELD_MAP if yours differ.

import { zohoList, zohoGetById, zohoCreate, zohoUpdate, zohoDelete, findModuleApiName, type ZohoRecord } from './zohoApi';

const MODULE_STORAGE_KEY = 'lp_crm_portfolio_module';

// Allow the module name to be overridden from the UI and persisted.
export function getPortfolioModuleOverride(): string | null {
  try { return localStorage.getItem(MODULE_STORAGE_KEY); } catch { return null; }
}
export function setPortfolioModuleOverride(name: string): void {
  localStorage.setItem(MODULE_STORAGE_KEY, name);
  resolvedModule = name; // update in-memory cache immediately
}

// Resolved at runtime; checks localStorage override first, then auto-discovery.
let resolvedModule: string | null = null;

async function getModule(): Promise<string> {
  if (resolvedModule) return resolvedModule;
  const override = getPortfolioModuleOverride();
  if (override) { resolvedModule = override; return resolvedModule; }
  // Auto-discover by searching all modules for 'portfolio' in name.
  const discovered = await findModuleApiName('portfolio').catch(() => null);
  resolvedModule = discovered ?? 'Portfolio';
  return resolvedModule;
}

// ─── Field mapping (form key → Zoho CRM API name) ────────────────────────────
const FIELD_MAP: Record<string, string> = {
  companyName:       'Name',                // Required — built-in title field
  website:           'Website',
  location:          'Location',
  industry:          'Industry',
  stage:             'Stage',
  foundedYear:       'Founded_Year',
  teamSize:          'Team_Size',
  shortDescription:  'Short_Description',
  fullDescription:   'Description',
  tags:              'Tags',
  investmentAmount:  'Investment_Amount',
  investmentDate:    'Investment_Date',
  preMoneyValuation: 'Pre_Money_Valuation',
  ownershipPct:      'Ownership_Percentage',
  status:            'Status',
  notes:             'Notes',
  founderName:       'Founder_Name',
  founderEmail:      'Founder_Email',
  founderLinkedin:   'Founder_LinkedIn',
  founderPhone:      'Founder_Phone',
};

// Fields whose values should be sent as numbers, not strings
const NUMERIC_FIELDS = new Set(['investmentAmount', 'preMoneyValuation', 'ownershipPct', 'teamSize', 'foundedYear']);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CRMPortfolioRecord {
  id: string;           // Zoho record ID
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
}

export type CRMFormFields = Omit<CRMPortfolioRecord, 'id'>;

// ─── Converters ───────────────────────────────────────────────────────────────

function toPayload(fields: CRMFormFields): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
    const raw = (fields as Record<string, string>)[formKey] ?? '';
    if (raw === '') continue;
    if (NUMERIC_FIELDS.has(formKey)) {
      const n = parseFloat(raw);
      if (!isNaN(n)) payload[crmKey] = n;
    } else {
      payload[crmKey] = raw;
    }
  }
  return payload;
}

function fromRecord(r: ZohoRecord): CRMPortfolioRecord {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };

  return {
    id:                r.id,
    companyName:       str(FIELD_MAP.companyName),
    website:           str(FIELD_MAP.website),
    location:          str(FIELD_MAP.location),
    industry:          str(FIELD_MAP.industry),
    stage:             str(FIELD_MAP.stage),
    foundedYear:       str(FIELD_MAP.foundedYear),
    teamSize:          str(FIELD_MAP.teamSize),
    shortDescription:  str(FIELD_MAP.shortDescription),
    fullDescription:   str(FIELD_MAP.fullDescription),
    tags:              str(FIELD_MAP.tags),
    investmentAmount:  str(FIELD_MAP.investmentAmount),
    investmentDate:    str(FIELD_MAP.investmentDate),
    preMoneyValuation: str(FIELD_MAP.preMoneyValuation),
    ownershipPct:      str(FIELD_MAP.ownershipPct),
    status:            str(FIELD_MAP.status),
    notes:             str(FIELD_MAP.notes),
    founderName:       str(FIELD_MAP.founderName),
    founderEmail:      str(FIELD_MAP.founderEmail),
    founderLinkedin:   str(FIELD_MAP.founderLinkedin),
    founderPhone:      str(FIELD_MAP.founderPhone),
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function fetchCRMPortfolio(): Promise<CRMPortfolioRecord[]> {
  const mod = await getModule();
  const records = await zohoList(mod, {
    per_page: '200',
    sort_by: 'Modified_Time',
    sort_order: 'desc',
  });
  return records.map(fromRecord);
}

export async function getCRMPortfolioRecord(id: string): Promise<CRMPortfolioRecord | null> {
  const mod = await getModule();
  const r = await zohoGetById(mod, id);
  return r ? fromRecord(r) : null;
}

export async function createCRMPortfolioRecord(fields: CRMFormFields): Promise<string> {
  const mod = await getModule();
  return zohoCreate(mod, toPayload(fields));
}

export async function updateCRMPortfolioRecord(id: string, fields: CRMFormFields): Promise<void> {
  const mod = await getModule();
  return zohoUpdate(mod, id, toPayload(fields));
}

export async function deleteCRMPortfolioRecord(id: string): Promise<void> {
  const mod = await getModule();
  return zohoDelete(mod, id);
}

// Expose for diagnostic use in the UI
export { findModuleApiName } from './zohoApi';
export { fetchZohoModules } from './zohoApi';

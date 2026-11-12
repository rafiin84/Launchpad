/**
 * Investments — one record per investment round in one company, in a single CRM
 * module (`Investments`). Its cash movements live as JSON in `Cash_Flows` on the
 * record (see lib/investmentCalc.ts), and `Total_Funded / Total_Realized /
 * Total_Refunded` are plain fields this file keeps in step with that ledger on
 * every write — there is no child transactions module.
 *
 * Investor-side only, read and written with the investor's own token. Who may
 * edit is Zoho's call (profile permissions on the module); the page only reads
 * the module's `creatable` / `editable` flags to hide buttons the user can't
 * use, and surfaces CRM's refusal if a write is rejected anyway.
 */
import {
  zohoList, zohoCreate, zohoUpdate, zohoGetById, zohoGetSettings, zohoUploadFile,
  downloadFieldFile, ZohoApiError, type ZohoRecord,
} from './zohoApi';
import {
  appendCashFlow, flowTotals, lastFundingDate, parseCashFlows, stringifyCashFlows,
  type CashFlow, type NewCashFlow,
} from '../lib/investmentCalc';

export const INVESTMENTS_MODULE = 'Investments';

export const ROUNDS = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D', 'Growth', 'Bridge', 'Other'] as const;
export const INSTRUMENTS = ['Common Equity', 'Preferred Equity', 'SAFE', 'Convertible Note', 'Warrant', 'Other'] as const;
export const TX_STATUSES = ['Proposed', 'Approved', 'Committed', 'Partially Funded', 'Funded', 'Cancelled', 'Closed'] as const;
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'SGD', 'AED', 'JPY', 'CAD', 'AUD', 'Other'] as const;

export interface SupportingDocument {
  /** The entry's own id — what a download needs. */
  attachmentId: string;
  /** The encrypted upload-time id — what a later "keep this file" write needs. */
  fileId: string;
  fileName: string;
}

export interface InvestmentRecord {
  id: string;
  reference: string;
  companyId: string;
  companyName: string;
  portfolioEntryId: string;
  round: string;
  instrument: string;
  investorEntity: string;
  status: string;
  currency: string;
  investmentDate: string;
  proposedAmount: number | null;
  proposedDate: string;
  approvalDate: string;
  committedAmount: number | null;
  commitmentDate: string;
  lastFundingDate: string;
  /** Stored totals — the displayed funded/realized/refunded come from `cashFlows` when any exist. */
  storedFunded: number | null;
  storedRealized: number | null;
  storedRefunded: number | null;
  preMoney: number | null;
  postMoney: number | null;
  valuationDate: string;
  pricePerShare: number | null;
  sharesAcquired: number | null;
  fullyDilutedShares: number | null;
  capTableAsOf: string;
  capTableApproved: boolean;
  capTableReference: string;
  recordedOwnershipPct: number | null;
  holdingValue: number | null;
  holdingValueAsOf: string;
  termsReference: string;
  notes: string;
  cashFlows: CashFlow[];
  documents: SupportingDocument[];
  modifiedTime: string;
}

const FIELDS = [
  'Name', 'Company', 'Portfolio_Entry', 'Round_Name', 'Instrument_Type', 'Investor_Entity',
  'Transaction_Status', 'Transaction_Currency', 'Investment_Date', 'Proposed_Amount', 'Proposed_Date',
  'Approval_Date', 'Committed_Amount', 'Commitment_Date', 'Last_Funding_Date', 'Total_Funded',
  'Total_Realized', 'Total_Refunded', 'Pre_Money_Valuation', 'Post_Money_Valuation', 'Valuation_Date',
  'Price_Per_Share', 'Shares_Acquired', 'Fully_Diluted_Shares', 'Cap_Table_As_Of', 'Cap_Table_Approved',
  'Cap_Table_Reference', 'Ownership_Percentage', 'Holding_Value', 'Holding_Value_As_Of', 'Terms_Reference',
  'Investment_Notes', 'Cash_Flows', 'Supporting_Documents', 'Modified_Time',
].join(',');

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const lookupId = (v: unknown): string => (v && typeof v === 'object' ? str((v as Record<string, unknown>).id) : '');
const lookupName = (v: unknown): string => (v && typeof v === 'object' ? str((v as Record<string, unknown>).name) : '');

/** Admin-API keys for a File Upload entry. (Portal keys differ, but this page is investor-only.) */
function parseDocuments(v: unknown): SupportingDocument[] {
  const arr = Array.isArray(v) ? v : [];
  return (arr as Record<string, unknown>[])
    .map(f => ({
      attachmentId: str(f['id'] ?? f['attachment_Id']),
      fileId: str(f['File_Id__s'] ?? f['file_Id']),
      fileName: str(f['File_Name__s'] ?? f['file_Name']),
    }))
    .filter(d => d.attachmentId);
}

function fromRecord(r: ZohoRecord): InvestmentRecord {
  return {
    id: r.id,
    reference: str(r['Name']),
    companyId: lookupId(r['Company']),
    companyName: lookupName(r['Company']),
    portfolioEntryId: lookupId(r['Portfolio_Entry']),
    round: str(r['Round_Name']),
    instrument: str(r['Instrument_Type']),
    investorEntity: str(r['Investor_Entity']),
    status: str(r['Transaction_Status']),
    currency: str(r['Transaction_Currency']),
    investmentDate: str(r['Investment_Date']),
    proposedAmount: num(r['Proposed_Amount']),
    proposedDate: str(r['Proposed_Date']),
    approvalDate: str(r['Approval_Date']),
    committedAmount: num(r['Committed_Amount']),
    commitmentDate: str(r['Commitment_Date']),
    lastFundingDate: str(r['Last_Funding_Date']),
    storedFunded: num(r['Total_Funded']),
    storedRealized: num(r['Total_Realized']),
    storedRefunded: num(r['Total_Refunded']),
    preMoney: num(r['Pre_Money_Valuation']),
    postMoney: num(r['Post_Money_Valuation']),
    valuationDate: str(r['Valuation_Date']),
    pricePerShare: num(r['Price_Per_Share']),
    sharesAcquired: num(r['Shares_Acquired']),
    fullyDilutedShares: num(r['Fully_Diluted_Shares']),
    capTableAsOf: str(r['Cap_Table_As_Of']),
    capTableApproved: r['Cap_Table_Approved'] === true || r['Cap_Table_Approved'] === 'true',
    capTableReference: str(r['Cap_Table_Reference']),
    recordedOwnershipPct: num(r['Ownership_Percentage']),
    holdingValue: num(r['Holding_Value']),
    holdingValueAsOf: str(r['Holding_Value_As_Of']),
    termsReference: str(r['Terms_Reference']),
    notes: str(r['Investment_Notes']),
    cashFlows: parseCashFlows(str(r['Cash_Flows'])),
    documents: parseDocuments(r['Supporting_Documents']),
    modifiedTime: str(r['Modified_Time']),
  };
}

/**
 * Funded / realized / refunded for display: from the dated ledger when there is
 * one, else what CRM stores. A kind of movement with no entry in the ledger is
 * "not recorded" (null), not zero — zero would claim nothing was received.
 */
export function amountsOf(inv: InvestmentRecord): { funded: number | null; realized: number | null; refunded: number | null } {
  if (inv.cashFlows.length > 0) {
    const t = flowTotals(inv.cashFlows);
    const has = (type: string) => inv.cashFlows.some(f => f.type === type);
    return {
      funded: has('Funding') ? t.funded : null,
      realized: has('Proceeds') ? t.realized : null,
      refunded: has('Refund') ? t.refunded : null,
    };
  }
  return { funded: inv.storedFunded, realized: inv.storedRealized, refunded: inv.storedRefunded };
}

export async function fetchInvestments(): Promise<InvestmentRecord[]> {
  const records = await zohoList(INVESTMENTS_MODULE, {
    per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc', fields: FIELDS,
  });
  return records.map(fromRecord);
}

async function fetchOne(id: string): Promise<InvestmentRecord> {
  const r = await zohoGetById(INVESTMENTS_MODULE, id, FIELDS);
  if (!r) throw new Error('This investment record no longer exists.');
  return fromRecord(r);
}

// ─── What the signed-in user may do ──────────────────────────────────────────

export interface InvestmentAccess {
  /** false = CRM says this user cannot; null = could not tell (CRM still enforces). */
  canCreate: boolean | null;
  canEdit: boolean | null;
}

export async function fetchInvestmentAccess(): Promise<InvestmentAccess> {
  const res = await zohoGetSettings<{ modules?: Array<Record<string, unknown>> }>(`/crm/v2/settings/modules/${INVESTMENTS_MODULE}`);
  const m = res?.modules?.[0];
  const flag = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
  return { canCreate: m ? flag(m['creatable']) : null, canEdit: m ? flag(m['editable']) : null };
}

/** True when CRM refused a write for permission reasons, so the page can say so plainly. */
export function isPermissionError(err: unknown): boolean {
  if (!(err instanceof ZohoApiError)) return false;
  return /NO_PERMISSION|NOT_ALLOWED|INSUFFICIENT|PERMISSION/i.test(err.code) || err.status === 403;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** What an editor fills in. Blank strings mean "not recorded". */
export interface InvestmentInput {
  reference: string;
  companyId: string;
  companyName: string;
  round: string;
  instrument: string;
  investorEntity: string;
  status: string;
  currency: string;
  investmentDate: string;
  proposedAmount: string;
  proposedDate: string;
  approvalDate: string;
  committedAmount: string;
  commitmentDate: string;
  preMoney: string;
  postMoney: string;
  valuationDate: string;
  pricePerShare: string;
  sharesAcquired: string;
  fullyDilutedShares: string;
  capTableAsOf: string;
  capTableApproved: boolean;
  capTableReference: string;
  recordedOwnershipPct: string;
  holdingValue: string;
  holdingValueAsOf: string;
  termsReference: string;
  notes: string;
}

export function newReference(now: Date = new Date()): string {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function emptyInvestmentInput(): InvestmentInput {
  return {
    reference: newReference(), companyId: '', companyName: '', round: '', instrument: '', investorEntity: '',
    status: 'Proposed', currency: 'USD', investmentDate: '', proposedAmount: '', proposedDate: '',
    approvalDate: '', committedAmount: '', commitmentDate: '', preMoney: '', postMoney: '', valuationDate: '',
    pricePerShare: '', sharesAcquired: '', fullyDilutedShares: '', capTableAsOf: '', capTableApproved: false,
    capTableReference: '', recordedOwnershipPct: '', holdingValue: '', holdingValueAsOf: '',
    termsReference: '', notes: '',
  };
}

export function inputFromInvestment(i: InvestmentRecord): InvestmentInput {
  const s = (n: number | null) => (n === null ? '' : String(n));
  return {
    reference: i.reference, companyId: i.companyId, companyName: i.companyName, round: i.round,
    instrument: i.instrument, investorEntity: i.investorEntity, status: i.status, currency: i.currency,
    investmentDate: i.investmentDate, proposedAmount: s(i.proposedAmount), proposedDate: i.proposedDate,
    approvalDate: i.approvalDate, committedAmount: s(i.committedAmount), commitmentDate: i.commitmentDate,
    preMoney: s(i.preMoney), postMoney: s(i.postMoney), valuationDate: i.valuationDate,
    pricePerShare: s(i.pricePerShare), sharesAcquired: s(i.sharesAcquired),
    fullyDilutedShares: s(i.fullyDilutedShares), capTableAsOf: i.capTableAsOf,
    capTableApproved: i.capTableApproved, capTableReference: i.capTableReference,
    recordedOwnershipPct: s(i.recordedOwnershipPct), holdingValue: s(i.holdingValue),
    holdingValueAsOf: i.holdingValueAsOf, termsReference: i.termsReference, notes: i.notes,
  };
}

const CLEARABLE = [
  'Round_Name', 'Instrument_Type', 'Investor_Entity', 'Investment_Date', 'Proposed_Amount', 'Proposed_Date',
  'Approval_Date', 'Committed_Amount', 'Commitment_Date', 'Pre_Money_Valuation', 'Post_Money_Valuation',
  'Valuation_Date', 'Price_Per_Share', 'Shares_Acquired', 'Fully_Diluted_Shares', 'Cap_Table_As_Of',
  'Cap_Table_Reference', 'Ownership_Percentage', 'Holding_Value', 'Holding_Value_As_Of', 'Terms_Reference',
  'Investment_Notes',
];

function toPayload(input: InvestmentInput): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  const text = (key: string, v: string) => { if (v.trim() !== '') p[key] = v.trim(); };
  const number = (key: string, v: string) => {
    if (v.trim() === '') return;
    const n = Number(v);
    if (Number.isFinite(n)) p[key] = n;
  };
  p['Name'] = input.reference.trim();
  if (input.companyId) p['Company'] = { id: input.companyId };
  text('Round_Name', input.round);
  text('Instrument_Type', input.instrument);
  text('Investor_Entity', input.investorEntity);
  text('Transaction_Status', input.status);
  text('Transaction_Currency', input.currency);
  text('Investment_Date', input.investmentDate);
  number('Proposed_Amount', input.proposedAmount);
  text('Proposed_Date', input.proposedDate);
  text('Approval_Date', input.approvalDate);
  number('Committed_Amount', input.committedAmount);
  text('Commitment_Date', input.commitmentDate);
  number('Pre_Money_Valuation', input.preMoney);
  number('Post_Money_Valuation', input.postMoney);
  text('Valuation_Date', input.valuationDate);
  number('Price_Per_Share', input.pricePerShare);
  number('Shares_Acquired', input.sharesAcquired);
  number('Fully_Diluted_Shares', input.fullyDilutedShares);
  text('Cap_Table_As_Of', input.capTableAsOf);
  p['Cap_Table_Approved'] = input.capTableApproved;
  text('Cap_Table_Reference', input.capTableReference);
  number('Ownership_Percentage', input.recordedOwnershipPct);
  number('Holding_Value', input.holdingValue);
  text('Holding_Value_As_Of', input.holdingValueAsOf);
  text('Terms_Reference', input.termsReference);
  text('Investment_Notes', input.notes);
  return p;
}

/**
 * Create a record. `portfolioEntryId` links it to the company's Portfolio
 * Management record when one exists (the page looks it up by company).
 */
export function createInvestment(input: InvestmentInput, portfolioEntryId?: string): Promise<string> {
  const payload = toPayload(input);
  if (portfolioEntryId) payload['Portfolio_Entry'] = { id: portfolioEntryId };
  return zohoCreate(INVESTMENTS_MODULE, payload);
}

/** Edit a record. Leaves Cash_Flows, the totals and the documents alone — they have their own writes. */
export async function updateInvestment(id: string, input: InvestmentInput): Promise<void> {
  const payload = toPayload(input);
  for (const key of CLEARABLE) if (!(key in payload)) payload[key] = null;
  await zohoUpdate(INVESTMENTS_MODULE, id, payload);
}

/**
 * Record a dated cash movement. A read-modify-write on `Cash_Flows` (Zoho
 * replaces a field's whole value on write): re-read the stored ledger, append,
 * and write it back together with the recomputed totals and last funding date,
 * so the stored totals can never drift from the ledger. A genuinely
 * simultaneous save from two sessions can lose one entry — the same trade-off
 * the app accepts for other JSON-in-a-field data. Throws CashFlowsFullError
 * when the ledger would not fit.
 */
export async function addCashFlow(id: string, input: NewCashFlow): Promise<InvestmentRecord> {
  const current = await zohoGetById(INVESTMENTS_MODULE, id, 'Cash_Flows');
  const flows = appendCashFlow(str(current?.['Cash_Flows']), input);
  const totals = flowTotals(flows);
  await zohoUpdate(INVESTMENTS_MODULE, id, {
    Cash_Flows: stringifyCashFlows(flows),
    Total_Funded: totals.funded,
    Total_Realized: totals.realized,
    Total_Refunded: totals.refunded,
    Last_Funding_Date: lastFundingDate(flows) || null,
  });
  return fetchOne(id);
}

// ─── Supporting documents ────────────────────────────────────────────────────

export class SingleFileFieldError extends Error {
  constructor() { super('SINGLE_FILE_FIELD'); this.name = 'SingleFileFieldError'; }
}

/** How many files Supporting_Documents may hold (its `length` in field metadata); 1 means "multiple files" is off. */
async function supportingDocumentsLimit(): Promise<number | null> {
  const res = await zohoGetSettings<{ fields?: Array<{ api_name?: string; length?: number }> }>(
    `/crm/v2/settings/fields?module=${INVESTMENTS_MODULE}`);
  const f = res?.fields?.find(x => x.api_name === 'Supporting_Documents');
  return typeof f?.length === 'number' ? f.length : null;
}

/**
 * Attach a file to the record's Supporting_Documents, keeping the files already
 * there (Zoho replaces the field's whole contents on write, so the existing
 * `file_id`s are re-submitted alongside the new one). If CRM is set to a single
 * file and one is already attached, refuse BEFORE writing — otherwise the
 * existing document would be silently replaced.
 */
export async function uploadSupportingDocument(id: string, file: File): Promise<InvestmentRecord> {
  const current = await zohoGetById(INVESTMENTS_MODULE, id, 'Supporting_Documents');
  const existing = parseDocuments(current?.['Supporting_Documents']);
  if (existing.length > 0) {
    const limit = await supportingDocumentsLimit();
    if (limit !== null && existing.length >= limit) throw new SingleFileFieldError();
  }
  const fileId = await zohoUploadFile(file, file.name);
  const keep = existing.map(d => ({ file_id: d.fileId })).filter(d => d.file_id);
  await zohoUpdate(INVESTMENTS_MODULE, id, { Supporting_Documents: [...keep, { file_id: fileId }] });
  return fetchOne(id);
}

/** Fetches one supporting document fresh and returns a blob URL (caller revokes it). */
export async function resolveSupportingDocumentUrl(id: string, attachmentId: string): Promise<string> {
  const current = await zohoGetById(INVESTMENTS_MODULE, id, 'Supporting_Documents');
  if (!parseDocuments(current?.['Supporting_Documents']).some(d => d.attachmentId === attachmentId)) {
    throw new Error('This file is no longer attached to the record.');
  }
  const blob = await downloadFieldFile(INVESTMENTS_MODULE, id, attachmentId, false);
  return URL.createObjectURL(blob);
}

/**
 * Finance Reports — the one CRM module (`Finance_Reports`) behind the Finance
 * Update tab. One record per VERSION of a report: a founder submits a period, and
 * submitting it again adds version N+1 instead of editing the old record, so the
 * version history is simply the set of records for a period.
 *
 * Who can do what, and why it is safe:
 *  - A founder writes with their own portal token and only reaches their own
 *    records (Zoho scopes a portal user to records associated with their
 *    Contact). They can edit a Draft in place; anything already submitted is
 *    never edited — a correction is a new version.
 *  - An investor reads with their own token. Whether they can see a given
 *    company's reports is Zoho's call (profile + record sharing), so the app
 *    never widens it. Drafts are never requested for an investor.
 *  - Review fields (Review_Status, Reviewed_By, Reviewed_On, Review_Notes) are
 *    written by investors only. Founders must be set to read-only on them under
 *    Setup → Portals → Field Permissions — that is what stops a founder from
 *    approving their own report; the app also never sends them from a founder.
 */
import {
  zohoList, zohoUpdate, portalCreate, portalList, portalUpdate, type ZohoRecord,
} from './zohoApi';
import {
  METRICS, STATUS, nextVersion, periodBounds, periodKey, periodLabel, groupByPeriod, isFrequency,
  type FinanceReport, type Frequency, type Metrics,
} from '../lib/financeReports';

export const FINANCE_MODULE = 'Finance_Reports';

const FIELDS = [
  'Name', 'Founder_Company', 'Frequency', 'Period_Year', 'Period_Number', 'Period_Start', 'Period_End',
  'Report_Currency', ...METRICS.map(m => m.field), 'Review_Status', 'Submitted_On', 'Submitted_By',
  'Submitted_By_Email', 'Reviewed_By', 'Reviewed_On', 'Review_Notes', 'Version', 'Founder_Notes', 'Modified_Time',
].join(',');

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const lookupId = (v: unknown): string => (v && typeof v === 'object' ? str((v as Record<string, unknown>).id) : '');

function fromRecord(r: ZohoRecord): FinanceReport {
  const m = {} as Metrics;
  for (const def of METRICS) m[def.key] = num(r[def.field]);
  return {
    ...m,
    id: r.id,
    name: str(r['Name']),
    founderCompanyId: lookupId(r['Founder_Company']),
    frequency: str(r['Frequency']),
    year: num(r['Period_Year']) ?? 0,
    number: num(r['Period_Number']) ?? 0,
    periodStart: str(r['Period_Start']),
    periodEnd: str(r['Period_End']),
    currency: str(r['Report_Currency']),
    status: str(r['Review_Status']) || STATUS.submitted,
    submittedOn: str(r['Submitted_On']),
    submittedBy: str(r['Submitted_By']),
    submittedByEmail: str(r['Submitted_By_Email']),
    reviewedBy: str(r['Reviewed_By']),
    reviewedOn: str(r['Reviewed_On']),
    reviewNotes: str(r['Review_Notes']),
    version: num(r['Version']) ?? 1,
    founderNotes: str(r['Founder_Notes']),
    modifiedTime: str(r['Modified_Time']),
  };
}

/** Zoho wants a datetime as yyyy-MM-ddTHH:mm:ss±HH:mm. */
const zohoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

/**
 * An investor's view of a company's reports: every version CRM lets them read,
 * except drafts (a draft is the founder's working copy, not a report).
 *
 * This is a plain list + client-side filter, not a search criteria query:
 * `Founder_Company` is a lookup field, and Zoho's Search Records API does not
 * support `equals` on lookup fields (nor `not_equal` on any field) — trying it
 * returns "Invalid query formed". Filtering client-side only narrows what the
 * investor's own token already returned, so it never widens access.
 */
export async function fetchReportsForInvestor(founderCompanyId: string): Promise<FinanceReport[]> {
  const records = await zohoList(FINANCE_MODULE, {
    per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc', fields: FIELDS,
  });
  return records.map(fromRecord).filter(r => r.founderCompanyId === founderCompanyId && r.status !== STATUS.draft && isFrequency(r.frequency));
}

/** A founder's own reports, drafts included — Zoho returns only the portal user's own records. */
export async function fetchReportsForFounder(): Promise<FinanceReport[]> {
  const records = await portalList(FINANCE_MODULE, { per_page: '200', fields: FIELDS });
  return records.map(fromRecord).filter(r => isFrequency(r.frequency));
}

export interface SubmitInput {
  founderCompanyId: string;
  companyName: string;
  frequency: Frequency;
  year: number;
  number: number;
  currency: string;
  metrics: Metrics;
  founderNotes: string;
  submitter: { name: string; email: string };
  /** Save without sending: stays a Draft the investor never sees. */
  asDraft: boolean;
  /** Every version this founder already has for any period (used to number the new one). */
  existing: FinanceReport[];
}

/**
 * Save a founder's report. A Draft for the period is edited in place; submitting
 * promotes it. Anything already submitted is left untouched — a correction is
 * written as the next version. Review fields are never included.
 */
export async function saveFounderReport(i: SubmitInput): Promise<string> {
  const versions = groupByPeriod(i.existing).get(periodKey({ frequency: i.frequency, year: i.year, number: i.number })) ?? [];
  const draft = versions.find(v => v.status === STATUS.draft);
  const version = draft ? draft.version : nextVersion(versions);
  const { start, end } = periodBounds(i.frequency, i.year, i.number);

  const payload: Record<string, unknown> = {
    Name: `${i.companyName} · ${periodLabel(i.frequency, i.year, i.number)} · v${version}`,
    Founder_Company: { id: i.founderCompanyId },
    Frequency: i.frequency, Period_Year: i.year, Period_Number: i.number, Period_Start: start, Period_End: end,
    Report_Currency: i.currency, Version: version, Founder_Notes: i.founderNotes.trim() || null,
    Submitted_By: i.submitter.name, Submitted_By_Email: i.submitter.email,
    Review_Status: i.asDraft ? STATUS.draft : STATUS.submitted,
    Submitted_On: i.asDraft ? null : zohoNow(),
  };
  for (const def of METRICS) payload[def.field] = i.metrics[def.key];

  if (draft) { await portalUpdate(FINANCE_MODULE, draft.id, payload); return draft.id; }
  // A brand-new record carries no empty values.
  for (const k of Object.keys(payload)) if (payload[k] === null) delete payload[k];
  return portalCreate(FINANCE_MODULE, payload);
}

export const REVIEW_STATUSES = [STATUS.underReview, STATUS.approved, STATUS.needsChanges] as const;

/** An investor records their review of one version. Only the review fields are written. */
export function reviewReport(id: string, status: string, notes: string, reviewerName: string): Promise<void> {
  return zohoUpdate(FINANCE_MODULE, id, {
    Review_Status: status, Reviewed_By: reviewerName, Reviewed_On: zohoNow(), Review_Notes: notes.trim() || null,
  });
}

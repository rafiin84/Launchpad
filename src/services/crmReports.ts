/**
 * Reports & Analytics — data loading and saved report views.
 *
 * A report is never stored as source data: it is computed on the page from
 * Investments and Portfolio Management (lib/reportAnalytics.ts). The only CRM
 * module this page owns is `Reports_Analytics`, where each record is a saved
 * report view — the filters, the currency-conversion policy and rates used, and
 * a small snapshot of the figures at the time it was saved, with its data-as-of
 * timestamp.
 *
 * Everything is read with the signed-in investor's own token, so CRM applies
 * record- and field-level permissions before any data reaches the report; an
 * export is built from the same already-permitted data. If the user cannot read
 * a source module, the report is built without it and says so.
 */
import { zohoList, zohoCreate, zohoUpdate, ZohoApiError, type ZohoRecord } from './zohoApi';
import { fetchInvestments, type InvestmentRecord } from './crmInvestments';
import { fetchPortfolioEntries, type PortfolioEntry } from './crmPortfolioManagement';
import {
  METHODOLOGY_VERSION, POLICY_TO_CRM, TAB_TO_REPORT_TYPE, REPORT_TABS, emptyFilters,
  type ConversionPolicy, type Report, type ReportFilters, type ReportTab,
} from '../lib/reportAnalytics';

export const REPORTS_MODULE = 'Reports_Analytics';

export interface ReportSources {
  investments: InvestmentRecord[];
  entries: PortfolioEntry[];
  /** When the data was read (ISO) — the report's data-as-of timestamp. */
  fetchedAt: string;
  /** Portfolio Management could not be read (e.g. no permission on that module). */
  portfolioUnavailable: boolean;
}

/**
 * Read both sources. Investments are required — without them there is no report,
 * so a failure is thrown. Portfolio Management only adds company detail, so if
 * the user cannot read it the report continues without it, flagged.
 */
export async function loadReportSources(): Promise<ReportSources> {
  const [investments, entries] = await Promise.all([
    fetchInvestments(),
    fetchPortfolioEntries().then(e => ({ ok: true as const, e })).catch(() => ({ ok: false as const, e: [] as PortfolioEntry[] })),
  ]);
  return { investments, entries: entries.e, fetchedAt: new Date().toISOString(), portfolioUnavailable: !entries.ok };
}

// ─── Saved views ─────────────────────────────────────────────────────────────

export interface SavedView {
  id: string;
  name: string;
  tab: ReportTab;
  filters: ReportFilters;
  dataAsOf: string;
  modifiedTime: string;
}

const FIELDS = [
  'Name', 'Report_Type', 'Period_Start', 'Period_End', 'Fund', 'Company', 'Sector', 'Stage', 'Report_Currency',
  'Conversion_Policy', 'Conversion_Rate_Date', 'Conversion_Rates', 'Data_As_Of', 'Modified_Time',
].join(',');

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const lookupId = (v: unknown): string => (v && typeof v === 'object' ? str((v as Record<string, unknown>).id) : '');

function parseRates(json: string): Record<string, number> {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch { return {}; }
}

function fromRecord(r: ZohoRecord): SavedView {
  const type = str(r['Report_Type']);
  const tab = REPORT_TABS.find(t => TAB_TO_REPORT_TYPE[t] === type) ?? 'summary';
  const policy: ConversionPolicy = str(r['Conversion_Policy']) === POLICY_TO_CRM.report_date ? 'report_date' : 'none';
  return {
    id: r.id,
    name: str(r['Name']),
    tab,
    filters: {
      ...emptyFilters(),
      periodStart: str(r['Period_Start']), periodEnd: str(r['Period_End']), fund: str(r['Fund']),
      companyId: lookupId(r['Company']), sector: str(r['Sector']), stage: str(r['Stage']),
      currency: str(r['Report_Currency']), policy, rateDate: str(r['Conversion_Rate_Date']),
      rates: parseRates(str(r['Conversion_Rates'])),
    },
    dataAsOf: str(r['Data_As_Of']),
    modifiedTime: str(r['Modified_Time']),
  };
}

export async function fetchSavedViews(): Promise<SavedView[]> {
  const records = await zohoList(REPORTS_MODULE, {
    per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc', fields: FIELDS,
  });
  return records.map(fromRecord);
}

/** Zoho wants a datetime as yyyy-MM-ddTHH:mm:ss±HH:mm. */
const zohoDateTime = (iso: string) => iso.replace(/\.\d{3}Z$/, '+00:00');

/** A deliberately small snapshot: the headline figures and what was excluded, not the whole report. */
function snapshotOf(report: Report): string {
  return JSON.stringify({
    methodologyVersion: METHODOLOGY_VERSION,
    currency: report.currency,
    periodEnd: report.periodEnd,
    conversion: report.conversion,
    summary: { ...report.summary, distribution: undefined },
    returns: { moic: report.returns.moic, irrPct: report.returns.irrPct, eligible: report.returns.eligible, total: report.returns.total },
    exclusions: report.exclusions.map(e => ({ kind: e.kind, count: e.count, detail: e.detail })),
  });
}

function toPayload(name: string, tab: ReportTab, f: ReportFilters, report: Report): Record<string, unknown> {
  const p: Record<string, unknown> = {
    Name: name.trim(),
    Report_Type: TAB_TO_REPORT_TYPE[tab],
    Conversion_Policy: POLICY_TO_CRM[f.policy],
    Data_As_Of: zohoDateTime(report.asOf),
    Methodology_Version: METHODOLOGY_VERSION,
    Report_Snapshot: snapshotOf(report),
    // Explicit nulls so loading a view and re-saving it with a filter cleared really clears it.
    Period_Start: f.periodStart || null, Period_End: f.periodEnd || null, Fund: f.fund || null,
    Company: f.companyId ? { id: f.companyId } : null, Sector: f.sector || null, Stage: f.stage || null,
    // The saved currency is the one the report used, so the view reproduces the same numbers.
    Report_Currency: report.currency || null,
    Conversion_Rate_Date: f.policy === 'report_date' && f.rateDate ? f.rateDate : null,
    Conversion_Rates: f.policy === 'report_date' ? JSON.stringify(f.rates) : null,
  };
  return p;
}

export function createSavedView(name: string, tab: ReportTab, f: ReportFilters, report: Report): Promise<string> {
  const payload = toPayload(name, tab, f, report);
  for (const k of Object.keys(payload)) if (payload[k] === null) delete payload[k]; // nothing to clear on create
  return zohoCreate(REPORTS_MODULE, payload);
}

export function updateSavedView(id: string, name: string, tab: ReportTab, f: ReportFilters, report: Report): Promise<void> {
  return zohoUpdate(REPORTS_MODULE, id, toPayload(name, tab, f, report));
}

/** True when CRM refused a write for permission reasons, so the page can say so plainly. */
export function isReportPermissionError(err: unknown): boolean {
  if (!(err instanceof ZohoApiError)) return false;
  return /NO_PERMISSION|NOT_ALLOWED|INSUFFICIENT|PERMISSION/i.test(err.code) || err.status === 403;
}

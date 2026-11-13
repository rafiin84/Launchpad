/**
 * Finance reports — pure helpers (no I/O) for the Finance Reports module: one CRM
 * record per submitted report, one record per VERSION of a report. A period is
 * identified by (frequency, year, number); re-submitting a period never edits
 * the old record, it adds version N+1, so the history is the set of records.
 *
 * What is NOT hardcoded here: nothing about a company's numbers. What is code:
 * the arithmetic that turns a frequency into a calendar period, and the names of
 * the review states the workflow reasons about (their display values and the
 * list of options come from the CRM picklists at runtime; see fetchFieldPicklists).
 */

/** Months in one reporting period, per frequency. Calendar maths needs this; the option list itself comes from CRM. */
export const FREQUENCY_MONTHS = { Monthly: 1, Quarterly: 3, 'Half-yearly': 6, Yearly: 12 } as const;
export type Frequency = keyof typeof FREQUENCY_MONTHS;
export const isFrequency = (v: string): v is Frequency => v in FREQUENCY_MONTHS;

/** The review states the workflow reasons about. */
export const STATUS = {
  draft: 'Draft', submitted: 'Submitted', underReview: 'Under Review', approved: 'Approved', needsChanges: 'Needs Changes',
} as const;

export interface Metrics {
  revenue: number | null; mrr: number | null; arr: number | null; expenses: number | null;
  netProfit: number | null; cash: number | null; burn: number | null; runway: number | null;
  customers: number | null; mom: number | null; yoy: number | null; employees: number | null;
}
export type MetricKey = keyof Metrics;

export interface MetricDef {
  key: MetricKey;
  /** The CRM field API name on Finance_Reports. */
  field: string;
  kind: 'money' | 'count' | 'percent' | 'months';
  /** MRR/ARR/growth are "where applicable", so they are optional. */
  required: boolean;
}

export const METRICS: MetricDef[] = [
  { key: 'revenue', field: 'Revenue', kind: 'money', required: true },
  { key: 'mrr', field: 'MRR', kind: 'money', required: false },
  { key: 'arr', field: 'ARR', kind: 'money', required: false },
  { key: 'expenses', field: 'Expenses', kind: 'money', required: true },
  { key: 'netProfit', field: 'Net_Profit_Loss', kind: 'money', required: true },
  { key: 'cash', field: 'Cash_Balance', kind: 'money', required: true },
  { key: 'burn', field: 'Burn_Rate', kind: 'money', required: true },
  { key: 'runway', field: 'Runway_Months', kind: 'months', required: true },
  { key: 'customers', field: 'Customer_Count', kind: 'count', required: true },
  { key: 'mom', field: 'MoM_Growth', kind: 'percent', required: false },
  { key: 'yoy', field: 'YoY_Growth', kind: 'percent', required: false },
  { key: 'employees', field: 'Employee_Count', kind: 'count', required: true },
];

export interface FinanceReport extends Metrics {
  id: string;
  name: string;
  founderCompanyId: string;
  frequency: string;
  year: number;
  number: number;
  periodStart: string;
  periodEnd: string;
  currency: string;
  status: string;
  submittedOn: string;
  submittedBy: string;
  submittedByEmail: string;
  reviewedBy: string;
  reviewedOn: string;
  reviewNotes: string;
  version: number;
  founderNotes: string;
  modifiedTime: string;
}

// ─── Calendar periods ────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const periodsPerYear = (f: Frequency) => 12 / FREQUENCY_MONTHS[f];

/** First and last day of a period. `number` is 1-based within the year (month, quarter, half, or 1 for a year). */
export function periodBounds(f: Frequency, year: number, number: number): { start: string; end: string } {
  const months = FREQUENCY_MONTHS[f];
  const startMonth = (number - 1) * months + 1;
  const endMonth = startMonth + months - 1;
  return { start: iso(year, startMonth, 1), end: iso(year, endMonth, lastDay(year, endMonth)) };
}

export function periodLabel(f: Frequency, year: number, number: number, locale = 'en-US'): string {
  switch (f) {
    case 'Monthly': return new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    case 'Quarterly': return `Q${number} ${year}`;
    case 'Half-yearly': return `H${number} ${year}`;
    default: return String(year);
  }
}

/** The period that contains `today` (YYYY-MM-DD). */
export function periodContaining(f: Frequency, today: string): { year: number; number: number } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return { year, number: Math.ceil(month / FREQUENCY_MONTHS[f]) };
}

export function previousPeriod(f: Frequency, year: number, number: number): { year: number; number: number } {
  return number > 1 ? { year, number: number - 1 } : { year: year - 1, number: periodsPerYear(f) };
}

/** The most recent `count` periods ending with the one containing `today`, newest first. */
export function recentPeriods(f: Frequency, today: string, count: number): Array<{ year: number; number: number }> {
  const out: Array<{ year: number; number: number }> = [];
  let p = periodContaining(f, today);
  for (let i = 0; i < count; i++) { out.push(p); p = previousPeriod(f, p.year, p.number); }
  return out;
}

// ─── Versions and the latest report per period ───────────────────────────────

export const periodKey = (r: { frequency: string; year: number; number: number }) => `${r.frequency}|${r.year}|${r.number}`;

/** All versions of each period, newest version first. */
export function groupByPeriod(reports: FinanceReport[]): Map<string, FinanceReport[]> {
  const m = new Map<string, FinanceReport[]>();
  for (const r of reports) {
    const k = periodKey(r);
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  for (const [k, v] of m) m.set(k, v.sort((a, b) => b.version - a.version || b.submittedOn.localeCompare(a.submittedOn)));
  return m;
}

/** The newest version of every period, oldest period first. */
export function latestPerPeriod(reports: FinanceReport[]): FinanceReport[] {
  return [...groupByPeriod(reports).values()].map(v => v[0]).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

export const nextVersion = (versions: FinanceReport[]) => versions.reduce((m, v) => Math.max(m, v.version), 0) + 1;

// ─── Reporting status ────────────────────────────────────────────────────────

export type ReportingState = 'submitted' | 'draft' | 'inProgress' | 'overdue';

export interface PeriodStatus {
  year: number;
  number: number;
  start: string;
  end: string;
  state: ReportingState;
  /** The newest version, when there is one. */
  report: FinanceReport | null;
}

/**
 * One row per recent period for a frequency: the newest submitted version if any
 * (its own review status says where it stands), a draft the founder hasn't sent,
 * a period still running, or one that ended with nothing submitted — overdue.
 */
export function reportingStatus(f: Frequency, reports: FinanceReport[], today: string, count: number): PeriodStatus[] {
  const groups = groupByPeriod(reports.filter(r => r.frequency === f));
  return recentPeriods(f, today, count).map(({ year, number }) => {
    const { start, end } = periodBounds(f, year, number);
    const versions = groups.get(periodKey({ frequency: f, year, number })) ?? [];
    const sent = versions.find(v => v.status !== STATUS.draft);
    if (sent) return { year, number, start, end, state: 'submitted' as const, report: sent };
    if (versions.length > 0) return { year, number, start, end, state: 'draft' as const, report: versions[0] };
    return { year, number, start, end, state: end >= today ? 'inProgress' as const : 'overdue' as const, report: null };
  });
}

// ─── Form helpers ────────────────────────────────────────────────────────────

export type MetricInput = Record<MetricKey, string>;
export const emptyMetricInput = (): MetricInput =>
  Object.fromEntries(METRICS.map(m => [m.key, ''])) as MetricInput;

export function metricInputFrom(r: Metrics): MetricInput {
  return Object.fromEntries(METRICS.map(m => [m.key, r[m.key] === null ? '' : String(r[m.key])])) as MetricInput;
}

export type MetricErrors = Partial<Record<MetricKey, 'required' | 'number' | 'negative'>>;

/** Required metrics must be present; every given value must be a number; counts, runway and money-out can't be negative. */
export function validateMetrics(input: MetricInput): MetricErrors {
  const errors: MetricErrors = {};
  for (const m of METRICS) {
    const raw = input[m.key].trim();
    if (raw === '') { if (m.required) errors[m.key] = 'required'; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) { errors[m.key] = 'number'; continue; }
    const mayBeNegative = m.key === 'netProfit' || m.key === 'mom' || m.key === 'yoy' || m.key === 'cash';
    if (n < 0 && !mayBeNegative) errors[m.key] = 'negative';
  }
  return errors;
}

export function toMetrics(input: MetricInput): Metrics {
  const out = {} as Metrics;
  for (const m of METRICS) {
    const raw = input[m.key].trim();
    out[m.key] = raw === '' ? null : Number(raw);
  }
  return out;
}

/** Net profit/loss from the two numbers the founder already gave. */
export const suggestNetProfit = (revenue: number | null, expenses: number | null): number | null =>
  revenue === null || expenses === null ? null : revenue - expenses;

/**
 * Growth worked out from the founder's own earlier reports: month-over-month
 * (monthly reporting only) against the prior period's revenue, and year-over-year
 * against the same period a year earlier. Null when the earlier report isn't there.
 */
export function suggestGrowth(
  latest: FinanceReport[], f: Frequency, year: number, number: number, revenue: number | null,
): { mom: number | null; yoy: number | null } {
  if (revenue === null) return { mom: null, yoy: null };
  const find = (y: number, n: number) => latest.find(r => r.frequency === f && r.year === y && r.number === n && r.status !== STATUS.draft);
  const pct = (prev: FinanceReport | undefined) => (prev && prev.revenue !== null && prev.revenue > 0 ? (revenue / prev.revenue - 1) * 100 : null);
  const prior = previousPeriod(f, year, number);
  return { mom: f === 'Monthly' ? pct(find(prior.year, prior.number)) : null, yoy: pct(find(year - 1, number)) };
}

// ─── Comparison ──────────────────────────────────────────────────────────────

export interface MetricDelta { key: MetricKey; a: number | null; b: number | null; delta: number | null; pct: number | null }

/** b relative to a, per metric. A change from zero has no percentage. */
export function compareReports(a: Metrics, b: Metrics): MetricDelta[] {
  return METRICS.map(({ key }) => {
    const x = a[key], y = b[key];
    const delta = x === null || y === null ? null : y - x;
    const pct = delta === null || x === null || x === 0 ? null : (delta / Math.abs(x)) * 100;
    return { key, a: x, b: y, delta, pct };
  });
}

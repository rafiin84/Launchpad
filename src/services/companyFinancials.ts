// ─────────────────────────────────────────────────────────────────────────────
//  Company financials — quarterly summary maintained by the Level 1 Reviewer.
//
//  Flow:  Founder uploads quarterly documents (Documents page)
//           → Level 1 Reviewer reviews them
//           → Reviewer enters the structured quarterly summary (Finance Update)
//           → Investors read the verified figures on the Company page
//
//  Storage: no new module. The whole series lives as JSON in the existing
//  Portfolios record's `Financial_Data` field — the same pattern the codebase
//  already uses for Requested_Documents and Shortlist_Review.
//
//  Design: the reviewer enters only RAW inputs, and every derived figure
//  (margins, EBITDA, net profit, burn, runway, equity) is computed here. If
//  margins were stored they could drift out of step with revenue; computed,
//  they always reconcile. Only QUARTERS are entered — H1/H2/FY are aggregated,
//  so the halves can never disagree with the quarters that make them up.
// ─────────────────────────────────────────────────────────────────────────────

import { zohoGetById, zohoUpdate, portalGetById, portalUpdate } from './zohoApi';
import { loadRole } from './oauth';

const MODULE = 'Portfolios';
const FIELD = 'Financial_Data';

function isPortalUser(): boolean {
  return loadRole() === 'founder';
}

// ─── Period identity ─────────────────────────────────────────────────────────

export type Quarter = 1 | 2 | 3 | 4;
export type ViewMode = 'quarterly' | 'half' | 'yearly';

/** A period label as shown in the UI: "Q1 FY2026", "H1 FY2026", "FY2026". */
export interface PeriodKey {
  year: number;
  /** 1-4 for quarters, 'H1' | 'H2' for halves, 'FY' for a full year. */
  span: Quarter | 'H1' | 'H2' | 'FY';
}

export function periodLabel(p: PeriodKey): string {
  if (p.span === 'FY') return `FY${p.year}`;
  if (p.span === 'H1' || p.span === 'H2') return `${p.span} FY${p.year}`;
  return `Q${p.span} FY${p.year}`;
}

// ─── What the reviewer enters ────────────────────────────────────────────────

/**
 * Raw inputs for one quarter. Every value is a plain number in the company's
 * reporting currency; undefined means "not provided" and is treated as absent
 * rather than zero, so a blank field never silently reads as a real 0.
 */
export interface FinancialInputs {
  revenue?: number;
  cogs?: number;
  salaryExpenses?: number;
  operatingExpenses?: number;
  depreciation?: number;
  interest?: number;
  tax?: number;
  cashInflow?: number;
  cashOutflow?: number;
  openingCash?: number;
  accountsReceivable?: number;
  accountsPayable?: number;
  totalAssets?: number;
  totalLiabilities?: number;
}

export const INPUT_KEYS: (keyof FinancialInputs)[] = [
  'revenue', 'cogs', 'salaryExpenses', 'operatingExpenses',
  'depreciation', 'interest', 'tax',
  'cashInflow', 'cashOutflow', 'openingCash',
  'accountsReceivable', 'accountsPayable', 'totalAssets', 'totalLiabilities',
];

/**
 * Flow items accumulate over a period, so aggregating means summing them.
 * Balance items are a snapshot at a point in time — summing four quarters of
 * closing cash would be meaningless, so those take the period-end value.
 */
const FLOW_KEYS: (keyof FinancialInputs)[] = [
  'revenue', 'cogs', 'salaryExpenses', 'operatingExpenses',
  'depreciation', 'interest', 'tax', 'cashInflow', 'cashOutflow',
];

const BALANCE_END_KEYS: (keyof FinancialInputs)[] = [
  'accountsReceivable', 'accountsPayable', 'totalAssets', 'totalLiabilities',
];

/**
 * Who supplied a set of figures.
 *   'founder'  — self-reported by the company, not yet checked
 *   'reviewer' — entered by the Level 1 Reviewer from the source documents
 *
 * Both can exist for the same quarter, and that is the point: the gap between
 * what a company reports and what its documents support is exactly what an
 * investor wants to see. Verified figures lead; the self-reported set is kept
 * alongside rather than overwritten.
 */
export type EntrySource = 'founder' | 'reviewer';

/** One stored quarter from one source. */
export interface FinancialEntry extends FinancialInputs {
  year: number;
  quarter: Quarter;
  /** Defaults to 'reviewer' for entries written before sources existed. */
  source?: EntrySource;
  /** Whoever entered these figures — the reviewer, or the founder themselves. */
  reviewer: string;
  reviewerEmail?: string;
  updatedAt: string;
  /** Commentary on the figures. */
  notes?: string;
  /** CRM record ids of the founder-uploaded documents these figures came from. */
  sourceDocumentIds?: string[];
}

export function entrySource(e: FinancialEntry): EntrySource {
  return e.source === 'founder' ? 'founder' : 'reviewer';
}

// ─── Derived figures ─────────────────────────────────────────────────────────

export interface DerivedFinancials {
  grossProfit?: number;
  grossMargin?: number;        // %
  totalExpenses?: number;
  ebitda?: number;
  ebitdaMargin?: number;       // %
  pbt?: number;
  netProfit?: number;
  netMargin?: number;          // %
  closingCash?: number;
  /** Average monthly net cash burn. Positive = burning, negative = generating. */
  burnRate?: number;
  /** Months of runway at the current burn. undefined when not burning. */
  runwayMonths?: number;
  equity?: number;
}

export type FinancialRow = FinancialInputs & DerivedFinancials & {
  key: PeriodKey;
  label: string;
  /** Quarters that contributed — 1 for a quarter, 2 for a half, up to 4 for FY. */
  quarterCount: number;
  reviewer?: string;
  updatedAt?: string;
  notes?: string;
  sourceDocumentIds?: string[];
  /** 'reviewer' when every contributing quarter was verified, else 'founder'. */
  provenance?: EntrySource;
  /** True when the period mixes verified and self-reported quarters. */
  mixedProvenance?: boolean;
};

/** Adds two possibly-absent numbers; absent + absent stays absent. */
function add(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return (a ?? 0) + (b ?? 0);
}

/** Subtracts, preserving "absent" when neither side has a value. */
function sub(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return (a ?? 0) - (b ?? 0);
}

/** Percentage of a base, guarding division by zero. */
function pct(value: number | undefined, base: number | undefined): number | undefined {
  if (value === undefined || !base) return undefined;
  return (value / base) * 100;
}

/**
 * Computes every derived figure from the raw inputs.
 *
 *   Gross Profit   = Revenue − COGS
 *   Total Expenses = COGS + Salary + Operating + Depreciation + Interest
 *   EBITDA         = Revenue − COGS − Salary − Operating
 *   PBT            = EBITDA − Depreciation − Interest
 *   Net Profit     = PBT − Tax
 *   Closing Cash   = Opening Cash + Inflow − Outflow
 *   Burn Rate      = (Outflow − Inflow) / months        (monthly average)
 *   Runway         = Closing Cash / Burn Rate           (only while burning)
 *   Equity         = Total Assets − Total Liabilities
 */
export function computeDerived(input: FinancialInputs, months = 3): DerivedFinancials {
  const grossProfit = sub(input.revenue, input.cogs);

  const totalExpenses = [input.cogs, input.salaryExpenses, input.operatingExpenses,
    input.depreciation, input.interest]
    .reduce<number | undefined>((acc, v) => add(acc, v), undefined);

  const ebitda = sub(sub(grossProfit, input.salaryExpenses), input.operatingExpenses);
  const pbt = sub(sub(ebitda, input.depreciation), input.interest);
  const netProfit = sub(pbt, input.tax);

  const closingCash = input.openingCash === undefined
      && input.cashInflow === undefined && input.cashOutflow === undefined
    ? undefined
    : (input.openingCash ?? 0) + (input.cashInflow ?? 0) - (input.cashOutflow ?? 0);

  const netCashChange = sub(input.cashOutflow, input.cashInflow);
  const burnRate = netCashChange === undefined || months <= 0
    ? undefined
    : netCashChange / months;

  // Runway only means something while cash is actually going out.
  const runwayMonths = burnRate !== undefined && burnRate > 0 && closingCash !== undefined && closingCash > 0
    ? closingCash / burnRate
    : undefined;

  const equity = sub(input.totalAssets, input.totalLiabilities);

  return {
    grossProfit,
    grossMargin: pct(grossProfit, input.revenue),
    totalExpenses,
    ebitda,
    ebitdaMargin: pct(ebitda, input.revenue),
    pbt,
    netProfit,
    netMargin: pct(netProfit, input.revenue),
    closingCash,
    burnRate,
    runwayMonths,
    equity,
  };
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export function parseFinancials(json: string): FinancialEntry[] {
  if (!json || !json.trim()) return [];
  try {
    const parsed = JSON.parse(json) as { periods?: unknown } | unknown[];
    const raw = Array.isArray(parsed) ? parsed : (parsed as { periods?: unknown }).periods;
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: FinancialEntry[] = [];
    for (const r of raw as Record<string, unknown>[]) {
      const year = Number(r.year);
      const quarter = Number(r.quarter) as Quarter;
      if (!Number.isFinite(year) || ![1, 2, 3, 4].includes(quarter)) continue;
      const source: EntrySource = r.source === 'founder' ? 'founder' : 'reviewer';
      // One entry per year/quarter PER SOURCE — a founder's self-reported
      // figures and the reviewer's verified ones coexist.
      const id = `${year}-${quarter}-${source}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const entry: FinancialEntry = {
        year, quarter, source,
        reviewer: String(r.reviewer ?? ''),
        reviewerEmail: r.reviewerEmail ? String(r.reviewerEmail) : undefined,
        updatedAt: String(r.updatedAt ?? ''),
        notes: r.notes ? String(r.notes) : undefined,
        sourceDocumentIds: Array.isArray(r.sourceDocumentIds)
          ? (r.sourceDocumentIds as unknown[]).map(String) : undefined,
      };
      for (const k of INPUT_KEYS) {
        const v = r[k];
        if (v === null || v === undefined || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) entry[k] = n;
      }
      out.push(entry);
    }
    return sortEntries(out);
  } catch {
    return [];
  }
}

export function stringifyFinancials(entries: FinancialEntry[]): string {
  return JSON.stringify({ periods: sortEntries(entries) });
}

function sortEntries(entries: FinancialEntry[]): FinancialEntry[] {
  return [...entries].sort((a, b) =>
    a.year - b.year || a.quarter - b.quarter
    || entrySource(a).localeCompare(entrySource(b)));
}

// ─── Founder access path ─────────────────────────────────────────────────────
//
// crmPortfolio.ts reads Portfolios with the investor's own CRM token, which a
// founder does not have: portal tokens are only valid against the portal host,
// and that host does not expose the Portfolios module. The app's existing
// /api/portal-crm-proxy does — 'portfolios' is on its allowlist — so the
// founder path goes through it. It is the same route the app already uses for
// founder-side CRM access.

interface ProxyRecord { id: string; [k: string]: unknown }

async function proxyRequest(
  path: string,
  init?: { method: 'GET' | 'PUT'; body?: unknown },
): Promise<ProxyRecord[]> {
  const res = await fetch(`/api/portal-crm-proxy?path=${encodeURIComponent(path)}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return [];
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { message?: string }).message || `CRM request failed (${res.status})`;
    throw new Error(msg);
  }
  return ((json as { data?: ProxyRecord[] }).data) ?? [];
}

/**
 * Finds the Portfolios record for a founder by their email.
 *
 * The founder writes financials onto the SAME record the investor's Company
 * page reads, which is what makes their update show up there — there is no
 * second copy to reconcile.
 */
export async function findPortfolioIdForFounder(founderEmail: string): Promise<string | null> {
  const email = founderEmail.trim();
  if (!email) return null;
  try {
    const records = await proxyRequest(
      `/crm/v2/Portfolios/search?criteria=(Founder_Email:equals:${email})`,
    );
    return records[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Reads the series for a founder, via the proxy. */
export async function fetchFinancialsAsFounder(portfolioId: string): Promise<FinancialEntry[]> {
  try {
    const records = await proxyRequest(`/crm/v2/Portfolios/${portfolioId}?fields=${FIELD}`);
    const raw = records[0]?.[FIELD];
    return parseFinancials(String(raw ?? ''));
  } catch {
    return [];
  }
}

/**
 * Saves a founder's self-reported quarter onto the Portfolios record.
 * Forces source='founder' regardless of what the caller passes, so a founder
 * can never write figures that would read as reviewer-verified.
 */
export async function saveFinancialQuarterAsFounder(
  portfolioId: string,
  entry: FinancialEntry,
): Promise<FinancialEntry[]> {
  const existing = await fetchFinancialsAsFounder(portfolioId);
  const mine: FinancialEntry = { ...entry, source: 'founder' };
  const next = [
    ...existing.filter(e =>
      !(e.year === mine.year && e.quarter === mine.quarter && entrySource(e) === 'founder')),
    mine,
  ];
  const json = stringifyFinancials(next);
  await proxyRequest(`/crm/v2/Portfolios/${portfolioId}`, {
    method: 'PUT',
    body: { data: [{ id: portfolioId, [FIELD]: json }] },
  });
  return sortEntries(next);
}

/** Reads the stored series straight off the Portfolios record. */
export async function fetchFinancials(portfolioId: string): Promise<FinancialEntry[]> {
  const record = isPortalUser()
    ? await portalGetById(MODULE, portfolioId, FIELD).catch(() => portalGetById(MODULE, portfolioId))
    : await zohoGetById(MODULE, portfolioId, FIELD);
  if (!record) return [];
  return parseFinancials(String(record[FIELD] ?? ''));
}

/**
 * Saves one quarter, replacing any existing entry for that year/quarter.
 * Reads the current series first so two reviewers editing different quarters
 * do not overwrite each other's work.
 */
export async function saveFinancialQuarter(
  portfolioId: string,
  entry: FinancialEntry,
): Promise<FinancialEntry[]> {
  const existing = await fetchFinancials(portfolioId);
  const src = entrySource(entry);
  // Replaces only this source's figures for the quarter, so a reviewer's
  // verification never erases what the founder reported, or vice versa.
  const next = [
    ...existing.filter(e =>
      !(e.year === entry.year && e.quarter === entry.quarter && entrySource(e) === src)),
    { ...entry, source: src },
  ];
  const json = stringifyFinancials(next);
  const payload = { [FIELD]: json };
  if (isPortalUser()) await portalUpdate(MODULE, portfolioId, payload);
  else await zohoUpdate(MODULE, portfolioId, payload);
  return sortEntries(next);
}

/** Removes one quarter from the series. */
export async function deleteFinancialQuarter(
  portfolioId: string,
  year: number,
  quarter: Quarter,
  source: EntrySource = 'reviewer',
): Promise<FinancialEntry[]> {
  const existing = await fetchFinancials(portfolioId);
  const next = existing.filter(e =>
    !(e.year === year && e.quarter === quarter && entrySource(e) === source));
  const payload = { [FIELD]: stringifyFinancials(next) };
  if (isPortalUser()) await portalUpdate(MODULE, portfolioId, payload);
  else await zohoUpdate(MODULE, portfolioId, payload);
  return next;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

const HALF_QUARTERS: Record<'H1' | 'H2', Quarter[]> = { H1: [1, 2], H2: [3, 4] };

/**
 * Combines a set of quarters into one row.
 * Flow items sum; balance items take the LAST quarter's value (the period-end
 * snapshot); opening cash takes the FIRST quarter's value (the period-start).
 * Derived figures are then computed from the combined inputs, so margins are
 * period margins rather than an average of quarterly margins.
 */
function combine(entries: FinancialEntry[], key: PeriodKey): FinancialRow | null {
  if (!entries.length) return null;
  const ordered = [...entries].sort((a, b) => a.quarter - b.quarter);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  const inputs: FinancialInputs = {};
  for (const k of FLOW_KEYS) {
    const vals = ordered.map(e => e[k]).filter((v): v is number => v !== undefined);
    if (vals.length) inputs[k] = vals.reduce((a, b) => a + b, 0);
  }
  for (const k of BALANCE_END_KEYS) {
    // Walk backwards to the most recent quarter that actually reported it.
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (ordered[i][k] !== undefined) { inputs[k] = ordered[i][k]; break; }
    }
  }
  inputs.openingCash = first.openingCash;

  const months = ordered.length * 3;
  const derived = computeDerived(inputs, months);

  return {
    ...inputs,
    ...derived,
    key,
    label: periodLabel(key),
    quarterCount: ordered.length,
    reviewer: last.reviewer,
    updatedAt: last.updatedAt,
    provenance: ordered.every(e => entrySource(e) === 'reviewer') ? 'reviewer' : 'founder',
    mixedProvenance: new Set(ordered.map(entrySource)).size > 1,
    notes: ordered.map(e => e.notes).filter(Boolean).join('\n\n') || undefined,
    sourceDocumentIds: Array.from(new Set(ordered.flatMap(e => e.sourceDocumentIds ?? []))),
  };
}

/**
 * Which set of figures to display.
 *   'verified'  — reviewer-verified only
 *   'reported'  — founder self-reported only
 *   'best'      — verified where it exists, otherwise self-reported (default)
 */
export type SourcePreference = 'verified' | 'reported' | 'best';

/**
 * Reduces the stored entries to at most one per quarter, honouring the
 * preference. 'best' is what investors see: a quarter the reviewer has checked
 * shows the checked figures, and a quarter they have not yet reached still
 * shows something — clearly labelled as the company's own number.
 */
export function selectBySource(
  entries: FinancialEntry[],
  preference: SourcePreference = 'best',
): FinancialEntry[] {
  const byQuarter = new Map<string, FinancialEntry[]>();
  for (const e of entries) {
    const k = `${e.year}-${e.quarter}`;
    byQuarter.set(k, [...(byQuarter.get(k) ?? []), e]);
  }
  const out: FinancialEntry[] = [];
  for (const group of byQuarter.values()) {
    const verified = group.find(e => entrySource(e) === 'reviewer');
    const reported = group.find(e => entrySource(e) === 'founder');
    const pick = preference === 'verified' ? verified
      : preference === 'reported' ? reported
      : verified ?? reported;
    if (pick) out.push(pick);
  }
  return sortEntries(out);
}

/** True when the reviewer has verified this quarter. */
export function isQuarterVerified(entries: FinancialEntry[], year: number, quarter: Quarter): boolean {
  return entries.some(e => e.year === year && e.quarter === quarter && entrySource(e) === 'reviewer');
}

/**
 * Metrics where the founder's self-reported figure and the reviewer's verified
 * figure disagree, per quarter. This is the reviewer's and the investor's most
 * useful signal, so it is computed rather than left for someone to spot.
 */
export interface Discrepancy {
  year: number;
  quarter: Quarter;
  metric: keyof FinancialInputs;
  reported: number;
  verified: number;
  diff: number;
  diffPct?: number;
}

export function findDiscrepancies(entries: FinancialEntry[]): Discrepancy[] {
  const out: Discrepancy[] = [];
  const quarters = new Set(entries.map(e => `${e.year}-${e.quarter}`));
  for (const key of quarters) {
    const [y, q] = key.split('-').map(Number);
    const reported = entries.find(e => e.year === y && e.quarter === q && entrySource(e) === 'founder');
    const verified = entries.find(e => e.year === y && e.quarter === q && entrySource(e) === 'reviewer');
    if (!reported || !verified) continue;
    for (const k of INPUT_KEYS) {
      const a = reported[k];
      const b = verified[k];
      if (a === undefined || b === undefined || a === b) continue;
      out.push({
        year: y, quarter: q as Quarter, metric: k,
        reported: a, verified: b,
        diff: b - a,
        diffPct: a === 0 ? undefined : ((b - a) / Math.abs(a)) * 100,
      });
    }
  }
  return out.sort((a, b) => a.year - b.year || a.quarter - b.quarter);
}

/** Builds the rows for a view mode, oldest first. */
export function buildRows(
  entries: FinancialEntry[],
  mode: ViewMode,
  preference: SourcePreference = 'best',
): FinancialRow[] {
  const selected = selectBySource(entries, preference);
  const years = Array.from(new Set(selected.map(e => e.year))).sort((a, b) => a - b);
  const rows: FinancialRow[] = [];

  for (const year of years) {
    const ofYear = selected.filter(e => e.year === year);
    if (mode === 'quarterly') {
      for (const q of [1, 2, 3, 4] as Quarter[]) {
        const match = ofYear.filter(e => e.quarter === q);
        const row = combine(match, { year, span: q });
        if (row) rows.push(row);
      }
    } else if (mode === 'half') {
      for (const h of ['H1', 'H2'] as const) {
        const match = ofYear.filter(e => HALF_QUARTERS[h].includes(e.quarter));
        const row = combine(match, { year, span: h });
        if (row) rows.push(row);
      }
    } else {
      const row = combine(ofYear, { year, span: 'FY' });
      if (row) rows.push(row);
    }
  }
  return rows;
}

// ─── Comparisons ─────────────────────────────────────────────────────────────

export interface Comparison {
  /** Absolute change from the previous comparable period. */
  change?: number;
  /** Percentage change; undefined when the base is zero or absent. */
  changePct?: number;
  direction: 'up' | 'down' | 'flat' | 'na';
}

export function compareValues(current?: number, previous?: number): Comparison {
  if (current === undefined || previous === undefined) return { direction: 'na' };
  const change = current - previous;
  const changePct = previous === 0 ? undefined : (change / Math.abs(previous)) * 100;
  return {
    change,
    changePct,
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  };
}

/**
 * Period-over-period comparison for one metric across the built rows —
 * quarter-to-quarter, half-to-half or year-to-year depending on the mode the
 * rows were built with.
 */
export function comparePeriods(
  rows: FinancialRow[],
  metric: keyof (FinancialInputs & DerivedFinancials),
): Comparison[] {
  return rows.map((row, i) =>
    i === 0
      ? { direction: 'na' as const }
      : compareValues(row[metric] as number | undefined, rows[i - 1][metric] as number | undefined),
  );
}

// ─── Metric presentation ─────────────────────────────────────────────────────

export type MetricFormat = 'currency' | 'percent' | 'months';

export interface MetricDef {
  key: keyof (FinancialInputs & DerivedFinancials);
  label: string;
  format: MetricFormat;
  /** Derived values are computed here, not entered by the reviewer. */
  derived?: boolean;
  /** Grouping for the table's section headers. */
  group: 'income' | 'profitability' | 'cash' | 'balance';
  /** A negative value is bad for most metrics, fine for burn. */
  invertColour?: boolean;
}

export const METRICS: MetricDef[] = [
  { key: 'revenue',            label: 'Revenue',                 format: 'currency', group: 'income' },
  { key: 'cogs',               label: 'COGS',                    format: 'currency', group: 'income' },
  { key: 'grossProfit',        label: 'Gross Profit',            format: 'currency', group: 'income', derived: true },
  { key: 'grossMargin',        label: 'Gross Margin',            format: 'percent',  group: 'income', derived: true },
  { key: 'salaryExpenses',     label: 'Salary / Employee Exp.',  format: 'currency', group: 'income' },
  { key: 'operatingExpenses',  label: 'Operating Expenses',      format: 'currency', group: 'income' },
  { key: 'totalExpenses',      label: 'Total Expenses',          format: 'currency', group: 'income', derived: true },

  { key: 'ebitda',             label: 'EBITDA',                  format: 'currency', group: 'profitability', derived: true },
  { key: 'ebitdaMargin',       label: 'EBITDA Margin',           format: 'percent',  group: 'profitability', derived: true },
  { key: 'depreciation',       label: 'Depreciation & Amort.',   format: 'currency', group: 'profitability' },
  { key: 'interest',           label: 'Interest',                format: 'currency', group: 'profitability' },
  { key: 'pbt',                label: 'Profit Before Tax',       format: 'currency', group: 'profitability', derived: true },
  { key: 'tax',                label: 'Tax',                     format: 'currency', group: 'profitability' },
  { key: 'netProfit',          label: 'Net Profit / (Loss)',     format: 'currency', group: 'profitability', derived: true },
  { key: 'netMargin',          label: 'Net Margin',              format: 'percent',  group: 'profitability', derived: true },

  { key: 'cashInflow',         label: 'Cash Inflow',             format: 'currency', group: 'cash' },
  { key: 'cashOutflow',        label: 'Cash Outflow',            format: 'currency', group: 'cash' },
  { key: 'openingCash',        label: 'Opening Cash',            format: 'currency', group: 'cash' },
  { key: 'closingCash',        label: 'Closing Cash',            format: 'currency', group: 'cash', derived: true },
  { key: 'burnRate',           label: 'Burn Rate (monthly)',     format: 'currency', group: 'cash', derived: true, invertColour: true },
  { key: 'runwayMonths',       label: 'Cash Runway',             format: 'months',   group: 'cash', derived: true },

  { key: 'accountsReceivable', label: 'Accounts Receivable',     format: 'currency', group: 'balance' },
  { key: 'accountsPayable',    label: 'Accounts Payable',        format: 'currency', group: 'balance' },
  { key: 'totalAssets',        label: 'Total Assets',            format: 'currency', group: 'balance' },
  { key: 'totalLiabilities',   label: 'Total Liabilities',       format: 'currency', group: 'balance' },
  { key: 'equity',             label: 'Equity',                  format: 'currency', group: 'balance', derived: true },
];

export const METRIC_GROUPS: { key: MetricDef['group']; label: string }[] = [
  { key: 'income',        label: 'Income & Expenses' },
  { key: 'profitability', label: 'Profitability' },
  { key: 'cash',          label: 'Cash Flow' },
  { key: 'balance',       label: 'Balance Sheet' },
];

/** Compact currency for tables and axis ticks. */
export function formatCurrency(v?: number): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatMetric(v: number | undefined, format: MetricFormat): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  if (format === 'percent') return `${v.toFixed(1)}%`;
  if (format === 'months') return `${v.toFixed(1)} mo`;
  return formatCurrency(v);
}

/** True when the reviewer has entered at least one figure for a quarter. */
export function hasAnyInput(entry: FinancialInputs): boolean {
  return INPUT_KEYS.some(k => entry[k] !== undefined);
}

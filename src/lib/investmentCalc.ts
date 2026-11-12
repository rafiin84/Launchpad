/**
 * Investments — pure calculations and cash-flow helpers (no I/O).
 *
 * The rules this encodes, from the business requirements:
 *  - proposed, committed and funded amounts are separate numbers, never merged;
 *  - every cash movement carries a date, and the record carries one currency;
 *  - realized / refunded / funded totals are always recomputed from the dated
 *    cash flows, never trusted from a stored total;
 *  - return metrics (MOIC, IRR) appear ONLY when the source data exists — a
 *    missing input yields "unavailable", never a zero or a guess;
 *  - ownership comes from approved share and capitalization data; it is never
 *    inferred from the amount invested.
 */

export const FLOW_TYPES = ['Funding', 'Proceeds', 'Refund'] as const;
export type FlowType = (typeof FLOW_TYPES)[number];

export interface CashFlow {
  id: string;
  type: string;
  /** YYYY-MM-DD — required for every cash movement. */
  date: string;
  amount: number;
  note: string;
  createdAt: string;
}

/** The Cash_Flows field holds 32,000 characters; refuse to add past 30,000 rather than truncate. */
export const MAX_CASH_FLOW_CHARS = 30_000;

export class CashFlowsFullError extends Error {
  constructor() { super('CASH_FLOWS_FULL'); this.name = 'CashFlowsFullError'; }
}

const asString = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Tolerant: malformed entries (no valid date or amount) are dropped, never thrown. */
export function parseCashFlows(json: string): CashFlow[] {
  if (!json || !json.trim()) return [];
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: CashFlow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const amount = Number(e.amount);
    const date = asString(e.date);
    if (!Number.isFinite(amount) || !/^\d{4}-\d{2}-\d{2}/.test(date)) continue;
    out.push({
      id: asString(e.id) || `cf_${out.length}`,
      type: asString(e.type),
      date: date.slice(0, 10),
      amount,
      note: asString(e.note),
      createdAt: asString(e.createdAt),
    });
  }
  return sortCashFlows(out);
}

/** Oldest first — the order a ledger and an IRR calculation both want. */
export function sortCashFlows(flows: CashFlow[]): CashFlow[] {
  return [...flows].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export function stringifyCashFlows(flows: CashFlow[]): string {
  const json = JSON.stringify(flows);
  if (json.length > MAX_CASH_FLOW_CHARS) throw new CashFlowsFullError();
  return json;
}

export interface NewCashFlow { type: string; date: string; amount: number; note?: string }

export function appendCashFlow(existingJson: string, input: NewCashFlow, now: Date = new Date()): CashFlow[] {
  const flow: CashFlow = {
    id: `cf_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    date: input.date,
    amount: input.amount,
    note: (input.note ?? '').trim(),
    createdAt: now.toISOString(),
  };
  const next = sortCashFlows([...parseCashFlows(existingJson), flow]);
  stringifyCashFlows(next); // throws CashFlowsFullError if it will not fit
  return next;
}

export interface FlowTotals { funded: number; realized: number; refunded: number }

export function flowTotals(flows: CashFlow[]): FlowTotals {
  const t: FlowTotals = { funded: 0, realized: 0, refunded: 0 };
  for (const f of flows) {
    if (f.type === 'Funding') t.funded += f.amount;
    else if (f.type === 'Proceeds') t.realized += f.amount;
    else if (f.type === 'Refund') t.refunded += f.amount;
  }
  return t;
}

/** The latest Funding date, or '' — kept on the record as Last_Funding_Date. */
export function lastFundingDate(flows: CashFlow[]): string {
  return flows.filter(f => f.type === 'Funding').reduce((m, f) => (f.date > m ? f.date : m), '');
}

// ─── Returns ────────────────────────────────────────────────────────────────

export interface ReturnInputs {
  flows: CashFlow[];
  holdingValue: number | null;
  holdingValueAsOf: string;
}

export type MissingReturnData = 'cashFlows' | 'valuation';

export interface ReturnMetrics {
  /** Realized proceeds to date, or null when no proceeds are recorded. */
  realized: number | null;
  /** Unrealized value: the recorded holding value, or null. */
  unrealized: number | null;
  moic: number | null;
  /** Annualised, as a percentage. */
  irrPct: number | null;
  /** What is missing when MOIC/IRR cannot be shown. Empty when both are available. */
  missing: MissingReturnData[];
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / DAY_MS);

/**
 * Annualised IRR (XIRR) by bisection. Returns null unless there is at least one
 * outflow and one inflow on different dates and a rate in (-99.99%, 1000%]
 * solves it — an answer outside that range is noise, not a return.
 */
export function xirr(flows: Array<{ date: string; amount: number }>): number | null {
  const dated = flows.filter(f => f.amount !== 0).sort((a, b) => a.date.localeCompare(b.date));
  if (!dated.some(f => f.amount < 0) || !dated.some(f => f.amount > 0)) return null;
  const d0 = dayNumber(dated[0].date);
  if (dayNumber(dated[dated.length - 1].date) === d0) return null;
  const npv = (rate: number) =>
    dated.reduce((s, f) => s + f.amount / Math.pow(1 + rate, (dayNumber(f.date) - d0) / 365), 0);
  let lo = -0.9999, hi = 10;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid * 100;
    if (fLo * fMid < 0) hi = mid; else { lo = mid; fLo = fMid; }
  }
  return ((lo + hi) / 2) * 100;
}

/**
 * MOIC = (realized proceeds + unrealized holding value) / net paid-in capital,
 * where paid-in is funding less refunds. Both metrics need dated funding flows
 * AND a dated valuation; with either missing they are reported unavailable.
 * IRR additionally treats the holding value as a final inflow on its as-of date.
 */
export function returnMetrics({ flows, holdingValue, holdingValueAsOf }: ReturnInputs): ReturnMetrics {
  const totals = flowTotals(flows);
  const hasFunding = flows.some(f => f.type === 'Funding' && f.amount > 0);
  const hasValuation = holdingValue !== null && /^\d{4}-\d{2}-\d{2}/.test(holdingValueAsOf);

  const missing: MissingReturnData[] = [];
  if (!hasFunding) missing.push('cashFlows');
  if (!hasValuation) missing.push('valuation');

  const realized = flows.some(f => f.type === 'Proceeds') ? totals.realized : null;
  const base: ReturnMetrics = { realized, unrealized: holdingValue, moic: null, irrPct: null, missing };
  if (missing.length > 0) return base;

  const paidIn = totals.funded - totals.refunded;
  if (paidIn <= 0) return { ...base, missing: ['cashFlows'] };

  const moic = (totals.realized + (holdingValue as number)) / paidIn;
  const series = [
    ...flows.map(f => ({
      date: f.date,
      amount: f.type === 'Funding' ? -f.amount : f.amount, // Proceeds and Refunds flow back to the investor
    })),
    { date: holdingValueAsOf.slice(0, 10), amount: holdingValue as number },
  ];
  return { ...base, moic, irrPct: xirr(series) };
}

// ─── Ownership ──────────────────────────────────────────────────────────────

export interface OwnershipInputs {
  sharesAcquired: number | null;
  fullyDilutedShares: number | null;
  capTableApproved: boolean;
  /** Ownership % as recorded by finance from the approved cap table. */
  recordedPct: number | null;
}

export type OwnershipBasis = 'cap_table' | 'recorded' | 'unavailable';

/**
 * Ownership is only ever shown from approved capitalization data. Shares ÷
 * fully-diluted shares wins when both are present; otherwise a percentage that
 * finance recorded counts only while the cap table is marked approved. The
 * amount invested is never used.
 */
export function ownership(i: OwnershipInputs): { pct: number | null; basis: OwnershipBasis } {
  if (!i.capTableApproved) return { pct: null, basis: 'unavailable' };
  const { sharesAcquired: s, fullyDilutedShares: fd } = i;
  if (s !== null && fd !== null && fd > 0 && s >= 0 && s <= fd) return { pct: (s / fd) * 100, basis: 'cap_table' };
  if (i.recordedPct !== null) return { pct: i.recordedPct, basis: 'recorded' };
  return { pct: null, basis: 'unavailable' };
}

// ─── Money formatting & aggregation ─────────────────────────────────────────

/** 'USD' etc. — anything Intl accepts as a currency. The picklist's "Other" is not one. */
export function isIsoCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** 12500 + 'USD' -> '$12.5K'. Blank/other currency shows the bare number; null -> '—'. */
export function formatAmount(n: number | null, currency: string, locale = 'en-US'): string {
  if (n === null) return '—';
  if (isIsoCurrency(currency)) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2,
      }).format(n);
    } catch { /* fall through to the bare number */ }
  }
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }).format(n)
    + (currency && currency !== 'Other' ? ` ${currency}` : '');
}

/** Full precision for ledgers and exports: 12500 + 'USD' -> '$12,500.00'. */
export function formatAmountFull(n: number | null, currency: string, locale = 'en-US'): string {
  if (n === null) return '—';
  if (isIsoCurrency(currency)) {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n); } catch { /* below */ }
  }
  return n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

/**
 * Sums `pick` per currency. Amounts in different currencies are never added
 * together; null (not recorded) is skipped, and a currency with nothing
 * recorded is omitted.
 */
export function sumByCurrency<T extends { currency: string }>(
  items: T[],
  pick: (item: T) => number | null,
): Array<{ currency: string; amount: number }> {
  const m = new Map<string, number>();
  for (const it of items) {
    const v = pick(it);
    if (v === null) continue;
    const key = it.currency || '';
    m.set(key, (m.get(key) ?? 0) + v);
  }
  return [...m.entries()].map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export const ROUND_ORDER = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D', 'Growth', 'Bridge', 'Other'] as const;
export const roundRank = (round: string): number => {
  const i = (ROUND_ORDER as readonly string[]).indexOf(round);
  return i === -1 ? ROUND_ORDER.length : i;
};

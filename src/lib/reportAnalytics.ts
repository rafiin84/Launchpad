/**
 * Reports & Analytics — the report engine. Pure functions, no I/O: given the
 * investments and portfolio entries the signed-in user was allowed to read, plus
 * the filters, it produces every figure on the page, and says what it left out
 * and why. Nothing here fetches, so a report can only ever contain records the
 * user's own token returned (record- and field-level permissions are applied by
 * CRM before the data gets here, and exports are built from this same result).
 *
 * METHODOLOGY (version METHODOLOGY_VERSION; the same text is shown on the page):
 *  - As-of date: cumulative figures are computed as of the period end (default
 *    today). A cash movement counts only if dated on or before it.
 *  - Total funded = Σ Funding movements.  Deployed capital = Σ Funding − Σ Refunds.
 *  - Committed capital = Σ committed amounts on records whose status is
 *    Committed, Partially Funded, Funded or Closed, with a commitment date on or
 *    before the as-of date. Proposed / Approved are not commitments; Cancelled
 *    records are left out of every capital figure.
 *  - Portfolio value = Σ holding values dated on or before the as-of date.
 *  - MOIC = (Σ realized proceeds + Σ holding value) ÷ Σ deployed capital, over
 *    the investments that have both dated funding and a dated holding value.
 *  - IRR = annualised XIRR over those investments' dated cash movements, with the
 *    holding value as a final inflow on its as-of date.
 *  - Currency: one reporting currency per report. Another currency is included
 *    only under the "report-date rate" policy with a rate the user entered;
 *    otherwise it is excluded and counted. A rate is never guessed.
 *  - A missing input never becomes zero: the metric (or the record) is excluded
 *    and the exclusion is listed.
 */
import type { InvestmentRecord } from '../services/crmInvestments';
import type { PortfolioEntry } from '../services/crmPortfolioManagement';
import { amountsOf, flowTotals, returnMetrics, returnSeries, roundRank, xirr, type CashFlow } from './investmentCalc';
import { allocate, type Slice } from './portfolioFormat';

export const METHODOLOGY_VERSION = '1.0';

export const REPORT_TABS = ['summary', 'performance', 'activity', 'companies'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];
/** The Report_Type picklist values in CRM, per tab. */
export const TAB_TO_REPORT_TYPE: Record<ReportTab, string> = {
  summary: 'Portfolio Summary', performance: 'Performance', activity: 'Investment Activity', companies: 'Company Performance',
};

export type ConversionPolicy = 'none' | 'report_date';
export const POLICY_TO_CRM: Record<ConversionPolicy, string> = {
  none: 'No conversion (per currency)', report_date: 'Convert at report-date rate',
};

export interface ReportFilters {
  periodStart: string;
  periodEnd: string;
  fund: string;
  companyId: string;
  sector: string;
  stage: string;
  /** '' = automatic: the currency most of the in-scope investments use. */
  currency: string;
  policy: ConversionPolicy;
  /** The single date the entered rates apply to. */
  rateDate: string;
  /** 1 unit of the key currency = `rate` units of the reporting currency. */
  rates: Record<string, number>;
}

export function emptyFilters(): ReportFilters {
  return { periodStart: '', periodEnd: '', fund: '', companyId: '', sector: '', stage: '', currency: '', policy: 'none', rateDate: '', rates: {} };
}

/** Filters that are set to something other than "all" — the count shown on the Filters button. */
export function activeFilterCount(f: ReportFilters): number {
  return [f.periodStart, f.periodEnd, f.fund, f.companyId, f.sector, f.stage, f.currency].filter(Boolean).length
    + (f.policy !== 'none' ? 1 : 0);
}

export type ExclusionKind =
  | 'cancelled' | 'otherCurrency' | 'missingRate' | 'noDate' | 'noCurrency' | 'noLedger'
  | 'noCommitmentDate' | 'valuationAfter' | 'noValuation' | 'noReturnData' | 'noPerformance'
  | 'noValuationHistory' | 'pmUnavailable';

export interface Exclusion {
  kind: ExclusionKind;
  count: number;
  /** For missingRate: the currencies with no rate. */
  detail?: string;
  /** Informational exclusions (a cancelled deal) are not "incomplete source data". */
  incomplete: boolean;
}

export interface Bucket { label: string; count: number; funded: number; committed: number }

export interface InvestmentReturnRow {
  id: string;
  company: string;
  round: string;
  currency: string;
  funded: number | null;
  realized: number | null;
  unrealized: number | null;
  moic: number | null;
  irrPct: number | null;
}

export interface ValuationSeries {
  companyId: string;
  company: string;
  points: Array<{ date: string; value: number; round: string }>;
  /** Latest ÷ first − 1, as a percentage; null with a single point. */
  changePct: number | null;
}

export interface CompanyRow {
  key: string;
  companyId: string;
  name: string;
  sector: string;
  stage: string;
  revenue: number | null;
  growthPct: number | null;
  burn: number | null;
  runwayMonths: number | null;
  metricsAsOf: string;
  reportingPeriod: string;
  milestones: number;
  latestMilestone: { title: string; date: string } | null;
}

export interface Report {
  /** When the source data was read (ISO). Shown on every report and export. */
  asOf: string;
  /** The effective as-of date for cumulative figures (YYYY-MM-DD). */
  periodEnd: string;
  periodStart: string;
  currency: string;
  conversion: { policy: ConversionPolicy; rateDate: string; used: Array<{ currency: string; rate: number }> };
  /** Distinct currencies found in the filtered investments, for the rate inputs. */
  currenciesInScope: string[];
  summary: {
    companies: number;
    investments: number;
    totalFunded: number;
    deployed: number;
    committed: number;
    refunded: number;
    portfolioValue: number;
    realized: number;
    distribution: Slice[];
  };
  returns: {
    moic: number | null;
    irrPct: number | null;
    eligible: number;
    total: number;
    rows: InvestmentReturnRow[];
  };
  valuation: ValuationSeries[];
  activity: { byYear: Bucket[]; byStage: Bucket[]; bySector: Bucket[]; byGeography: Bucket[]; byInstrument: Bucket[] };
  companies: CompanyRow[];
  exclusions: Exclusion[];
  /** True when any exclusion reflects incomplete source data. */
  hasIncomplete: boolean;
  isEmpty: boolean;
}

export interface BuildContext {
  /** When the data was fetched (ISO). */
  fetchedAt: string;
  /** Today (YYYY-MM-DD) — the default as-of date. */
  today: string;
  /** Portfolio Management could not be read for this user. */
  portfolioUnavailable?: boolean;
}

const COMMITTED = new Set(['Committed', 'Partially Funded', 'Funded', 'Closed']);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The date an investment is placed in time by: investment, else commitment, else proposal, else its first movement. */
export function activityDate(i: InvestmentRecord): string {
  return i.investmentDate || i.commitmentDate || i.proposedDate || i.cashFlows[0]?.date || '';
}

function bucketize(
  rows: Array<{ key: string; funded: number; committed: number }>, unspecified: string,
  order: 'amount' | 'numeric',
): Bucket[] {
  const m = new Map<string, Bucket>();
  for (const r of rows) {
    const label = r.key.trim() || unspecified;
    const b = m.get(label) ?? { label, count: 0, funded: 0, committed: 0 };
    b.count += 1; b.funded += r.funded; b.committed += r.committed;
    m.set(label, b);
  }
  const out = [...m.values()];
  if (order === 'numeric') return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return out.sort((a, b) => b.funded - a.funded || b.count - a.count || a.label.localeCompare(b.label));
}

export function buildReport(
  investments: InvestmentRecord[], entries: PortfolioEntry[], f: ReportFilters, ctx: BuildContext,
  labels: { unspecified: string },
): Report {
  const periodEnd = f.periodEnd || ctx.today;
  const isCurrentEnd = periodEnd >= ctx.today;
  const entryByCompany = new Map<string, PortfolioEntry>();
  for (const e of entries) if (e.companyId) entryByCompany.set(e.companyId, e);

  const ex = new Map<ExclusionKind, Exclusion>();
  const note = (kind: ExclusionKind, incomplete: boolean, detail?: string, n = 1) => {
    const cur = ex.get(kind);
    if (cur) { cur.count += n; if (detail) cur.detail = cur.detail ? `${cur.detail}, ${detail}` : detail; }
    else ex.set(kind, { kind, count: n, incomplete, detail });
  };
  if (ctx.portfolioUnavailable) note('pmUnavailable', true, undefined, 1);

  // 1. Filter by what the investment is.
  const candidates: InvestmentRecord[] = [];
  for (const inv of investments) {
    if (inv.status === 'Cancelled') { note('cancelled', false); continue; }
    const entry = entryByCompany.get(inv.companyId);
    if (f.companyId && inv.companyId !== f.companyId) continue;
    if (f.fund && !same(inv.investorEntity, f.fund)) continue;
    if (f.sector && !same(entry?.sector ?? '', f.sector)) continue;
    if (f.stage && inv.round !== f.stage) continue;
    const d = activityDate(inv);
    if (!d) { note('noDate', true); continue; }
    if (d > periodEnd) continue; // not yet part of the portfolio at the as-of date
    candidates.push(inv);
  }

  // 2. One reporting currency.
  const currenciesInScope = [...new Set(candidates.map(i => i.currency).filter(Boolean))].sort();
  let currency = f.currency;
  if (!currency) {
    const tally = new Map<string, number>();
    for (const i of candidates) if (i.currency) tally.set(i.currency, (tally.get(i.currency) ?? 0) + 1);
    currency = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
  }

  // 3. Convert (or exclude), record by record.
  interface Scoped { inv: InvestmentRecord; factor: number; entry: PortfolioEntry | undefined }
  const scoped: Scoped[] = [];
  const usedRates = new Map<string, number>();
  for (const inv of candidates) {
    if (!inv.currency) { note('noCurrency', true); continue; }
    let factor = 1;
    if (inv.currency !== currency) {
      const rate = f.rates[inv.currency];
      if (f.policy === 'report_date' && rate && rate > 0 && f.rateDate) { factor = rate; usedRates.set(inv.currency, rate); }
      else if (f.policy === 'report_date') { note('missingRate', true, inv.currency); continue; }
      else { note('otherCurrency', true); continue; }
    }
    scoped.push({ inv, factor, entry: entryByCompany.get(inv.companyId) });
  }

  // 4. Measures as of the period end.
  let totalFunded = 0, refunded = 0, realized = 0, committed = 0, portfolioValue = 0;
  const returnRows: InvestmentReturnRow[] = [];
  const pooled: Array<{ date: string; amount: number }> = [];
  let pooledRealized = 0, pooledHolding = 0, pooledPaidIn = 0, eligible = 0;
  const perInvestment = new Map<string, { funded: number; committed: number }>();

  for (const { inv, factor } of scoped) {
    const hasLedger = inv.cashFlows.length > 0;
    const flows: CashFlow[] = hasLedger
      ? inv.cashFlows.filter(fl => fl.date <= periodEnd).map(fl => ({ ...fl, amount: fl.amount * factor }))
      : [];
    let funded: number | null = null, rlz: number | null = null, ref: number | null = null;
    if (hasLedger) {
      const t = flowTotals(flows);
      funded = flows.some(x => x.type === 'Funding') ? t.funded : null;
      rlz = flows.some(x => x.type === 'Proceeds') ? t.realized : null;
      ref = flows.some(x => x.type === 'Refund') ? t.refunded : null;
    } else {
      const stored = amountsOf(inv);
      const any = stored.funded !== null || stored.realized !== null || stored.refunded !== null;
      if (any && isCurrentEnd) {
        funded = stored.funded === null ? null : stored.funded * factor;
        rlz = stored.realized === null ? null : stored.realized * factor;
        ref = stored.refunded === null ? null : stored.refunded * factor;
      } else if (any) note('noLedger', true);
    }
    if (funded !== null) totalFunded += funded;
    if (ref !== null) refunded += ref;
    if (rlz !== null) realized += rlz;

    let invCommitted = 0;
    if (COMMITTED.has(inv.status) && inv.committedAmount !== null) {
      if (!inv.commitmentDate) note('noCommitmentDate', true);
      else if (inv.commitmentDate <= periodEnd) invCommitted = inv.committedAmount * factor;
    }
    committed += invCommitted;

    let holding: number | null = null;
    if (inv.holdingValue !== null && inv.holdingValueAsOf) {
      if (inv.holdingValueAsOf.slice(0, 10) <= periodEnd) holding = inv.holdingValue * factor;
      else note('valuationAfter', true);
    } else if (inv.holdingValue === null) {
      note('noValuation', true);
    } else {
      note('noValuation', true); // a value with no as-of date cannot be placed in time
    }
    if (holding !== null) portfolioValue += holding;

    // Returns need dated funding AND a dated valuation, both on/before the as-of date.
    const rm = returnMetrics({ flows, holdingValue: holding, holdingValueAsOf: holding === null ? '' : inv.holdingValueAsOf });
    const ok = rm.moic !== null;
    if (ok) {
      eligible++;
      const t = flowTotals(flows);
      pooledRealized += t.realized; pooledHolding += holding as number; pooledPaidIn += t.funded - t.refunded;
      pooled.push(...returnSeries(flows, holding as number, inv.holdingValueAsOf));
    } else {
      note('noReturnData', true);
    }
    returnRows.push({
      id: inv.id, company: inv.companyName, round: inv.round, currency, funded, realized: rlz, unrealized: holding,
      moic: rm.moic, irrPct: rm.irrPct,
    });
    perInvestment.set(inv.id, { funded: funded ?? 0, committed: invCommitted });
  }

  const deployed = totalFunded - refunded;
  const moic = eligible > 0 && pooledPaidIn > 0 ? (pooledRealized + pooledHolding) / pooledPaidIn : null;
  const irrPct = eligible > 0 ? xirr(pooled) : null;

  // 5. Distribution and activity (activity honours the period start).
  const dist = allocate(
    scoped.map(s => ({ totalInvested: Math.max(0, perInvestment.get(s.inv.id)?.funded ?? 0), sector: s.entry?.sector ?? '' })),
    r => r.sector, labels.unspecified,
  );
  const inWindow = (s: Scoped) => !f.periodStart || activityDate(s.inv) >= f.periodStart;
  const act = scoped.filter(inWindow).map(s => ({
    s, funded: perInvestment.get(s.inv.id)?.funded ?? 0, committed: perInvestment.get(s.inv.id)?.committed ?? 0,
  }));
  const by = (key: (s: Scoped) => string, order: 'amount' | 'numeric' = 'amount') =>
    bucketize(act.map(a => ({ key: key(a.s), funded: a.funded, committed: a.committed })), labels.unspecified, order);
  const byStage = by(s => s.inv.round).sort((a, b) => roundRank(a.label) - roundRank(b.label) || a.label.localeCompare(b.label));
  const activity = {
    byYear: by(s => activityDate(s.inv).slice(0, 4), 'numeric'),
    byStage,
    bySector: by(s => s.entry?.sector ?? ''),
    byGeography: by(s => s.entry?.geography ?? ''),
    byInstrument: by(s => s.inv.instrument),
  };

  // 6. Valuation trend: post-money valuation at each dated round.
  const series = new Map<string, ValuationSeries>();
  const companiesWithoutHistory = new Set<string>();
  for (const { inv, factor } of scoped) {
    const key = inv.companyId || inv.companyName || inv.id;
    const entry = series.get(key) ?? { companyId: inv.companyId, company: inv.companyName, points: [], changePct: null };
    if (inv.postMoney !== null && inv.valuationDate && inv.valuationDate.slice(0, 10) <= periodEnd) {
      entry.points.push({ date: inv.valuationDate.slice(0, 10), value: inv.postMoney * factor, round: inv.round });
    }
    series.set(key, entry);
  }
  const valuation: ValuationSeries[] = [];
  for (const [key, v] of series) {
    if (v.points.length === 0) { companiesWithoutHistory.add(key); continue; }
    v.points.sort((a, b) => a.date.localeCompare(b.date));
    const first = v.points[0].value, last = v.points[v.points.length - 1].value;
    v.changePct = v.points.length > 1 && first > 0 ? (last / first - 1) * 100 : null;
    valuation.push(v);
  }
  valuation.sort((a, b) => a.company.localeCompare(b.company));
  if (companiesWithoutHistory.size > 0) note('noValuationHistory', true, undefined, companiesWithoutHistory.size);

  // 7. Company performance: companies with in-scope investments, plus Portfolio
  // Management entries that match the filters (unless a fund filter is set — an
  // entry has no fund, so it cannot be said to belong to one).
  const companyIds = new Map<string, PortfolioEntry | undefined>();
  const nameOf = new Map<string, string>();
  for (const s of scoped) {
    const k = s.inv.companyId || s.inv.companyName || s.inv.id;
    companyIds.set(k, s.entry); nameOf.set(k, s.inv.companyName);
  }
  if (!f.fund) {
    for (const e of entries) {
      if (f.companyId && e.companyId !== f.companyId) continue;
      if (f.sector && !same(e.sector, f.sector)) continue;
      if (f.stage && e.currentStage !== f.stage && !scoped.some(s => s.inv.companyId === e.companyId)) continue;
      if (e.initialInvestmentDate && e.initialInvestmentDate > periodEnd) continue;
      const k = e.companyId || e.id;
      if (!companyIds.has(k)) { companyIds.set(k, e); nameOf.set(k, e.companyName); }
    }
  }
  const companies: CompanyRow[] = [];
  let noPerformance = 0;
  for (const [key, entry] of companyIds) {
    const milestones = (entry?.timeline ?? []).filter(ev => ev.type === 'Milestone' && (!ev.date || ev.date <= periodEnd));
    const latest = milestones.length ? [...milestones].sort((a, b) => b.date.localeCompare(a.date))[0] : null;
    const row: CompanyRow = {
      key, companyId: entry?.companyId ?? '', name: nameOf.get(key) || entry?.companyName || '—',
      sector: entry?.sector ?? '', stage: entry?.currentStage ?? '',
      revenue: entry?.latestRevenue ?? null, growthPct: entry?.revenueGrowthPct ?? null,
      burn: entry?.monthlyBurn ?? null, runwayMonths: entry?.runwayMonths ?? null,
      metricsAsOf: entry?.metricsAsOf ?? '', reportingPeriod: entry?.reportingPeriod ?? '',
      milestones: milestones.length, latestMilestone: latest ? { title: latest.title, date: latest.date } : null,
    };
    if (row.revenue === null && row.growthPct === null && row.burn === null && row.runwayMonths === null) noPerformance++;
    companies.push(row);
  }
  companies.sort((a, b) => a.name.localeCompare(b.name));
  if (noPerformance > 0) note('noPerformance', true, undefined, noPerformance);

  // 'noValuation' / 'noReturnData' were counted per record above; they are real counts.
  const exclusions = [...ex.values()].sort((a, b) => Number(b.incomplete) - Number(a.incomplete) || a.kind.localeCompare(b.kind));
  return {
    asOf: ctx.fetchedAt, periodEnd, periodStart: f.periodStart, currency,
    conversion: {
      policy: f.policy, rateDate: f.rateDate,
      used: [...usedRates.entries()].map(([c, rate]) => ({ currency: c, rate })).sort((a, b) => a.currency.localeCompare(b.currency)),
    },
    currenciesInScope,
    summary: {
      companies: companies.length, investments: scoped.length, totalFunded, deployed, committed, refunded,
      portfolioValue, realized, distribution: dist,
    },
    returns: { moic, irrPct, eligible, total: scoped.length, rows: returnRows },
    valuation, activity, companies, exclusions,
    hasIncomplete: exclusions.some(e => e.incomplete),
    isEmpty: scoped.length === 0 && companies.length === 0,
  };
}

/** Sparkline geometry for a valuation series: points scaled into a width × height box. */
export function sparklinePoints(values: number[], width: number, height: number, pad = 2): string {
  if (values.length === 0) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

import { toCsv } from '../../lib/portfolioFormat';
import { REPORT_TABS, type Report, type ReportTab } from '../../lib/reportAnalytics';
import { conversionLine, dataAsOfText, periodText, type RepText } from './reportText';

type Cell = string | number | null;

/**
 * The CSV for one report tab. It opens with the same context a screen shows —
 * the report, its data-as-of timestamp, the period, the currency and conversion
 * policy, and anything excluded — so a file passed around on its own is never
 * missing it. Numbers are raw (no symbols) in the report currency.
 */
export function reportCsv(report: Report, tab: ReportTab, t: RepText, locale: string, excluded: string[]): string {
  const tabTitle = { summary: t.tabSummary, performance: t.tabPerformance, activity: t.tabActivity, companies: t.tabCompanies }[tab];
  const context: Cell[][] = [
    [dataAsOfText(t, report, locale)],
    [periodText(t, report)],
    [t.reportingIn.replace('{currency}', report.currency || '—')],
    [conversionLine(t, report)],
    ...(excluded.length > 0 ? [[t.excludedBanner], ...excluded.map(e => [e])] : []),
    [],
  ];
  const n = (v: number | null) => (v === null ? '' : Number(v.toFixed(4)));
  let header: string[];
  let rows: Cell[][];
  const r = report;
  if (tab === 'summary') {
    header = [t.sumCompanies, t.sumInvestments, t.sumTotalFunded, t.sumDeployed, t.sumCommitted];
    rows = [[r.summary.companies, r.summary.investments, n(r.summary.totalFunded), n(r.summary.deployed), n(r.summary.committed)],
      [], [t.sumDistribution, t.colInvestments, t.colFunded, '%'],
      ...r.summary.distribution.map(d => [d.label, d.count, n(d.invested), Math.round(d.share * 1000) / 10])];
  } else if (tab === 'performance') {
    header = [t.perfRealized, t.perfPortfolioValue, t.perfMoic, t.perfIrr];
    rows = [[n(r.summary.realized), n(r.summary.portfolioValue), n(r.returns.moic), n(r.returns.irrPct)],
      [], [t.colCompany, t.colRound, t.colFunded, t.colRealized, t.colUnrealized, t.colMoic, t.colIrr],
      ...r.returns.rows.map(x => [x.company, x.round, n(x.funded), n(x.realized), n(x.unrealized), n(x.moic), n(x.irrPct)]),
      [], [t.perfValuationTrend, '', ''],
      ...r.valuation.flatMap(v => v.points.map(p => [v.company, p.round, p.date, n(p.value)]))];
  } else if (tab === 'activity') {
    header = ['', t.colInvestments, t.colFunded, t.colCommitted];
    const group = (title: string, b: Report['activity']['byYear']): Cell[][] =>
      [[title], ...b.map(x => [x.label, x.count, n(x.funded), n(x.committed)]), []];
    rows = [...group(t.actByYear, r.activity.byYear), ...group(t.actByStage, r.activity.byStage),
      ...group(t.actBySector, r.activity.bySector), ...group(t.actByGeography, r.activity.byGeography),
      ...group(t.actByInstrument, r.activity.byInstrument)];
  } else {
    header = [t.colCompany, t.colSector, t.colStage, t.colRevenue, t.colGrowth, t.colBurn, t.colRunway, t.colMetricsAsOf, t.colMilestones];
    rows = r.companies.map(c => [c.name, c.sector, c.stage, n(c.revenue), n(c.growthPct), n(c.burn), n(c.runwayMonths), c.metricsAsOf, c.milestones]);
  }
  // toCsv puts one header row first: use the report title as that row, then the context and table.
  const body: Cell[][] = [...context, header, ...rows];
  return toCsv([tabTitle], body);
}

export const isReportTab = (v: string): v is ReportTab => (REPORT_TABS as readonly string[]).includes(v);

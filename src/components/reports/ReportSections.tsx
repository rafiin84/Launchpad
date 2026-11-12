import {
  Activity, BarChart3, Building2, Coins, Layers, PieChart, Rocket, Target, TrendingUp, Wallet,
} from 'lucide-react';
import { formatDate, formatPercent } from '../../lib/portfolioFormat';
import type { Report } from '../../lib/reportAnalytics';
import { AreaSpark, ColumnChart, DonutChart, HBarChart, type ChartDatum } from './ReportCharts';
import { Card, Kpi, Pill, Table } from './reportUi';
import { moneyFullOf, moneyOf, plainNumber, type RepText } from './reportText';

interface P { report: Report; t: RepText; locale: string }

const hasMetrics = (c: Report['companies'][number]) => [c.revenue, c.growthPct, c.burn, c.runwayMonths].some(v => v !== null);

const toData = (buckets: Report['activity']['byYear']): ChartDatum[] =>
  buckets.map(b => ({ label: b.label, value: b.funded, count: b.count }));

export function SummarySection({ report, t, locale }: P) {
  const money = moneyOf(report, locale);
  const full = moneyFullOf(report, locale);
  const s = report.summary;
  const dist: ChartDatum[] = s.distribution.map(d => ({ label: d.label, value: d.invested, count: d.count }));
  const count = (n: number) => t.actCount.replace('{n}', String(n));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi icon={Building2} tone="indigo" label={t.sumCompanies} value={s.companies} />
        <Kpi icon={Layers} tone="sky" label={t.sumInvestments} value={s.investments} />
        <Kpi icon={Wallet} tone="emerald" label={t.sumTotalFunded} value={money(s.totalFunded)} hint={full(s.totalFunded)} />
        <Kpi icon={Rocket} tone="violet" label={t.sumDeployed} value={money(s.deployed)} hint={full(s.deployed)} />
        <Kpi icon={Target} tone="amber" label={t.sumCommitted} value={money(s.committed)} hint={full(s.committed)} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2" title={t.sumDistribution} note={t.sumDistributionNote}>
          {dist.length === 0 ? <p className="text-sm text-gray-500">—</p>
            : <DonutChart data={dist} format={money} centerLabel={t.sumTotalFunded} centerValue={money(s.totalFunded)} countLabel={count} />}
        </Card>
        <Card className="xl:col-span-3" title={t.actByYear}>
          {report.activity.byYear.length === 0 ? <p className="text-sm text-gray-500">—</p>
            : <ColumnChart data={toData(report.activity.byYear)} format={money} countLabel={count} />}
        </Card>
      </div>
    </div>
  );
}

export function PerformanceSection({ report, t, locale }: P) {
  const money = moneyOf(report, locale);
  const full = moneyFullOf(report, locale);
  const r = report.returns;
  const s = report.summary;
  const recorded = r.rows.some(x => x.realized !== null);
  const valued = r.rows.some(x => x.unrealized !== null);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={Coins} tone="emerald" label={t.perfRealized} value={recorded ? money(s.realized) : t.notAvailable} hint={recorded ? full(s.realized) : undefined} />
        <Kpi icon={PieChart} tone="sky" label={t.perfPortfolioValue} value={valued ? money(s.portfolioValue) : t.notAvailable} hint={valued ? full(s.portfolioValue) : undefined} />
        <Kpi icon={BarChart3} tone="violet" label={t.perfMoic} value={r.moic === null ? t.notAvailable : `${r.moic.toFixed(2)}x`} />
        <Kpi icon={Activity} tone="amber" label={t.perfIrr} value={r.irrPct === null ? t.notAvailable : `${r.irrPct.toFixed(1)}%`} />
      </div>
      {r.moic === null ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-100 rounded-2xl px-4 py-3">{t.perfReturnsUnavailable}</p>
      ) : (
        <p className="text-xs text-gray-500">
          {t.perfBasedOn.replace('{n}', String(r.eligible)).replace('{total}', String(r.total))}
          {r.irrPct === null && ` ${t.perfIrrUnavailable}`}
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-900">{t.perfValuationTrend}</h3>
        <p className="text-[11px] text-gray-400 mb-3">{t.perfValuationNote.replace('{currency}', report.currency)}</p>
        {report.valuation.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white border border-gray-100 rounded-2xl px-4 py-3">{t.perfNoTrend}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...report.valuation].sort((a, b) => b.points.length - a.points.length).map((v, i) => {
              const last = v.points[v.points.length - 1];
              return (
                <div key={v.companyId || v.company} className="bg-white border border-gray-100 rounded-3xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] break-inside-avoid">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{v.company || '—'}</p>
                      <p className="text-lg font-bold text-gray-900 tabular-nums">{money(last.value)}</p>
                    </div>
                    {v.changePct === null
                      ? <Pill tone="gray">{t.perfSinglePoint}</Pill>
                      : <Pill tone={v.changePct >= 0 ? 'emerald' : 'rose'}>{v.changePct >= 0 ? '+' : ''}{v.changePct.toFixed(0)}%</Pill>}
                  </div>
                  {v.points.length > 1 ? (
                    <>
                      <AreaSpark points={v.points.map(p => ({ label: p.date, value: p.value }))} color={i} label={v.company} />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>{v.points[0].round || ''} · {formatDate(v.points[0].date, locale)}</span>
                        <span>{last.round || ''} · {formatDate(last.date, locale)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-[11px] text-gray-400">{[last.round, formatDate(last.date, locale)].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {r.rows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.perfByInvestment}</h3>
          <Table head={[t.colCompany, t.colRound, t.colFunded, t.colRealized, t.colUnrealized, t.colMoic, t.colIrr]}>
            {r.rows.map(x => (
              <tr key={x.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{x.company || '—'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{x.round || '—'}</td>
                <td className="px-4 py-3 tabular-nums">{x.funded === null ? '—' : money(x.funded)}</td>
                <td className="px-4 py-3 tabular-nums">{x.realized === null ? '—' : money(x.realized)}</td>
                <td className="px-4 py-3 tabular-nums">{x.unrealized === null ? '—' : money(x.unrealized)}</td>
                <td className="px-4 py-3">{x.moic === null ? '—' : <Pill tone={x.moic >= 1 ? 'emerald' : 'rose'}>{x.moic.toFixed(2)}x</Pill>}</td>
                <td className="px-4 py-3 tabular-nums">{x.irrPct === null ? '—' : `${x.irrPct.toFixed(1)}%`}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}

export function ActivitySection({ report, t, locale }: P) {
  const money = moneyOf(report, locale);
  const count = (n: number) => t.actCount.replace('{n}', String(n));
  const a = report.activity;
  const total = report.summary.totalFunded;
  const empty = <p className="text-sm text-gray-500">—</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{t.actNote}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="lg:col-span-2" title={t.actByYear}>
          {a.byYear.length === 0 ? empty : <ColumnChart data={toData(a.byYear)} format={money} countLabel={count} />}
        </Card>
        <Card title={t.actByStage}>{a.byStage.length === 0 ? empty : <HBarChart data={toData(a.byStage)} format={money} countLabel={count} />}</Card>
        <Card title={t.actByGeography}>{a.byGeography.length === 0 ? empty : <HBarChart data={toData(a.byGeography)} format={money} countLabel={count} />}</Card>
        <Card title={t.actBySector}>
          {a.bySector.length === 0 ? empty : <DonutChart data={toData(a.bySector)} format={money} centerLabel={t.colFunded} centerValue={money(total)} countLabel={count} />}
        </Card>
        <Card title={t.actByInstrument}>
          {a.byInstrument.length === 0 ? empty : <DonutChart data={toData(a.byInstrument)} format={money} centerLabel={t.colFunded} centerValue={money(total)} countLabel={count} />}
        </Card>
      </div>
    </div>
  );
}

export function CompaniesSection({ report, t, locale }: P) {
  const runwayCap = 24;
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{t.coNote}</p>
      {report.companies.length === 0 ? (
        <p className="text-sm text-gray-500">—</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...report.companies].sort((x, y) => Number(hasMetrics(y)) - Number(hasMetrics(x))).map(c => (
            <div key={c.key} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] break-inside-avoid">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{[c.sector, c.stage].filter(Boolean).join(' · ') || '—'}</p>
                </div>
                {c.growthPct !== null && <Pill tone={c.growthPct >= 0 ? 'emerald' : 'rose'}>{c.growthPct >= 0 ? '+' : ''}{formatPercent(c.growthPct, 0)}</Pill>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-gray-400">{t.colRevenue}</p>
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{c.revenue === null ? <span className="text-sm font-medium text-gray-400">{t.notReported}</span> : plainNumber(c.revenue, locale)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">{t.colBurn}</p>
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{c.burn === null ? <span className="text-sm font-medium text-gray-400">—</span> : plainNumber(c.burn, locale)}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline justify-between text-[11px] text-gray-400 mb-1.5">
                  <span>{t.colRunway}</span>
                  <span className="text-gray-700 font-medium tabular-nums">
                    {c.runwayMonths === null ? '—' : t.months.replace('{n}', c.runwayMonths.toLocaleString(locale, { maximumFractionDigits: 1 }))}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-200" style={{ width: `${c.runwayMonths === null ? 0 : Math.min(100, Math.max(3, (c.runwayMonths / runwayCap) * 100))}%` }} />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-50 text-[11px] text-gray-500 space-y-0.5">
                <p>
                  {t.colMilestones}: {c.milestones === 0 ? t.milestonesNone : t.milestonesRecorded.replace('{n}', String(c.milestones))}
                  {c.latestMilestone && <span className="text-gray-400"> · {t.milestoneLatest.replace('{title}', c.latestMilestone.title)}</span>}
                </p>
                {c.metricsAsOf && <p className="text-gray-400 flex items-center gap-1"><TrendingUp size={11} /> {t.colMetricsAsOf} {formatDate(c.metricsAsOf, locale)}{c.reportingPeriod ? ` · ${c.reportingPeriod}` : ''}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { formatDate, formatPercent } from '../../lib/portfolioFormat';
import type { Bucket, Report } from '../../lib/reportAnalytics';
import { BarList, Card, Sparkline, Table, Tile } from './reportUi';
import { moneyFullOf, moneyOf, plainNumber, type RepText } from './reportText';

interface P { report: Report; t: RepText; locale: string }

export function SummarySection({ report, t, locale }: P) {
  const money = moneyOf(report, locale);
  const full = moneyFullOf(report, locale);
  const s = report.summary;
  const dist = s.distribution.map(d => ({
    label: d.label, value: d.share, display: `${Math.round(d.share * 100)}%`, sub: `${d.count} · ${money(d.invested)}`,
  }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label={t.sumCompanies} value={s.companies} />
        <Tile label={t.sumInvestments} value={s.investments} />
        <Tile label={t.sumTotalFunded} value={money(s.totalFunded)} hint={full(s.totalFunded)} />
        <Tile label={t.sumDeployed} value={money(s.deployed)} hint={full(s.deployed)} />
        <Tile label={t.sumCommitted} value={money(s.committed)} hint={full(s.committed)} />
      </div>
      <Card title={t.sumDistribution} note={t.sumDistributionNote}>
        {dist.length === 0 ? <p className="text-sm text-gray-500">—</p> : <BarList items={dist} />}
      </Card>
    </div>
  );
}

export function PerformanceSection({ report, t, locale }: P) {
  const money = moneyOf(report, locale);
  const full = moneyFullOf(report, locale);
  const r = report.returns;
  const s = report.summary;
  const recorded = r.rows.some(x => x.realized !== null);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label={t.perfRealized} value={recorded ? money(s.realized) : t.notAvailable} hint={recorded ? full(s.realized) : undefined} />
        <Tile label={t.perfPortfolioValue} value={r.rows.some(x => x.unrealized !== null) ? money(s.portfolioValue) : t.notAvailable}
          hint={full(s.portfolioValue)} />
        <Tile label={t.perfMoic} value={r.moic === null ? t.notAvailable : `${r.moic.toFixed(2)}x`} />
        <Tile label={t.perfIrr} value={r.irrPct === null ? t.notAvailable : `${r.irrPct.toFixed(1)}%`} />
      </div>
      {r.moic === null ? (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">{t.perfReturnsUnavailable}</p>
      ) : (
        <p className="text-xs text-gray-500">
          {t.perfBasedOn.replace('{n}', String(r.eligible)).replace('{total}', String(r.total))}
          {r.irrPct === null && ` ${t.perfIrrUnavailable}`}
        </p>
      )}

      <Card title={t.perfValuationTrend} note={t.perfValuationNote.replace('{currency}', report.currency)}>
        {report.valuation.length === 0 ? (
          <p className="text-sm text-gray-500">{t.perfNoTrend}</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {report.valuation.map(v => (
              <li key={v.companyId || v.company} className="flex items-center gap-3 py-2">
                <p className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">{v.company || '—'}</p>
                <Sparkline values={v.points.map(p => p.value)} label={v.company} />
                <div className="text-right w-28 flex-shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-gray-900">{money(v.points[v.points.length - 1].value)}</p>
                  <p className="text-[11px] text-gray-400">
                    {v.changePct === null ? t.perfSinglePoint : `${v.changePct >= 0 ? '+' : ''}${v.changePct.toFixed(0)}%`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {r.rows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">{t.perfByInvestment}</h3>
          <Table head={[t.colCompany, t.colRound, t.colFunded, t.colRealized, t.colUnrealized, t.colMoic, t.colIrr]}>
            {r.rows.map(x => (
              <tr key={x.id} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{x.company || '—'}</td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{x.round || '—'}</td>
                <td className="px-3 py-2.5 tabular-nums">{x.funded === null ? '—' : money(x.funded)}</td>
                <td className="px-3 py-2.5 tabular-nums">{x.realized === null ? '—' : money(x.realized)}</td>
                <td className="px-3 py-2.5 tabular-nums">{x.unrealized === null ? '—' : money(x.unrealized)}</td>
                <td className="px-3 py-2.5 tabular-nums">{x.moic === null ? '—' : `${x.moic.toFixed(2)}x`}</td>
                <td className="px-3 py-2.5 tabular-nums">{x.irrPct === null ? '—' : `${x.irrPct.toFixed(1)}%`}</td>
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
  const groups: Array<[string, Bucket[]]> = [
    [t.actByYear, report.activity.byYear], [t.actByStage, report.activity.byStage],
    [t.actBySector, report.activity.bySector], [t.actByGeography, report.activity.byGeography],
    [t.actByInstrument, report.activity.byInstrument],
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{t.actNote}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {groups.map(([title, buckets]) => (
          <Card key={title} title={title}>
            {buckets.length === 0 ? <p className="text-sm text-gray-500">—</p> : (
              <BarList items={buckets.map(b => ({
                label: b.label, value: b.funded, display: money(b.funded), sub: t.actCount.replace('{n}', String(b.count)),
              }))} />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function CompaniesSection({ report, t, locale }: P) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{t.coNote}</p>
      {report.companies.length === 0 ? (
        <p className="text-sm text-gray-500">—</p>
      ) : (
        <Table head={[t.colCompany, t.colSector, t.colStage, t.colRevenue, t.colGrowth, t.colBurn, t.colRunway, t.colMetricsAsOf, t.colMilestones]}>
          {report.companies.map(c => (
            <tr key={c.key} className="border-b border-gray-50 last:border-0 align-top">
              <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{c.name}</td>
              <td className="px-3 py-2.5 text-gray-600">{c.sector || '—'}</td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{c.stage || '—'}</td>
              <td className="px-3 py-2.5 tabular-nums">{c.revenue === null ? t.notReported : plainNumber(c.revenue, locale)}</td>
              <td className="px-3 py-2.5 tabular-nums">{c.growthPct === null ? '—' : formatPercent(c.growthPct)}</td>
              <td className="px-3 py-2.5 tabular-nums">{c.burn === null ? '—' : plainNumber(c.burn, locale)}</td>
              <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{c.runwayMonths === null ? '—' : t.months.replace('{n}', c.runwayMonths.toLocaleString(locale, { maximumFractionDigits: 1 }))}</td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                {c.metricsAsOf ? formatDate(c.metricsAsOf, locale) : '—'}
                {c.reportingPeriod && <span className="block text-[11px] text-gray-400">{c.reportingPeriod}</span>}
              </td>
              <td className="px-3 py-2.5 text-gray-600">
                {c.milestones === 0 ? t.milestonesNone : t.milestonesRecorded.replace('{n}', String(c.milestones))}
                {c.latestMilestone && <span className="block text-[11px] text-gray-400">{t.milestoneLatest.replace('{title}', c.latestMilestone.title)}</span>}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

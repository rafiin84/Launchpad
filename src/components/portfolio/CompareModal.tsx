import type { PortfolioEntry } from '../../services/crmPortfolioManagement';
import type { HealthResult } from '../../lib/portfolioHealth';
import { formatDate, formatMoney, formatNumber, formatPercent } from '../../lib/portfolioFormat';
import { HealthBadge, ModalFrame } from './portfolioUi';
import type { PMText } from './portfolioText';

export interface CompareRow { entry: PortfolioEntry; health: HealthResult }

export default function CompareModal({
  rows, language, t, onClose,
}: {
  rows: CompareRow[]; language: string; t: PMText; onClose: () => void;
}) {
  const locale = language === 'ja' ? 'ja-JP' : 'en-US';
  const dash = '—';

  const lines: Array<{ label: string; cell: (r: CompareRow) => React.ReactNode }> = [
    { label: t.colSector, cell: r => r.entry.sector || dash },
    { label: t.colStage, cell: r => r.entry.currentStage || dash },
    { label: t.colStatus, cell: r => r.entry.status || dash },
    { label: t.colHealth, cell: r => <HealthBadge status={r.health.status} t={t} /> },
    { label: t.colInitialInvestment, cell: r => formatDate(r.entry.initialInvestmentDate, locale) },
    { label: t.colTotalInvested, cell: r => formatMoney(r.entry.totalInvested) },
    {
      label: t.colLatestValuation,
      cell: r => (
        <>
          {formatMoney(r.entry.latestValuation)}
          {r.entry.valuationAsOf && <span className="block text-[11px] text-gray-400">{t.asOf.replace('{date}', formatDate(r.entry.valuationAsOf, locale))}</span>}
        </>
      ),
    },
    { label: t.colOwnership, cell: r => formatPercent(r.entry.ownershipPct) },
    { label: t.metricRevenue, cell: r => formatMoney(r.entry.latestRevenue) },
    { label: t.metricRevenueGrowth, cell: r => formatPercent(r.entry.revenueGrowthPct) },
    { label: t.metricBurn, cell: r => formatMoney(r.entry.monthlyBurn) },
    { label: t.metricRunway, cell: r => (r.entry.runwayMonths === null ? dash : t.months.replace('{n}', formatNumber(r.entry.runwayMonths, 1))) },
    { label: t.metricHeadcount, cell: r => formatNumber(r.entry.headcount) },
    { label: t.metricOpenRoles, cell: r => formatNumber(r.entry.openRoles) },
    {
      label: t.reportingPeriod,
      cell: r => (
        <>
          {r.entry.reportingPeriod || dash}
          {r.entry.metricsAsOf && <span className="block text-[11px] text-gray-400">{t.metricsAsOf.replace('{date}', formatDate(r.entry.metricsAsOf, locale))}</span>}
        </>
      ),
    },
    { label: t.colLastUpdate, cell: r => (r.entry.lastCompanyUpdate ? formatDate(r.entry.lastCompanyUpdate, locale) : t.notReported) },
  ];

  return (
    <ModalFrame title={t.compareTitle} onClose={onClose} wide>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[32rem]">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-4 text-xs font-medium text-gray-400 w-40">{t.metricLabel}</th>
              {rows.map(r => <th key={r.entry.id} className="py-2 px-3 font-semibold text-gray-900">{r.entry.companyName}</th>)}
            </tr>
          </thead>
          <tbody>
            {lines.map(line => (
              <tr key={line.label} className="border-t border-gray-100 align-top">
                <th scope="row" className="py-2.5 pr-4 text-xs font-medium text-gray-500 text-left">{line.label}</th>
                {rows.map(r => <td key={r.entry.id} className="py-2.5 px-3 text-gray-900 tabular-nums">{line.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalFrame>
  );
}

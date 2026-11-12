import { useMemo } from 'react';
import { allocate, formatMoney } from '../../lib/portfolioFormat';
import type { PortfolioEntry } from '../../services/crmPortfolioManagement';
import type { PMText } from './portfolioText';

const BAR_COLORS = ['bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-400'];
const MAX_SLICES = 6;

function AllocationCard({ title, entries, keyOf, t }: {
  title: string;
  entries: PortfolioEntry[];
  keyOf: (e: PortfolioEntry) => string;
  t: PMText;
}) {
  const slices = useMemo(() => {
    const all = allocate(entries, keyOf, t.unspecified);
    if (all.length <= MAX_SLICES) return all;
    // Fold the long tail into one slice so the card stays readable.
    const head = all.slice(0, MAX_SLICES - 1);
    const tail = all.slice(MAX_SLICES - 1);
    return [...head, {
      label: `+${tail.length}`,
      invested: tail.reduce((s, x) => s + x.invested, 0),
      count: tail.reduce((s, x) => s + x.count, 0),
      share: tail.reduce((s, x) => s + x.share, 0),
    }];
  }, [entries, keyOf, t.unspecified]);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 mb-3" role="img"
        aria-label={slices.map(s => `${s.label} ${Math.round(s.share * 100)}%`).join(', ')}>
        {slices.map((s, i) => (
          <div key={s.label} className={BAR_COLORS[i % BAR_COLORS.length]} style={{ width: `${s.share * 100}%` }} />
        ))}
      </div>
      <ul className="space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${BAR_COLORS[i % BAR_COLORS.length]}`} />
            <span className="text-gray-700 truncate flex-1">{s.label}</span>
            <span className="text-gray-400 tabular-nums">{formatMoney(s.invested)}</span>
            <span className="text-gray-900 font-medium tabular-nums w-10 text-right">{Math.round(s.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AllocationCards({ entries, t }: { entries: PortfolioEntry[]; t: PMText }) {
  const bySector = useMemo(() => (e: PortfolioEntry) => e.sector, []);
  const byStage = useMemo(() => (e: PortfolioEntry) => e.currentStage, []);
  const byGeo = useMemo(() => (e: PortfolioEntry) => e.geography, []);
  // The stored year, else derived from the date, else blank (grouped as Unspecified).
  const byYear = useMemo(() => (e: PortfolioEntry): string => {
    const y = e.investmentYear ?? Number(e.initialInvestmentDate.slice(0, 4));
    return Number.isInteger(y) && y > 1900 ? String(y) : '';
  }, []);
  return (
    <section aria-labelledby="pm-allocation">
      <div className="flex items-baseline justify-between mb-3">
        <h2 id="pm-allocation" className="text-sm font-semibold text-gray-900">{t.allocationTitle}</h2>
        <span className="text-[11px] text-gray-400">{t.allocationNote}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <AllocationCard title={t.bySector} entries={entries} keyOf={bySector} t={t} />
        <AllocationCard title={t.byStage} entries={entries} keyOf={byStage} t={t} />
        <AllocationCard title={t.byGeography} entries={entries} keyOf={byGeo} t={t} />
        <AllocationCard title={t.byYear} entries={entries} keyOf={byYear} t={t} />
      </div>
    </section>
  );
}

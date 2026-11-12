import { cn } from '../../lib/cn';
import { sparklinePoints } from '../../lib/reportAnalytics';

const BAR_COLORS = ['bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-400'];

export function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 min-w-0">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5 truncate" title={hint}>{value}</p>
    </div>
  );
}

export function Card({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('bg-white border border-gray-100 rounded-2xl p-4 break-inside-avoid', className)}>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {note && <p className="text-[11px] text-gray-400 mt-0.5">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Horizontal bars, scaled to the largest value. A zero-only list still renders its rows. */
export function BarList({ items }: { items: Array<{ label: string; value: number; display: string; sub?: string }> }) {
  const max = Math.max(0, ...items.map(i => i.value));
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-gray-700 truncate">{it.label}</span>
            <span className="text-gray-900 font-medium tabular-nums whitespace-nowrap">{it.display}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden">
            <div className={cn('h-full rounded-full', BAR_COLORS[i % BAR_COLORS.length])}
              style={{ width: `${max > 0 ? Math.max(2, (it.value / max) * 100) : 0}%` }} />
          </div>
          {it.sub && <p className="text-[11px] text-gray-400 mt-0.5">{it.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 96, h = 28;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="flex-shrink-0">
      {values.length > 1
        ? <polyline points={sparklinePoints(values, w, h)} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" className="text-indigo-500" />
        : <circle cx={w / 2} cy={h / 2} r="3" className="fill-indigo-500" />}
    </svg>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
      <table className="w-full text-sm min-w-[40rem]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
            {head.map(h => <th key={h} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

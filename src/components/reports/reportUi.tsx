import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { TONES, type Tone } from './reportTheme';

/** A headline number with a soft tinted icon. */
export function Kpi({ icon: Icon, tone, label, value, sub, hint }: {
  icon: LucideIcon; tone: Tone; label: string; value: React.ReactNode; sub?: string; hint?: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-4 sm:p-5 min-w-0 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className={cn('w-9 h-9 rounded-2xl flex items-center justify-center mb-3', TONES[tone])}>
        <Icon size={17} strokeWidth={2} />
      </span>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900 tabular-nums tracking-tight mt-0.5 break-words" title={hint}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1 truncate">{sub}</p>}
    </div>
  );
}

export function Card({ title, note, children, className, action }: {
  title: string; note?: string; children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
  return (
    <section className={cn('bg-white border border-gray-100 rounded-3xl p-5 break-inside-avoid shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {note && <p className="text-[11px] text-gray-400 mt-0.5">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A small rounded tag; tone picks a pastel. */
export function Pill({ tone, children }: { tone: 'emerald' | 'rose' | 'gray' | 'indigo' | 'amber' | 'sky'; children: React.ReactNode }) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-500',
    gray: 'bg-gray-100 text-gray-500', indigo: 'bg-indigo-50 text-indigo-500',
    amber: 'bg-amber-50 text-amber-600', sky: 'bg-sky-50 text-sky-600',
  };
  return <span className={cn('inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', styles[tone])}>{children}</span>;
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-x-auto shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <table className="w-full text-sm min-w-[40rem]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
            {head.map(h => <th key={h} scope="col" className="px-4 py-3.5 font-medium whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

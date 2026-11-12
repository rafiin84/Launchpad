import { cn } from '../../lib/cn';
import { statusLabel, type InvText } from './investmentText';

const STATUS_STYLES: Record<string, string> = {
  Proposed: 'bg-gray-50 text-gray-600 border-gray-200',
  Approved: 'bg-sky-50 text-sky-700 border-sky-100',
  Committed: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Partially Funded': 'bg-amber-50 text-amber-700 border-amber-100',
  Funded: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Cancelled: 'bg-red-50 text-red-700 border-red-100',
  Closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

export function StatusBadge({ status, t }: { status: string; t: InvText }) {
  return (
    <span className={cn(
      'inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap',
      STATUS_STYLES[status] ?? 'bg-gray-50 text-gray-500 border-gray-200',
    )}>
      {statusLabel(t, status)}
    </span>
  );
}

/** A label/value pair used throughout the detail panel. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <div className="text-sm font-medium text-gray-900 break-words">{children}</div>
    </div>
  );
}

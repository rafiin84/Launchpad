import { cn } from '../../lib/cn';
import type { HealthReason, HealthResult, HealthStatus } from '../../lib/portfolioHealth';
import { formatDate } from '../../lib/portfolioFormat';
import { healthLabel, metricLabel, metricValueText, type PMText } from './portfolioText';


const BADGE_STYLES: Record<HealthStatus, string> = {
  on_track: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  needs_attention: 'bg-amber-50 text-amber-700 border-amber-100',
  at_risk: 'bg-red-50 text-red-700 border-red-100',
  data_unavailable: 'bg-gray-50 text-gray-500 border-gray-200',
};
const DOT_STYLES: Record<HealthStatus, string> = {
  on_track: 'bg-emerald-500',
  needs_attention: 'bg-amber-500',
  at_risk: 'bg-red-500',
  data_unavailable: 'bg-gray-300',
};

export function HealthBadge({ status, t }: { status: HealthStatus; t: PMText }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', BADGE_STYLES[status])}>
      <span className={cn('w-1.5 h-1.5 rounded-full', DOT_STYLES[status])} />
      {healthLabel(t, status)}
    </span>
  );
}

function thresholdText(t: PMText, r: HealthReason): string {
  return metricValueText(t, r.metric, r.threshold);
}

/** Why a company has the health it has — every line traces back to a rule and a reported value. */
export function HealthExplanation({
  result, healthAsOf, language, t, className,
}: {
  result: HealthResult; healthAsOf: string; language: string; t: PMText; className?: string;
}) {
  return (
    <div className={cn('text-xs text-gray-600 space-y-1.5', className)}>
      {result.reasons.map((r, i) => (
        <div key={i} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
          <p className="font-medium text-gray-800">
            {t.reasonLine
              .replace('{metric}', metricLabel(t, r.metric))
              .replace('{value}', metricValueText(t, r.metric, r.value))
              .replace('{condition}', r.condition === 'Less Than' ? t.conditionLess : t.conditionGreater)
              .replace('{threshold}', thresholdText(t, r))}
          </p>
          {r.explanation && <p className="text-gray-500 mt-0.5">{r.explanation}</p>}
          <p className="text-gray-400 mt-0.5">{r.ruleName}</p>
        </div>
      ))}
      <p className="text-gray-500">
        {result.basis === 'rules'
          ? t.healthBasisRules.replace('{n}', String(result.evaluated))
          : result.basis === 'recorded'
            ? `${t.healthBasisRecorded}${result.recordedReason ? ` ${result.recordedReason}` : ''}`
            : t.healthBasisNone}
      </p>
      {healthAsOf && result.basis !== 'rules' && (
        <p className="text-gray-400">{t.healthAsOf.replace('{date}', formatDate(healthAsOf, language === 'ja' ? 'ja-JP' : 'en-US'))}</p>
      )}
    </div>
  );
}

/** Modal frame shared by the form and the compare view. */
export function ModalFrame({
  title, onClose, children, wide = false, footer,
}: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/40" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cn('bg-white rounded-2xl shadow-xl w-full max-h-[92vh] flex flex-col', wide ? 'max-w-5xl' : 'max-w-2xl')}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 truncate pr-4">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1">×</button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

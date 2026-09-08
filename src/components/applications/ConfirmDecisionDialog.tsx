import React from 'react';
import { AlertTriangle, ArrowRight, Check, ShieldCheck, X, ChevronLeft, Info } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/cn';

/**
 * Confirmation step for the one-way actions in the review pipeline.
 *
 * Every action this guards is irreversible from the UI: passing an application
 * on removes it from the current reviewer's queue, dropping it ends the review,
 * and approving creates a portfolio record. So rather than a generic "are you
 * sure?", each confirmation spells out exactly what is about to happen —
 * the consequences are what the reviewer actually needs to weigh.
 */

export type ConfirmTone = 'advance' | 'danger' | 'approve';

export default function ConfirmDecisionDialog({
  tone,
  title,
  lines,
  confirmLabel,
  actorName,
  submitting = false,
  onConfirm,
  onBack,
}: {
  tone: ConfirmTone;
  title: string;
  /** The concrete consequences, one per line. */
  lines: string[];
  confirmLabel: string;
  /** Who the decision will be recorded as. */
  actorName?: string;
  submitting?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();

  const style = {
    advance: {
      Icon: ArrowRight,
      iconCls: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      btn: 'bg-gray-900 hover:bg-black',
      bullet: 'text-indigo-400',
    },
    approve: {
      Icon: ShieldCheck,
      iconCls: 'text-green-600',
      iconBg: 'bg-green-50',
      btn: 'bg-green-600 hover:bg-green-700',
      bullet: 'text-green-500',
    },
    danger: {
      Icon: AlertTriangle,
      iconCls: 'text-red-600',
      iconBg: 'bg-red-50',
      btn: 'bg-red-600 hover:bg-red-700',
      bullet: 'text-red-400',
    },
  }[tone];
  const { Icon } = style;

  return (
    // z-[60] so it sits above the decision modal that opened it
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', style.iconBg)}>
              <Icon size={18} className={style.iconCls} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                {t.confirmDecision.heading}
              </p>
              <h3 className="text-base font-bold text-gray-900 mt-0.5 leading-snug">{title}</h3>
            </div>
          </div>

          {/* What will actually happen */}
          <ul className="mt-4 space-y-2">
            {lines.map(line => (
              <li key={line} className="flex items-start gap-2">
                <Check size={13} className={cn('flex-shrink-0 mt-0.5', style.bullet)} />
                <span className="text-xs text-gray-700 leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>

          {actorName && (
            <p className="mt-3.5 text-[11px] text-gray-500 inline-flex items-center gap-1">
              <Info size={10} /> {t.confirmDecision.reviewingAs.replace('{name}', actorName)}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onBack}
            disabled={submitting}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <ChevronLeft size={13} /> {t.confirmDecision.back}
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-50',
              style.btn,
            )}
          >
            {submitting
              ? t.reviewPipeline.recording
              : <>{tone === 'danger' ? <X size={13} /> : <Check size={13} />} {confirmLabel}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

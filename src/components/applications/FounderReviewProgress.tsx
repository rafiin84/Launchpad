import React from 'react';
import { Check, Lock, CircleDot, X, ShieldCheck, Info, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKeys } from '../../i18n';
import {
  getPipelineState,
  type InvestmentApplication,
  type ReviewLevel,
} from '../../services/investmentApplications';
import { cn } from '../../lib/cn';

/**
 * Founder-facing view of the 3-level shortlisting pipeline.
 *
 * Deliberately shows LESS than the investor stepper: founders see which
 * stages are cleared, which one they are in, and when each cleared — but
 * never the reviewer's identity, their private comment or their score.
 * Those live in the ledger and are internal to the investment team.
 */

type StageState = 'cleared' | 'in_review' | 'upcoming' | 'not_cleared' | 'approved' | 'declined';

interface Stage {
  key: string;
  label: string;
  next: string;
  state: StageState;
  clearedAt?: string;
}

function formatDate(iso: string, language: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function stageLabel(t: TranslationKeys, level: ReviewLevel): string {
  return level === 1 ? t.founderPipeline.stage1 : level === 2 ? t.founderPipeline.stage2 : t.founderPipeline.stage3;
}

function stageNext(t: TranslationKeys, level: ReviewLevel): string {
  return level === 1 ? t.founderPipeline.stage1Next : level === 2 ? t.founderPipeline.stage2Next : t.founderPipeline.stage3Next;
}

function buildStages(app: InvestmentApplication, t: TranslationKeys): { stages: Stage[]; activeIndex: number; terminal: StageState | null; droppedLabel: string } {
  const state = getPipelineState(app);
  const { ledger, clearedCount, droppedAtLevel, currentLevel, finalUnlocked } = state;

  const statusApproved = app.status === 'approved' || app.status === 'invested';
  const statusRejected = app.status === 'rejected';

  const stages: Stage[] = ([1, 2, 3] as ReviewLevel[]).map(level => {
    const entry = ledger.levels.find(l => l.level === level);
    let s: StageState;
    if (entry) {
      s = entry.outcome === 'shortlisted' ? 'cleared' : 'not_cleared';
    } else if (droppedAtLevel !== null) {
      s = 'upcoming';
    } else {
      s = currentLevel === level ? 'in_review' : 'upcoming';
    }
    return {
      key: `level${level}`,
      label: stageLabel(t, level),
      next: stageNext(t, level),
      state: s,
      // Only the date is exposed — never the reviewer or their comment
      clearedAt: entry && entry.outcome === 'shortlisted' ? entry.reviewedAt : undefined,
    };
  });

  const finalState: StageState =
    statusApproved || ledger.final?.outcome === 'approved' ? 'approved'
    : statusRejected || ledger.final?.outcome === 'rejected' ? 'declined'
    : droppedAtLevel !== null ? 'upcoming'
    : finalUnlocked ? 'in_review'
    : 'upcoming';

  stages.push({
    key: 'final',
    label: t.founderPipeline.finalStage,
    next: t.founderPipeline.finalStageNext,
    state: finalState,
    clearedAt: finalState === 'approved' || finalState === 'declined' ? ledger.final?.decidedAt : undefined,
  });

  const terminal: StageState | null =
    finalState === 'approved' ? 'approved'
    : finalState === 'declined' ? 'declined'
    : droppedAtLevel !== null ? 'not_cleared'
    : null;

  const activeIndex = stages.findIndex(s => s.state === 'in_review');

  return {
    stages,
    activeIndex: activeIndex === -1 ? Math.min(clearedCount, 3) : activeIndex,
    terminal,
    droppedLabel: droppedAtLevel !== null ? stageLabel(t, droppedAtLevel) : '',
  };
}

// ─── Node ─────────────────────────────────────────────────────────────────────

function StageNode({ state, index, size }: { state: StageState; index: number; size: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  const icon = size === 'sm' ? 11 : 14;
  return (
    <div
      className={cn(
        dim, 'rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
        state === 'cleared'     && 'bg-emerald-500 text-white',
        state === 'approved'    && 'bg-green-600 text-white',
        state === 'in_review'   && 'bg-amber-100 text-amber-700 ring-2 ring-amber-300',
        state === 'not_cleared' && 'bg-red-500 text-white',
        state === 'declined'    && 'bg-red-500 text-white',
        state === 'upcoming'    && 'bg-gray-100 text-gray-300',
      )}
    >
      {state === 'cleared'     && <Check size={icon} />}
      {state === 'approved'    && <ShieldCheck size={icon} />}
      {state === 'not_cleared' && <X size={icon} />}
      {state === 'declined'    && <X size={icon} />}
      {state === 'in_review'   && <CircleDot size={icon} />}
      {state === 'upcoming'    && (size === 'sm' ? <Lock size={9} /> : String(index + 1))}
    </div>
  );
}

function StatePill({ state, t }: { state: StageState; t: TranslationKeys }) {
  const cfg: Record<StageState, { label: string; cls: string }> = {
    cleared:     { label: t.founderPipeline.stateCleared,     cls: 'text-emerald-700 bg-emerald-50 ring-emerald-200' },
    approved:    { label: t.founderPipeline.stateApproved,    cls: 'text-green-700 bg-green-50 ring-green-200' },
    in_review:   { label: t.founderPipeline.stateInReview,    cls: 'text-amber-700 bg-amber-50 ring-amber-200' },
    upcoming:    { label: t.founderPipeline.stateUpcoming,    cls: 'text-gray-500 bg-gray-50 ring-gray-200' },
    not_cleared: { label: t.founderPipeline.stateNotCleared,  cls: 'text-red-700 bg-red-50 ring-red-200' },
    declined:    { label: t.founderPipeline.stateDeclined,    cls: 'text-red-700 bg-red-50 ring-red-200' },
  };
  const c = cfg[state];
  return (
    <span className={cn('inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1', c.cls)}>
      {c.label}
    </span>
  );
}

// ─── Compact variant (collapsed card) ─────────────────────────────────────────

function CompactProgress({ stages, activeIndex, t }: { stages: Stage[]; activeIndex: number; t: TranslationKeys }) {
  const current = stages[activeIndex];
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {stages.map((s, i) => (
          <React.Fragment key={s.key}>
            <StageNode state={s.state} index={i} size="sm" />
            {i < stages.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  s.state === 'cleared' || s.state === 'approved' ? 'bg-emerald-300'
                    : s.state === 'not_cleared' || s.state === 'declined' ? 'bg-red-200'
                    : 'bg-gray-200',
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center justify-between mt-1.5 gap-2">
        <p className="text-[10px] font-medium text-gray-600 truncate">
          {current?.label}
        </p>
        <p className="text-[10px] text-gray-400 flex-shrink-0">
          {t.founderPipeline.stageCount.replace('{n}', String(Math.min(activeIndex + 1, 4)))}
        </p>
      </div>
    </div>
  );
}

// ─── Detailed variant (expanded card) ─────────────────────────────────────────

function DetailedProgress({
  stages, terminal, droppedLabel, actionNeeded, language, t,
}: {
  stages: Stage[]; terminal: StageState | null; droppedLabel: string;
  actionNeeded: boolean; language: string; t: TranslationKeys;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-900">{t.founderPipeline.title}</h4>
        <p className="text-[11px] text-gray-500 mt-0.5">{t.founderPipeline.subtitle}</p>
      </div>

      {/* Terminal banners */}
      {terminal === 'approved' && (
        <div className="mb-4 flex items-start gap-2.5 px-3 py-2.5 bg-green-50 border border-green-100 rounded-xl">
          <ShieldCheck size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-green-800">{t.founderPipeline.approvedTitle}</p>
            <p className="text-[11px] text-green-700 mt-0.5">{t.founderPipeline.approvedDesc}</p>
          </div>
        </div>
      )}
      {terminal === 'not_cleared' && (
        <div className="mb-4 flex items-start gap-2.5 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-red-800">
              {t.founderPipeline.notClearedTitle.replace('{stage}', droppedLabel)}
            </p>
            <p className="text-[11px] text-red-700 mt-0.5">{t.founderPipeline.notClearedDesc}</p>
          </div>
        </div>
      )}
      {terminal === 'declined' && (
        <div className="mb-4 flex items-start gap-2.5 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-red-800">{t.founderPipeline.declinedTitle}</p>
            <p className="text-[11px] text-red-700 mt-0.5">{t.founderPipeline.declinedDesc}</p>
          </div>
        </div>
      )}

      {/* Stage list */}
      <div className="space-y-0">
        {stages.map((s, i) => {
          const isLast = i === stages.length - 1;
          const isActive = s.state === 'in_review';
          return (
            <div key={s.key} className="relative flex gap-3">
              {/* Connector */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute left-[15px] top-8 w-0.5 h-[calc(100%-14px)]',
                    s.state === 'cleared' || s.state === 'approved' ? 'bg-emerald-300'
                      : s.state === 'not_cleared' || s.state === 'declined' ? 'bg-red-200'
                      : 'bg-gray-200',
                  )}
                />
              )}
              <div className="pt-0.5 z-10">
                <StageNode state={s.state} index={i} size="md" />
              </div>
              <div className={cn('flex-1 min-w-0 pb-4', isLast && 'pb-0')}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn(
                    'text-xs font-semibold',
                    s.state === 'upcoming' ? 'text-gray-400' : 'text-gray-900',
                  )}>
                    {s.label}
                  </p>
                  <StatePill state={s.state} t={t} />
                </div>

                {s.clearedAt && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {t.founderPipeline.clearedOn.replace('{date}', formatDate(s.clearedAt, language))}
                  </p>
                )}

                {/* Plain-language "what's happening" only for the active stage */}
                {isActive && (
                  <div className="mt-2 px-3 py-2 bg-amber-50/60 border border-amber-100 rounded-xl">
                    <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide mb-0.5">
                      {t.founderPipeline.whatsNext}
                    </p>
                    <p className="text-[11px] text-amber-900 leading-relaxed">{s.next}</p>
                    <p className="text-[10px] font-medium text-amber-700 mt-1.5">
                      {actionNeeded ? t.founderPipeline.actionNeeded : t.founderPipeline.noActionNeeded}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Why comments are not shown */}
      <p className="text-[10px] text-gray-400 mt-3 inline-flex items-center gap-1">
        <Info size={10} /> {t.founderPipeline.internalNote}
      </p>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function FounderReviewProgress({
  app, variant = 'detailed', actionNeeded = false,
}: {
  app: InvestmentApplication;
  variant?: 'compact' | 'detailed';
  actionNeeded?: boolean;
}) {
  const { t, language } = useLanguage();
  const { stages, activeIndex, terminal, droppedLabel } = buildStages(app, t);

  if (variant === 'compact') {
    return <CompactProgress stages={stages} activeIndex={activeIndex} t={t} />;
  }
  return (
    <DetailedProgress
      stages={stages}
      terminal={terminal}
      droppedLabel={droppedLabel}
      actionNeeded={actionNeeded}
      language={language}
      t={t}
    />
  );
}

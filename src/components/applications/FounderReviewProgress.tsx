import React from 'react';
import { Check, Lock, CircleDot, X, ShieldCheck, Info, AlertCircle, Clock } from 'lucide-react';
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
 * This is the single progress indicator for the founder application page —
 * it replaces the old aggregate "Application Pipeline" funnel and the
 * "In Progress" stat, which described the same thing three different ways.
 *
 * Variants:
 *   hero     — the page's main progress element: header, horizontal level
 *              strip, and the full vertical stage detail.
 *   detailed — same vertical detail, no header/strip (inside a card).
 *   compact  — a 4-node strip for list rows.
 *
 * `showReviewerDetails` controls whether the reviewer's name and comment are
 * exposed to the founder. Set it to false to keep review notes internal to
 * the investment team; stage names, states and dates always show.
 */

type StageState = 'cleared' | 'in_review' | 'upcoming' | 'not_cleared' | 'approved' | 'declined';

interface Stage {
  key: string;
  label: string;
  next: string;
  state: StageState;
  date?: string;
  reviewer?: string;
  comment?: string;
}

function formatDate(iso: string, language: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function stageLabel(t: TranslationKeys, level: ReviewLevel): string {
  return level === 1 ? t.founderPipeline.stage1 : level === 2 ? t.founderPipeline.stage2 : t.founderPipeline.stage3;
}

function stageNext(t: TranslationKeys, level: ReviewLevel): string {
  return level === 1 ? t.founderPipeline.stage1Next : level === 2 ? t.founderPipeline.stage2Next : t.founderPipeline.stage3Next;
}

/** Short label for the horizontal strip: "Level 1", "Level 2", … */
function shortLabel(t: TranslationKeys, i: number): string {
  return i < 3
    ? `${t.founderPipeline.title.split(' ')[0]} ${i + 1}`.replace(/^\S+/, `L${i + 1}`)
    : t.founderPipeline.finalStage;
}

interface BuiltPipeline {
  stages: Stage[];
  activeIndex: number;
  terminal: StageState | null;
  droppedLabel: string;
  clearedCount: number;
}

function buildStages(app: InvestmentApplication, t: TranslationKeys): BuiltPipeline {
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
      date: entry?.reviewedAt,
      reviewer: entry?.reviewer,
      comment: entry?.comment,
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
    date: finalState === 'approved' || finalState === 'declined' ? ledger.final?.decidedAt : undefined,
    reviewer: ledger.final?.reviewer,
    comment: ledger.final?.comment,
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
    clearedCount,
  };
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function StageNode({ state, index, size }: { state: StageState; index: number; size: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-8 h-8' : 'w-10 h-10';
  const icon = size === 'sm' ? 11 : size === 'md' ? 14 : 17;
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

function connectorClass(state: StageState): string {
  return state === 'cleared' || state === 'approved' ? 'bg-emerald-300'
    : state === 'not_cleared' || state === 'declined' ? 'bg-red-200'
    : 'bg-gray-200';
}

// ─── Horizontal level strip (hero + compact) ──────────────────────────────────

function LevelStrip({ stages, size, t }: { stages: Stage[]; size: 'sm' | 'lg'; t: TranslationKeys }) {
  return (
    <div className="flex items-start gap-1.5">
      {stages.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={cn('flex flex-col items-center', size === 'lg' && 'flex-shrink-0')}>
            <StageNode state={s.state} index={i} size={size === 'lg' ? 'lg' : 'sm'} />
            {size === 'lg' && (
              <span
                className={cn(
                  'text-[10px] font-semibold mt-1.5 text-center leading-tight max-w-[72px]',
                  s.state === 'upcoming' ? 'text-gray-400'
                    : s.state === 'in_review' ? 'text-amber-700'
                    : s.state === 'not_cleared' || s.state === 'declined' ? 'text-red-600'
                    : 'text-emerald-700',
                )}
              >
                {shortLabel(t, i)}
              </span>
            )}
          </div>
          {i < stages.length - 1 && (
            <div
              className={cn(
                'h-0.5 flex-1 rounded-full min-w-[12px]',
                size === 'lg' ? 'mt-5' : 'mt-3',
                connectorClass(s.state),
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Terminal banners ─────────────────────────────────────────────────────────

function TerminalBanner({ terminal, droppedLabel, t }: { terminal: StageState; droppedLabel: string; t: TranslationKeys }) {
  const map = {
    approved:    { Icon: ShieldCheck, cls: 'bg-green-50 border-green-100', title: 'text-green-800', body: 'text-green-700', iconCls: 'text-green-600', titleText: t.founderPipeline.approvedTitle, bodyText: t.founderPipeline.approvedDesc },
    not_cleared: { Icon: AlertCircle, cls: 'bg-red-50 border-red-100',     title: 'text-red-800',   body: 'text-red-700',   iconCls: 'text-red-600',   titleText: t.founderPipeline.notClearedTitle.replace('{stage}', droppedLabel), bodyText: t.founderPipeline.notClearedDesc },
    declined:    { Icon: AlertCircle, cls: 'bg-red-50 border-red-100',     title: 'text-red-800',   body: 'text-red-700',   iconCls: 'text-red-600',   titleText: t.founderPipeline.declinedTitle, bodyText: t.founderPipeline.declinedDesc },
  } as const;
  const c = map[terminal as keyof typeof map];
  if (!c) return null;
  const { Icon } = c;
  return (
    <div className={cn('flex items-start gap-2.5 px-3 py-2.5 border rounded-xl', c.cls)}>
      <Icon size={14} className={cn('flex-shrink-0 mt-0.5', c.iconCls)} />
      <div>
        <p className={cn('text-[11px] font-bold', c.title)}>{c.titleText}</p>
        <p className={cn('text-[11px] mt-0.5', c.body)}>{c.bodyText}</p>
      </div>
    </div>
  );
}

// ─── Vertical stage detail ────────────────────────────────────────────────────

function StageList({
  stages, actionNeeded, showReviewerDetails, language, t,
}: {
  stages: Stage[]; actionNeeded: boolean; showReviewerDetails: boolean;
  language: string; t: TranslationKeys;
}) {
  return (
    <div className="space-y-0">
      {stages.map((s, i) => {
        const isLast = i === stages.length - 1;
        const isActive = s.state === 'in_review';
        const hasRecord = !!s.date && s.state !== 'upcoming';
        return (
          <div key={s.key} className="relative flex gap-3">
            {!isLast && (
              <div className={cn('absolute left-[15px] top-8 w-0.5 h-[calc(100%-14px)]', connectorClass(s.state))} />
            )}
            <div className="pt-0.5 z-10">
              <StageNode state={s.state} index={i} size="md" />
            </div>
            <div className={cn('flex-1 min-w-0', isLast ? 'pb-0' : 'pb-4')}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn('text-xs font-semibold', s.state === 'upcoming' ? 'text-gray-400' : 'text-gray-900')}>
                  {s.label}
                </p>
                <StatePill state={s.state} t={t} />
              </div>

              {/* Reviewer + date */}
              {hasRecord && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {showReviewerDetails && s.reviewer && (
                    <>
                      <span className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                        s.state === 'cleared' || s.state === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700',
                      )}>
                        {initials(s.reviewer)}
                      </span>
                      <span className="text-[11px] text-gray-600">
                        <span className="text-gray-400">{t.founderPipeline.reviewedByLabel} </span>
                        <span className="font-medium text-gray-800">{s.reviewer}</span>
                      </span>
                      <span className="text-gray-300">·</span>
                    </>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                    <Clock size={10} /> {formatDate(s.date!, language)}
                  </span>
                </div>
              )}

              {/* Reviewer comment */}
              {showReviewerDetails && hasRecord && s.comment && (
                <div className="mt-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    {t.founderPipeline.reviewCommentLabel}
                  </p>
                  <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">{s.comment}</p>
                </div>
              )}

              {/* "What's happening now" — active stage only */}
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
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function FounderReviewProgress({
  app,
  variant = 'detailed',
  actionNeeded = false,
  showReviewerDetails = true,
}: {
  app: InvestmentApplication;
  variant?: 'compact' | 'detailed' | 'hero';
  actionNeeded?: boolean;
  showReviewerDetails?: boolean;
}) {
  const { t, language } = useLanguage();
  const { stages, activeIndex, terminal, droppedLabel } = buildStages(app, t);

  // ── Compact: list-row strip ──
  if (variant === 'compact') {
    const current = stages[activeIndex];
    return (
      <div>
        <LevelStrip stages={stages} size="sm" t={t} />
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <p className="text-[10px] font-medium text-gray-600 truncate">{current?.label}</p>
          <p className="text-[10px] text-gray-400 flex-shrink-0">
            {t.founderPipeline.stageCount.replace('{n}', String(Math.min(activeIndex + 1, 4)))}
          </p>
        </div>
      </div>
    );
  }

  // ── Detailed: vertical list inside an existing card ──
  if (variant === 'detailed') {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900">{t.founderPipeline.title}</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">{t.founderPipeline.subtitle}</p>
        </div>
        {terminal && <div className="mb-4"><TerminalBanner terminal={terminal} droppedLabel={droppedLabel} t={t} /></div>}
        <StageList
          stages={stages}
          actionNeeded={actionNeeded}
          showReviewerDetails={showReviewerDetails}
          language={language}
          t={t}
        />
        {!showReviewerDetails && (
          <p className="text-[10px] text-gray-400 mt-3 inline-flex items-center gap-1">
            <Info size={10} /> {t.founderPipeline.internalNote}
          </p>
        )}
      </div>
    );
  }

  // ── Hero: the page's main progress indicator ──
  const current = stages[activeIndex];
  const stageNo = Math.min(activeIndex + 1, 4);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">{t.founderPipeline.heroTitle}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">{t.founderPipeline.heroSubtitle}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-2 justify-end">
              {current && <StatePill state={current.state} t={t} />}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {terminal
                ? formatDate(stages[3]?.date || '', language)
                : t.founderPipeline.stageCount.replace('{n}', String(stageNo))}
            </p>
          </div>
        </div>

        {/* Horizontal level strip */}
        <div className="mt-5">
          <LevelStrip stages={stages} size="lg" t={t} />
        </div>

        {/* Current stage callout */}
        {!terminal && current && (
          <div className="mt-4 flex items-start gap-2.5 px-3.5 py-3 bg-amber-50/60 border border-amber-100 rounded-xl">
            <CircleDot size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
                {t.founderPipeline.currentStage}
              </p>
              <p className="text-xs font-bold text-gray-900 mt-0.5">{current.label}</p>
              <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">{current.next}</p>
              <p className="text-[10px] font-medium text-amber-700 mt-1.5">
                {actionNeeded ? t.founderPipeline.actionNeeded : t.founderPipeline.noActionNeeded}
              </p>
            </div>
          </div>
        )}

        {terminal && <div className="mt-4"><TerminalBanner terminal={terminal} droppedLabel={droppedLabel} t={t} /></div>}
      </div>

      {/* Stage-by-stage detail */}
      <div className="px-5 py-4">
        <StageList
          stages={stages}
          actionNeeded={actionNeeded}
          showReviewerDetails={showReviewerDetails}
          language={language}
          t={t}
        />
        {!showReviewerDetails && (
          <p className="text-[10px] text-gray-400 mt-3 inline-flex items-center gap-1">
            <Info size={10} /> {t.founderPipeline.internalNote}
          </p>
        )}
      </div>
    </div>
  );
}

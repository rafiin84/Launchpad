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
        state === 'cleared'     && 'bg-emerald-100 text-emerald-600',
        state === 'approved'    && 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200',
        state === 'in_review'   && 'bg-amber-100 text-amber-700 ring-2 ring-amber-300',
        state === 'not_cleared' && 'bg-rose-100 text-rose-600',
        state === 'declined'    && 'bg-rose-100 text-rose-600',
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
  return state === 'cleared' || state === 'approved' ? 'bg-emerald-200'
    : state === 'not_cleared' || state === 'declined' ? 'bg-rose-200'
    : 'bg-gray-200';
}

// ─── Horizontal level strip (hero + compact) ──────────────────────────────────

function stepTone(state: StageState): string {
  return state === 'upcoming' ? 'text-gray-400'
    : state === 'in_review' ? 'text-amber-700'
    : state === 'not_cleared' || state === 'declined' ? 'text-red-600'
    : 'text-emerald-700';
}

function LevelStrip({ stages, size, language, t }: { stages: Stage[]; size: 'sm' | 'lg'; language: string; t: TranslationKeys }) {
  if (size === 'sm') {
    return (
      <div className="flex items-center gap-1.5">
        {stages.map(s => (
          <div
            key={s.key}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              s.state === 'cleared' || s.state === 'approved' ? 'bg-emerald-500'
                : s.state === 'not_cleared' || s.state === 'declined' ? 'bg-rose-400'
                : s.state === 'in_review' ? 'bg-amber-400'
                : 'bg-gray-200',
            )}
          />
        ))}
      </div>
    );
  }

  // Four equal columns: each node sits at its column's centre, and the line
  // to the next node is drawn from centre to centre, so labels never push the
  // nodes out of alignment.
  return (
    <ol className="grid grid-cols-4">
      {stages.map((s, i) => (
        <li key={s.key} className="relative flex flex-col items-center text-center px-1">
          {i < stages.length - 1 && (
            <div className={cn('absolute top-5 left-1/2 w-full h-0.5 -translate-y-1/2', connectorClass(s.state))} />
          )}
          <div className="relative z-10 bg-white rounded-full">
            <StageNode state={s.state} index={i} size="lg" />
          </div>
          <span className={cn('mt-2 text-xs font-semibold leading-tight', stepTone(s.state))}>{s.label}</span>
          <span className="mt-0.5 text-[11px] text-gray-400 leading-tight">
            {s.date && s.state !== 'upcoming' ? formatDate(s.date, language) : <StateText state={s.state} t={t} />}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StateText({ state, t }: { state: StageState; t: TranslationKeys }) {
  const label = {
    cleared: t.founderPipeline.stateCleared,
    approved: t.founderPipeline.stateApproved,
    in_review: t.founderPipeline.stateInReview,
    upcoming: t.founderPipeline.stateUpcoming,
    not_cleared: t.founderPipeline.stateNotCleared,
    declined: t.founderPipeline.stateDeclined,
  }[state];
  return <>{label}</>;
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

// ─── Stage-by-stage detail ────────────────────────────────────────────────────

function StageList({
  stages, actionNeeded, showReviewerDetails, language, t,
}: {
  stages: Stage[]; actionNeeded: boolean; showReviewerDetails: boolean;
  language: string; t: TranslationKeys;
}) {
  return (
    <ul className="divide-y divide-gray-100">
      {stages.map((s, i) => {
        const isActive = s.state === 'in_review';
        const hasRecord = !!s.date && s.state !== 'upcoming';
        return (
          <li key={s.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <StageNode state={s.state} index={i} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn('text-sm font-semibold', s.state === 'upcoming' ? 'text-gray-400' : 'text-gray-900')}>
                    {s.label}
                  </p>
                  <StatePill state={s.state} t={t} />
                </div>

                {hasRecord && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {showReviewerDetails && s.reviewer && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                          s.state === 'cleared' || s.state === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700',
                        )}>
                          {initials(s.reviewer)}
                        </span>
                        <span className="font-medium text-gray-700">{s.reviewer}</span>
                        <span className="text-gray-300">·</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} /> {formatDate(s.date!, language)}
                    </span>
                  </div>
                )}
              </div>

              {showReviewerDetails && hasRecord && s.comment && (
                <div className="mt-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    {t.founderPipeline.reviewCommentLabel}
                  </p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{s.comment}</p>
                </div>
              )}

              {/* "What's happening now" — active stage only */}
              {isActive && (
                <div className="mt-2 px-3 py-2 bg-amber-50/60 border border-amber-100 rounded-xl">
                  <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide mb-0.5">
                    {t.founderPipeline.whatsNext}
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed">{s.next}</p>
                  <p className="text-[11px] font-medium text-amber-700 mt-1.5">
                    {actionNeeded ? t.founderPipeline.actionNeeded : t.founderPipeline.noActionNeeded}
                  </p>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Rail: sticky side panel with a vertical timeline ─────────────────────────

function RailTimeline({
  stages, actionNeeded, showReviewerDetails, language, t,
}: {
  stages: Stage[]; actionNeeded: boolean; showReviewerDetails: boolean;
  language: string; t: TranslationKeys;
}) {
  return (
    <ol className="relative">
      {stages.map((s, i) => {
        const isLast = i === stages.length - 1;
        const hasRecord = !!s.date && s.state !== 'upcoming';
        return (
          <li key={s.key} className={cn('relative pl-12', !isLast && 'pb-4')}>
            {!isLast && (
              <div className={cn('absolute left-[15px] top-8 bottom-0 w-0.5', connectorClass(s.state))} />
            )}
            <div className="absolute left-0 top-3 z-10 rounded-full ring-4 ring-white">
              <StageNode state={s.state} index={i} size="md" />
            </div>
            <div className={cn(
              'rounded-xl border px-4 py-3',
              s.state === 'in_review' ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-white',
            )}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn('text-sm font-semibold', s.state === 'upcoming' ? 'text-gray-400' : 'text-gray-900')}>
                  {s.label}
                </p>
                <StatePill state={s.state} t={t} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{s.next}</p>

              {hasRecord && (
                <div className="flex items-center gap-x-2 gap-y-1 mt-2 flex-wrap text-xs text-gray-500">
                  {showReviewerDetails && s.reviewer && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                        s.state === 'cleared' || s.state === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700',
                      )}>
                        {initials(s.reviewer)}
                      </span>
                      <span className="font-medium text-gray-700 break-all">{s.reviewer}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} /> {formatDate(s.date!, language)}
                  </span>
                </div>
              )}

              {showReviewerDetails && hasRecord && s.comment && (
                <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    {t.founderPipeline.reviewCommentLabel}
                  </p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{s.comment}</p>
                </div>
              )}

              {s.state === 'in_review' && (
                <p className="text-[11px] font-medium text-amber-700 mt-2">
                  {actionNeeded ? t.founderPipeline.actionNeeded : t.founderPipeline.noActionNeeded}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
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
  variant?: 'compact' | 'detailed' | 'hero' | 'rail';
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
        <LevelStrip stages={stages} size="sm" language={language} t={t} />
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <p className="text-[10px] font-medium text-gray-600 truncate">{current?.label}</p>
          <p className="text-[10px] text-gray-400 flex-shrink-0">
            {t.founderPipeline.stageCount.replace('{n}', String(Math.min(activeIndex + 1, 4)))}
          </p>
        </div>
      </div>
    );
  }

  // ── Rail: sticky side panel — summary, progress bar, then a vertical timeline ──
  if (variant === 'rail') {
    const done = stages.filter(x => x.state === 'cleared' || x.state === 'approved' || x.state === 'declined').length;
    const pct = Math.round((done / stages.length) * 100);
    const barTone = terminal === 'not_cleared' || terminal === 'declined' ? 'bg-rose-400' : 'bg-emerald-400';
    const stepNo = Math.min(activeIndex + 1, stages.length);
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-base font-bold text-gray-900">{t.founderPipeline.heroTitle}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t.founderPipeline.subtitle}</p>

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-gray-900">
              {t.founderPipeline.stageCount.replace('{n}', String(terminal ? stages.length : stepNo))}
            </p>
            <p className="text-xs text-gray-400">{pct}%</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barTone)} style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-4 mt-2">
            {stages.map((x, i) => (
              <span
                key={x.key}
                className={cn(
                  'text-[10px] font-medium truncate',
                  i === 0 ? 'text-left' : i === stages.length - 1 ? 'text-right' : 'text-center',
                  stepTone(x.state),
                )}
              >
                {i < 3 ? `${t.founderPipeline.levelWord} ${i + 1}` : x.label}
              </span>
            ))}
          </div>
        </div>

        {terminal && <div className="mt-4"><TerminalBanner terminal={terminal} droppedLabel={droppedLabel} t={t} /></div>}

        <div className="mt-5">
          <RailTimeline
            stages={stages}
            actionNeeded={actionNeeded}
            showReviewerDetails={showReviewerDetails}
            language={language}
            t={t}
          />
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
          <LevelStrip stages={stages} size="lg" language={language} t={t} />
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

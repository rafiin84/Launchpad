import React, { useState } from 'react';
import {
  Check, X, Lock, Clock, ChevronRight, CircleDot, ShieldCheck,
  Search, FileSearch, Award, Gavel, AlertTriangle, Star,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKeys } from '../../i18n';
import {
  getPipelineState,
  getStageState,
  getLevelReview,
  REVIEW_LEVELS,
  type InvestmentApplication,
  type ReviewLevel,
  type LevelOutcome,
  type LevelReview,
  type PipelineStageState,
  type PipelineState,
} from '../../services/investmentApplications';
import ConfirmDecisionDialog from './ConfirmDecisionDialog';
import { cn } from '../../lib/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string, language: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// ─── Per-level static config ──────────────────────────────────────────────────

const LEVEL_META: Record<ReviewLevel, { icon: React.ElementType; accent: string; accentBg: string; accentRing: string }> = {
  1: { icon: Search,     accent: 'text-sky-600',    accentBg: 'bg-sky-50',    accentRing: 'ring-sky-100' },
  2: { icon: FileSearch, accent: 'text-indigo-600', accentBg: 'bg-indigo-50', accentRing: 'ring-indigo-100' },
  3: { icon: Award,      accent: 'text-violet-600', accentBg: 'bg-violet-50', accentRing: 'ring-violet-100' },
};

function levelTitle(t: TranslationKeys, level: ReviewLevel): string {
  return level === 1 ? t.reviewPipeline.level1 : level === 2 ? t.reviewPipeline.level2 : t.reviewPipeline.level3;
}

function levelDesc(t: TranslationKeys, level: ReviewLevel): string {
  return level === 1 ? t.reviewPipeline.level1Desc : level === 2 ? t.reviewPipeline.level2Desc : t.reviewPipeline.level3Desc;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StagePill({ state, t }: { state: PipelineStageState | 'approved' | 'rejected'; t: TranslationKeys }) {
  const cfg: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    completed:       { label: t.reviewPipeline.stateCompleted,       cls: 'text-emerald-700 bg-emerald-50 ring-emerald-200', Icon: Check },
    current:         { label: t.reviewPipeline.stateCurrent,         cls: 'text-amber-700 bg-amber-50 ring-amber-200',       Icon: CircleDot },
    locked:          { label: t.reviewPipeline.stateLocked,          cls: 'text-gray-500 bg-gray-50 ring-gray-200',          Icon: Lock },
    not_shortlisted: { label: t.reviewPipeline.stateNotShortlisted,  cls: 'text-red-700 bg-red-50 ring-red-200',             Icon: X },
    approved:        { label: t.reviewPipeline.stateApproved,        cls: 'text-green-700 bg-green-50 ring-green-200',       Icon: ShieldCheck },
    rejected:        { label: t.reviewPipeline.stateRejected,        cls: 'text-red-700 bg-red-50 ring-red-200',             Icon: X },
  };
  const c = cfg[state] ?? cfg.locked;
  const Icon = c.Icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1', c.cls)}>
      <Icon size={11} /> {c.label}
    </span>
  );
}

// ─── Reviewer / decision record ───────────────────────────────────────────────

function ReviewRecord({
  reviewer, at, comment, score, language, t, tone,
}: {
  reviewer: string; at: string; comment: string; score?: number;
  language: string; t: TranslationKeys; tone: 'positive' | 'negative';
}) {
  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
          tone === 'positive' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
        )}>
          {initials(reviewer)}
        </span>
        <span className="text-xs font-semibold text-gray-900">{reviewer || '—'}</span>
        <span className="text-gray-300">·</span>
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          <Clock size={11} /> {formatDateTime(at, language)}
        </span>
        {typeof score === 'number' && (
          <>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              {t.reviewPipeline.scoreOf.replace('{n}', String(score))}
            </span>
          </>
        )}
      </div>
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.reviewPipeline.comment}</p>
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
          {comment || t.reviewPipeline.noComment}
        </p>
      </div>
    </div>
  );
}

// ─── Level decision modal ─────────────────────────────────────────────────────

export interface LevelDecisionPayload {
  outcome: LevelOutcome;
  comment: string;
  score?: number;
}

function LevelDecisionModal({
  level, companyName, reviewerName, onSubmit, onClose, submitting,
}: {
  level: ReviewLevel;
  companyName: string;
  reviewerName?: string;
  onSubmit: (payload: LevelDecisionPayload) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const { t } = useLanguage();
  const [outcome, setOutcome] = useState<LevelOutcome>('shortlisted');
  const [comment, setComment] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState('');
  // Second step: passing an application on or dropping it cannot be undone
  // from here, so the reviewer confirms against a plain statement of effects.
  const [confirming, setConfirming] = useState(false);

  const nextLabel = level < 3
    ? t.reviewPipeline.decisionShortlistDesc
    : t.reviewPipeline.decisionShortlistFinalDesc;

  /** Validates, then hands over to the confirmation step. */
  const requestConfirm = () => {
    if (!comment.trim()) { setError(t.reviewPipeline.commentRequired); return; }
    setError('');
    setConfirming(true);
  };

  const submit = () => {
    onSubmit({ outcome, comment: comment.trim(), score: score ?? undefined });
  };

  // ── Confirmation copy, specific to the decision being made ──
  const c = t.confirmDecision;
  const next = String(level + 1);
  const isDrop = outcome === 'not_shortlisted';
  const isFinalHandoff = !isDrop && level === 3;

  const confirmProps = isDrop
    ? {
        tone: 'danger' as const,
        title: c.dropTitle.replace('{company}', companyName),
        lines: [
          c.dropLine1.replace('{level}', String(level)),
          c.dropLine2,
          c.dropLine3,
        ],
        confirmLabel: c.dropConfirm,
      }
    : isFinalHandoff
    ? {
        tone: 'advance' as const,
        title: c.passFinalTitle.replace('{company}', companyName),
        lines: [c.passFinalLine1, c.passFinalLine2, c.passFinalLine3],
        confirmLabel: c.passFinalConfirm,
      }
    : {
        tone: 'advance' as const,
        title: c.passTitle.replace('{company}', companyName).replace('{next}', next),
        lines: [
          c.passLine1,
          c.passLine2.replace('{next}', next),
          c.passLine3,
        ],
        confirmLabel: c.passConfirm.replace('{next}', next),
      };

  const Icon = LEVEL_META[level].icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      {confirming && (
        <ConfirmDecisionDialog
          {...confirmProps}
          actorName={reviewerName}
          submitting={submitting}
          onConfirm={submit}
          onBack={() => setConfirming(false)}
        />
      )}
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', LEVEL_META[level].accentBg)}>
            <Icon size={18} className={LEVEL_META[level].accent} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900">
              {t.reviewPipeline.modalTitle.replace('{n}', String(level))}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.reviewPipeline.modalSubtitle.replace('{company}', companyName)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Decision */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">{t.reviewPipeline.decisionLabel}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOutcome('shortlisted')}
                className={cn(
                  'text-left px-3.5 py-3 rounded-xl border-2 transition-all',
                  outcome === 'shortlisted'
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                  <Check size={13} className="text-emerald-600" /> {t.reviewPipeline.decisionShortlist}
                </span>
                <span className="block text-[11px] text-gray-500 mt-0.5">{nextLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => setOutcome('not_shortlisted')}
                className={cn(
                  'text-left px-3.5 py-3 rounded-xl border-2 transition-all',
                  outcome === 'not_shortlisted'
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                  <X size={13} className="text-red-600" /> {t.reviewPipeline.decisionReject}
                </span>
                <span className="block text-[11px] text-gray-500 mt-0.5">{t.reviewPipeline.decisionRejectDesc}</span>
              </button>
            </div>
          </div>

          {/* Score */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">{t.reviewPipeline.scoreLabel}</p>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(score === n ? null : n)}
                  className={cn(
                    'w-9 h-9 rounded-lg border text-xs font-bold transition-all',
                    score !== null && n <= score
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              {t.reviewPipeline.commentLabel} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={e => { setComment(e.target.value); if (error) setError(''); }}
              placeholder={t.reviewPipeline.commentPlaceholder}
              rows={4}
              className={cn(
                'w-full text-xs text-gray-700 border rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2',
                error
                  ? 'border-red-300 focus:ring-red-500/20'
                  : 'border-gray-200 focus:ring-indigo-500/20 focus:border-indigo-400',
              )}
            />
            {error && <p className="text-[11px] text-red-600 font-medium mt-1">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t.applicationDetail.cancel}
          </button>
          <button
            onClick={requestConfirm}
            disabled={submitting}
            className={cn(
              'px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-50',
              outcome === 'shortlisted' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
            )}
          >
            {submitting ? t.reviewPipeline.recording : t.reviewPipeline.submitDecision}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Final reject modal ───────────────────────────────────────────────────────

function FinalRejectModal({
  companyName, reviewerName, onSubmit, onClose, submitting,
}: {
  companyName: string;
  reviewerName?: string;
  onSubmit: (comment: string) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const { t } = useLanguage();
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      {confirming && (
        <ConfirmDecisionDialog
          tone="danger"
          title={t.confirmDecision.rejectTitle.replace('{company}', companyName)}
          lines={[t.confirmDecision.rejectLine1, t.confirmDecision.rejectLine2, t.confirmDecision.rejectLine3]}
          confirmLabel={t.confirmDecision.rejectConfirm}
          actorName={reviewerName}
          submitting={submitting}
          onConfirm={() => onSubmit(comment.trim())}
          onBack={() => setConfirming(false)}
        />
      )}
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-900">{t.reviewPipeline.rejectModalTitle}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t.reviewPipeline.rejectModalDesc}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {t.reviewPipeline.rejectCommentLabel} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={comment}
            onChange={e => { setComment(e.target.value); if (error) setError(''); }}
            placeholder={t.reviewPipeline.rejectCommentPlaceholder}
            rows={4}
            className={cn(
              'w-full text-xs text-gray-700 border rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2',
              error ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-red-500/20 focus:border-red-400',
            )}
          />
          {error && <p className="text-[11px] text-red-600 font-medium mt-1">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">
            {t.applicationDetail.cancel}
          </button>
          <button
            onClick={() => {
              if (!comment.trim()) { setError(t.reviewPipeline.commentRequired); return; }
              setError('');
              setConfirming(true);
            }}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
          >
            {submitting ? t.reviewPipeline.recording : t.reviewPipeline.rejectConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stage card ───────────────────────────────────────────────────────────────

function StageCard({
  level, state, review, isLast, language, t, onAction, actionLoading, canAct, dense,
}: {
  level: ReviewLevel;
  state: PipelineStageState;
  review?: LevelReview;
  isLast: boolean;
  language: string;
  t: TranslationKeys;
  onAction: () => void;
  actionLoading: boolean;
  /** Whether this viewer may act on this level. */
  canAct: boolean;
  /** Narrow column: stack the action under the text instead of beside it. */
  dense?: boolean;
}) {
  const meta = LEVEL_META[level];
  const Icon = meta.icon;
  const isCurrent = state === 'current';
  const isDone = state === 'completed';
  const isDropped = state === 'not_shortlisted';
  const isLocked = state === 'locked';

  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-[19px] top-[44px] bottom-[-14px] w-0.5',
            isDone ? 'bg-emerald-300' : isDropped ? 'bg-red-200' : 'bg-gray-200',
          )}
        />
      )}

      <div className="flex gap-3.5">
        {/* Node */}
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-4 z-10',
            isDone   && 'bg-emerald-500 ring-emerald-100',
            isCurrent&& cn(meta.accentBg, meta.accentRing, 'ring-4'),
            isDropped&& 'bg-red-500 ring-red-100',
            isLocked && 'bg-gray-100 ring-gray-50',
          )}
        >
          {isDone   && <Check size={18} className="text-white" />}
          {isDropped&& <X size={18} className="text-white" />}
          {isCurrent&& <Icon size={17} className={meta.accent} />}
          {isLocked && <Lock size={15} className="text-gray-400" />}
        </div>

        {/* Body */}
        <div
          className={cn(
            'flex-1 min-w-0 rounded-2xl border p-4 transition-all',
            isCurrent ? 'border-amber-200 bg-amber-50/40 shadow-sm' : 'border-gray-100 bg-white',
            isLocked && 'opacity-60',
          )}
        >
          <div className={cn('flex items-start gap-3 flex-wrap', !dense && 'justify-between')}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={cn('text-sm font-bold', isLocked ? 'text-gray-500' : 'text-gray-900')}>
                  {levelTitle(t, level)}
                </h4>
                <StagePill state={state} t={t} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{levelDesc(t, level)}</p>
            </div>

            {isCurrent && canAct && (
              <button
                onClick={onAction}
                disabled={actionLoading}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gray-900 hover:bg-black transition-colors disabled:opacity-50 flex-shrink-0',
                  dense && 'w-full justify-center mt-2.5',
                )}
              >
                {actionLoading
                  ? t.reviewPipeline.recording
                  : <>{t.reviewPipeline.reviewLevel.replace('{n}', String(level))} <ChevronRight size={13} /></>}
              </button>
            )}
          </div>

          {/* Completed / dropped record */}
          {review && (
            <ReviewRecord
              reviewer={review.reviewer}
              at={review.reviewedAt}
              comment={review.comment}
              score={review.score}
              language={language}
              t={t}
              tone={review.outcome === 'shortlisted' ? 'positive' : 'negative'}
            />
          )}

          {/* Locked hint */}
          {isLocked && !review && (
            <p className="text-[11px] text-gray-400 mt-2 inline-flex items-center gap-1">
              <Lock size={10} /> {t.reviewPipeline.lockedHint.replace('{n}', String(level - 1))}
            </p>
          )}

          {/* Awaiting hint */}
          {isCurrent && (
            <p className="text-[11px] font-medium text-amber-700 mt-2.5 inline-flex items-center gap-1">
              <CircleDot size={10} />
              {canAct ? t.reviewPipeline.awaitingReview : t.reviewerQueue.notMyLevel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Final stage card ─────────────────────────────────────────────────────────

function FinalStageCard({
  state, ledgerFinal, language, t, onApprove, onReject, actionLoading, unlocked, dense,
}: {
  state: 'locked' | 'current' | 'approved' | 'rejected';
  ledgerFinal?: { reviewer: string; decidedAt: string; comment: string; outcome: string };
  language: string;
  t: TranslationKeys;
  onApprove: () => void;
  onReject: () => void;
  actionLoading: boolean;
  unlocked: boolean;
  /** Narrow column: stack the two decisions under the text, side by side. */
  dense?: boolean;
}) {
  const isLocked = state === 'locked';
  const isDecided = state === 'approved' || state === 'rejected';

  return (
    <div className="relative">
      <div className="flex gap-3.5">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-4 z-10',
            state === 'approved' && 'bg-green-600 ring-green-100',
            state === 'rejected' && 'bg-red-500 ring-red-100',
            state === 'current'  && 'bg-gray-900 ring-gray-200',
            isLocked             && 'bg-gray-100 ring-gray-50',
          )}
        >
          {state === 'approved' && <ShieldCheck size={18} className="text-white" />}
          {state === 'rejected' && <X size={18} className="text-white" />}
          {state === 'current'  && <Gavel size={16} className="text-white" />}
          {isLocked             && <Lock size={15} className="text-gray-400" />}
        </div>

        <div
          className={cn(
            'flex-1 min-w-0 rounded-2xl border p-4',
            state === 'current'  && 'border-gray-900/15 bg-gray-50 shadow-sm',
            state === 'approved' && 'border-green-200 bg-green-50/40',
            state === 'rejected' && 'border-red-200 bg-red-50/40',
            isLocked             && 'border-gray-100 bg-white opacity-60',
          )}
        >
          <div className={cn('flex items-start gap-3 flex-wrap', !dense && 'justify-between')}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={cn('text-sm font-bold', isLocked ? 'text-gray-500' : 'text-gray-900')}>
                  {t.reviewPipeline.finalStage}
                </h4>
                <StagePill state={isDecided ? (state as 'approved' | 'rejected') : isLocked ? 'locked' : 'current'} t={t} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{t.reviewPipeline.finalStageDesc}</p>
            </div>

            {state === 'current' && unlocked && (
              <div className={cn(
                'flex items-center gap-2',
                dense ? 'w-full mt-2.5 [&>button]:flex-1 [&>button]:justify-center' : 'flex-shrink-0',
              )}>
                <button
                  onClick={onReject}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <X size={13} /> {t.reviewPipeline.rejectAction}
                </button>
                <button
                  onClick={onApprove}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <ShieldCheck size={13} /> {t.reviewPipeline.approveAction}
                </button>
              </div>
            )}
          </div>

          {ledgerFinal && (
            <ReviewRecord
              reviewer={ledgerFinal.reviewer}
              at={ledgerFinal.decidedAt}
              comment={ledgerFinal.comment}
              language={language}
              t={t}
              tone={ledgerFinal.outcome === 'approved' ? 'positive' : 'negative'}
            />
          )}

          {isLocked && (
            <p className="text-[11px] text-gray-400 mt-2 inline-flex items-center gap-1">
              <Lock size={10} /> {t.reviewPipeline.finalLockedHint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main pipeline component ──────────────────────────────────────────────────

export default function ReviewPipeline({
  app, onLevelDecision, onApprove, onReject, actionLoading, error,
  actableLevel = null, canDecideFinal = true, reviewerName, dense = false,
}: {
  app: InvestmentApplication;
  onLevelDecision: (level: ReviewLevel, payload: LevelDecisionPayload) => Promise<void>;
  onApprove: () => void;
  onReject: (comment: string) => Promise<void>;
  actionLoading: boolean;
  error?: string;
  /**
   * The review level this viewer owns (1-3), or null for the investor.
   * A reviewer sees the whole pipeline but can only act on their own level.
   */
  actableLevel?: 1 | 2 | 3 | null;
  /** False for reviewers — the final approve/reject belongs to the investor. */
  canDecideFinal?: boolean;
  /** Shown on the confirmation step as who the decision is recorded against. */
  reviewerName?: string;
  /**
   * Render for a narrow column: headings stack instead of sitting opposite
   * their counters, and each stage's action becomes a full-width button. The
   * stage content is unchanged — this only affects how it folds.
   */
  dense?: boolean;
}) {
  const { t, language } = useLanguage();
  const [modalLevel, setModalLevel] = useState<ReviewLevel | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const state: PipelineState = getPipelineState(app);
  const { ledger, currentLevel, clearedCount, droppedAtLevel, finalUnlocked, progressPct } = state;

  const statusApproved = app.status === 'approved' || app.status === 'invested';
  const statusRejected = app.status === 'rejected';

  const finalState: 'locked' | 'current' | 'approved' | 'rejected' =
    statusApproved || ledger.final?.outcome === 'approved' ? 'approved'
    : statusRejected || ledger.final?.outcome === 'rejected' ? 'rejected'
    : finalUnlocked ? 'current'
    : 'locked';

  const stepNumber = Math.min(clearedCount + 1, 4);

  const handleLevelSubmit = async (payload: LevelDecisionPayload) => {
    if (modalLevel === null) return;
    await onLevelDecision(modalLevel, payload);
    setModalLevel(null);
  };

  const handleRejectSubmit = async (comment: string) => {
    await onReject(comment);
    setShowRejectModal(false);
  };

  return (
    <div>
      {modalLevel !== null && (
        <LevelDecisionModal
          level={modalLevel}
          companyName={app.companyName || t.applicationDetail.untitledApplication}
          reviewerName={reviewerName}
          onSubmit={handleLevelSubmit}
          onClose={() => setModalLevel(null)}
          submitting={actionLoading}
        />
      )}
      {showRejectModal && (
        <FinalRejectModal
          companyName={app.companyName || t.applicationDetail.untitledApplication}
          reviewerName={reviewerName}
          onSubmit={handleRejectSubmit}
          onClose={() => setShowRejectModal(false)}
          submitting={actionLoading}
        />
      )}

      {/* ── Header: title + progress ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <div className={cn('flex items-start gap-4 flex-wrap mb-4', !dense && 'justify-between')}>
          <div>
            <h3 className="text-base font-bold text-gray-900">{t.reviewPipeline.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t.reviewPipeline.subtitle}</p>
          </div>
          <div className={cn('flex-shrink-0', !dense && 'text-right')}>
            <p className="text-xs font-bold text-gray-900">
              {droppedAtLevel !== null
                ? t.reviewPipeline.stateNotShortlisted
                : t.reviewPipeline.stepOf.replace('{n}', String(stepNumber))}
            </p>
            <p className="text-[11px] text-gray-500">
              {t.reviewPipeline.complete.replace('{pct}', String(progressPct))}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              droppedAtLevel !== null || finalState === 'rejected' ? 'bg-red-400'
                : finalState === 'approved' ? 'bg-green-500'
                : 'bg-gray-900',
            )}
            style={{ width: `${Math.max(progressPct, 3)}%` }}
          />
        </div>

        {/* Step labels */}
        <div className="flex justify-between mt-2">
          {[
            t.reviewPipeline.level1.split('—')[0].trim(),
            t.reviewPipeline.level2.split('—')[0].trim(),
            t.reviewPipeline.level3.split('—')[0].trim(),
            t.reviewPipeline.finalStage,
          ].map((label, i) => (
            <span
              key={label}
              className={cn(
                'text-[10px] font-medium',
                i < clearedCount ? 'text-emerald-600'
                  : i === clearedCount && droppedAtLevel === null ? 'text-gray-900 font-bold'
                  : 'text-gray-400',
              )}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Terminal banners */}
        {droppedAtLevel !== null && (() => {
          const dropped = getLevelReview(state, droppedAtLevel);
          return (
            <div className="mt-4 flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-800">
                  {t.reviewPipeline.droppedBanner.replace('{n}', String(droppedAtLevel))}
                </p>
                <p className="text-[11px] text-red-600 mt-0.5">
                  {t.reviewPipeline.droppedBannerDesc
                    .replace(/\{n\}/g, String(droppedAtLevel))
                    .replace('{reviewer}', dropped?.reviewer || '—')
                    .replace('{date}', formatDateTime(dropped?.reviewedAt || '', language))}
                </p>
              </div>
            </div>
          );
        })()}

        {finalState === 'approved' && (
          <div className="mt-4 flex items-start gap-2.5 px-3.5 py-3 bg-green-50 border border-green-100 rounded-xl">
            <ShieldCheck size={15} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-green-800">{t.reviewPipeline.approvedBanner}</p>
              <p className="text-[11px] text-green-600 mt-0.5">
                {t.reviewPipeline.approvedBannerDesc
                  .replace('{reviewer}', ledger.final?.reviewer || app.reviewedBy || '—')
                  .replace('{date}', formatDateTime(ledger.final?.decidedAt || app.reviewedAt || '', language))}
              </p>
            </div>
          </div>
        )}

        {finalState === 'rejected' && droppedAtLevel === null && (
          <div className="mt-4 flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-100 rounded-xl">
            <X size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-800">{t.reviewPipeline.rejectedBanner}</p>
              <p className="text-[11px] text-red-600 mt-0.5">
                {t.reviewPipeline.rejectedBannerDesc
                  .replace('{reviewer}', ledger.final?.reviewer || app.reviewedBy || '—')
                  .replace('{date}', formatDateTime(ledger.final?.decidedAt || app.reviewedAt || '', language))}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
            {error}
          </div>
        )}
      </div>

      {/* ── Stepper ── */}
      <div className="space-y-3.5">
        {REVIEW_LEVELS.map(level => (
          <StageCard
            key={level}
            level={level}
            state={getStageState(state, level)}
            review={getLevelReview(state, level)}
            isLast={false}
            language={language}
            t={t}
            onAction={() => setModalLevel(level)}
            actionLoading={actionLoading && currentLevel === level}
            canAct={actableLevel === null ? false : actableLevel === level}
            dense={dense}
          />
        ))}
        <FinalStageCard
          state={finalState}
          ledgerFinal={ledger.final}
          language={language}
          t={t}
          onApprove={onApprove}
          onReject={() => setShowRejectModal(true)}
          actionLoading={actionLoading}
          unlocked={finalUnlocked && canDecideFinal}
          dense={dense}
        />
      </div>
    </div>
  );
}

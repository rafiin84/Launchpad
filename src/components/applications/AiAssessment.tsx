import { useState } from 'react';
import {
  Sparkles, Loader2, AlertCircle, RefreshCw, ChevronDown, Info,
  Users, Globe2, Lightbulb, TrendingUp,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { useLanguage } from '../../context/LanguageContext';
import {
  type AiAssessment as Assessment, type AiDimensionKey, type AiVerdict,
} from '../../services/aiScoring';

/**
 * AI assessment panel.
 *
 * Unscored, this is one slim row with a button — the application itself should
 * still be the first thing on the page. Scored, it opens into the score, the
 * four dimensions and the model's reasoning.
 *
 * Everything here is framed as advisory on purpose. The score is not wired to
 * the pipeline and cannot move an application forward; a reviewer who reads it
 * as a decision is being misled, so the panel says whose judgement it is and
 * when it was made.
 */

const DIMENSION_META: Record<AiDimensionKey, { icon: typeof Users; labelKey: keyof AiLabels }> = {
  team:     { icon: Users,      labelKey: 'team' },
  market:   { icon: Globe2,     labelKey: 'market' },
  product:  { icon: Lightbulb,  labelKey: 'product' },
  traction: { icon: TrendingUp, labelKey: 'traction' },
};

interface AiLabels {
  team: string; market: string; product: string; traction: string;
}

/** Bands, not a gradient: a 61 and a 79 should not look like different things. */
function band(score: number): { bar: string; text: string } {
  if (score >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-700' };
  if (score >= 50) return { bar: 'bg-amber-500',   text: 'text-amber-700' };
  if (score >= 25) return { bar: 'bg-orange-500',  text: 'text-orange-700' };
  return { bar: 'bg-red-500', text: 'text-red-700' };
}

function VerdictPill({ verdict }: { verdict: AiVerdict }) {
  const { t } = useLanguage();
  const cfg: Record<AiVerdict, { cls: string; label: string }> = {
    strong:            { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: t.aiScoring.verdictStrong },
    promising:         { cls: 'bg-amber-50 text-amber-700 ring-amber-200',       label: t.aiScoring.verdictPromising },
    weak:              { cls: 'bg-red-50 text-red-700 ring-red-200',             label: t.aiScoring.verdictWeak },
    insufficient_data: { cls: 'bg-gray-100 text-gray-600 ring-gray-200',         label: t.aiScoring.verdictInsufficient },
  };
  const c = cfg[verdict] ?? cfg.weak;
  return (
    <span className={cn('inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1', c.cls)}>
      {c.label}
    </span>
  );
}

export default function AiAssessmentPanel({
  assessment, running, error, canScore, disabledReason, onScore, scoredByLabel,
}: {
  assessment: Assessment | null;
  running: boolean;
  error?: string;
  /** False when the record has too little in it to be worth assessing. */
  canScore: boolean;
  disabledReason?: string;
  onScore: () => void;
  /** "Scored by X on date" line, pre-formatted by the page. */
  scoredByLabel?: string;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  const labels: AiLabels = {
    team: t.aiScoring.team,
    market: t.aiScoring.market,
    product: t.aiScoring.product,
    traction: t.aiScoring.traction,
  };

  // ── Not yet scored: one row, so it does not push the application down ──
  if (!assessment) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">{t.aiScoring.title}</p>
            <p className="text-[11px] text-gray-500">
              {canScore ? t.aiScoring.pitch : (disabledReason || t.aiScoring.nothingToScore)}
            </p>
          </div>
          <button
            onClick={onScore}
            disabled={running || !canScore}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gray-900 hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {running
              ? <><Loader2 size={13} className="animate-spin" /> {t.aiScoring.analysing}</>
              : <><Sparkles size={13} /> {t.aiScoring.action}</>}
          </button>
        </div>
        {error && (
          <p className="text-[11px] text-red-600 font-medium mt-2.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" /> {error}
          </p>
        )}
      </div>
    );
  }

  const total = band(assessment.total);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header: score + verdict */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3.5 hover:bg-gray-50/60 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
          <Sparkles size={15} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-sm font-bold text-gray-900">{t.aiScoring.title}</p>
            <VerdictPill verdict={assessment.verdict} />
          </div>
          {scoredByLabel && <p className="text-[11px] text-gray-400 mt-0.5">{scoredByLabel}</p>}
        </div>
        <div className="flex items-baseline gap-0.5 flex-shrink-0">
          <span className={cn('text-2xl font-bold tabular-nums', total.text)}>{assessment.total}</span>
          <span className="text-xs font-medium text-gray-400">/100</span>
        </div>
        <ChevronDown
          size={16}
          className={cn('text-gray-300 flex-shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3.5">
          {assessment.summary && (
            <p className="text-xs text-gray-700 leading-relaxed">{assessment.summary}</p>
          )}

          <div className="space-y-3">
            {assessment.dimensions.map(d => {
              const meta = DIMENSION_META[d.key];
              if (!meta) return null;
              const Icon = meta.icon;
              const b = band(d.score);
              return (
                <div key={d.key}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-800">{labels[meta.labelKey]}</span>
                    <span className={cn('text-xs font-bold tabular-nums ml-auto', b.text)}>{d.score}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', b.bar)}
                      style={{ width: `${Math.max(d.score, 1.5)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{d.reasoning}</p>
                </div>
              );
            })}
          </div>

          {error && (
            <p className="text-[11px] text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" /> {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <p className="text-[10px] text-gray-400 inline-flex items-start gap-1 max-w-md leading-relaxed">
              <Info size={10} className="flex-shrink-0 mt-0.5" /> {t.aiScoring.disclaimer}
            </p>
            <button
              onClick={onScore}
              disabled={running || !canScore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-40 flex-shrink-0"
            >
              {running
                ? <><Loader2 size={11} className="animate-spin" /> {t.aiScoring.analysing}</>
                : <><RefreshCw size={11} /> {t.aiScoring.rescore}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

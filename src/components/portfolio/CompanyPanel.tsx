import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, ExternalLink, Pencil, StickyNote, CalendarClock, Loader2, AlertCircle,
  TrendingUp, Flag, Handshake, FileBarChart, Coins, LogOut, CircleDot,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import {
  createTimelineEvent, fetchTimeline, type PortfolioEntry, type TimelineEvent,
} from '../../services/crmPortfolioManagement';
import { getCRMPortfolioRecord } from '../../services/crmPortfolio';
import { fetchFinancials, findCompanyRecordIdForEmail, type FinancialEntry } from '../../services/companyFinancials';
import type { HealthResult } from '../../lib/portfolioHealth';
import { formatDate, formatMoney, formatNumber, formatPercent } from '../../lib/portfolioFormat';
import { cn } from '../../lib/cn';
import { HealthBadge, HealthExplanation } from './portfolioUi';
import type { PMText } from './portfolioText';

const EVENT_ICONS: Record<string, typeof Flag> = {
  'Initial Investment': Coins, 'Follow-on Investment': Coins, 'Valuation Update': TrendingUp,
  'Finance Report': FileBarChart, Milestone: Flag, Meeting: Handshake, Exit: LogOut,
  Note: StickyNote, 'Follow-up': CalendarClock, Other: CircleDot,
};

interface RevenuePoint { label: string; revenue: number; verified: boolean }

/** Latest quarters of revenue from the company's finance reports, preferring reviewer-verified figures. */
function revenuePoints(entries: FinancialEntry[]): RevenuePoint[] {
  const byQuarter = new Map<string, FinancialEntry>();
  for (const e of entries) {
    if (e.revenue === undefined) continue;
    const key = `${e.year}-${e.quarter}`;
    const existing = byQuarter.get(key);
    // A reviewer's figure replaces a founder's self-reported one for the same quarter.
    if (!existing || (e.source ?? 'reviewer') === 'reviewer') byQuarter.set(key, e);
  }
  return [...byQuarter.values()]
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter)
    .slice(-6)
    .map(e => ({ label: `Q${e.quarter} ${String(e.year).slice(2)}`, revenue: e.revenue ?? 0, verified: (e.source ?? 'reviewer') === 'reviewer' }));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

export default function CompanyPanel({
  entry, health, language, t, onClose, onEdit, onOpenCompany,
}: {
  entry: PortfolioEntry;
  health: HealthResult;
  language: string;
  t: PMText;
  onClose: () => void;
  onEdit: () => void;
  onOpenCompany: () => void;
}) {
  const locale = language === 'ja' ? 'ja-JP' : 'en-US';

  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [timelineError, setTimelineError] = useState(false);
  const [trend, setTrend] = useState<RevenuePoint[]>([]);
  const [composer, setComposer] = useState<null | 'note' | 'followup'>(null);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const loadTimeline = useCallback(
    () => fetchTimeline(entry.id)
      .then(ev => { setEvents(ev); setTimelineError(false); })
      .catch(() => { setEvents([]); setTimelineError(true); }),
    [entry.id],
  );

  // The page mounts this panel with key={entry.id}, so switching companies starts
  // from clean state — nothing here needs to reset itself.
  useEffect(() => { void loadTimeline(); }, [loadTimeline]);

  // Revenue trend comes from the company's own finance reports (Founder_Companies),
  // found through the founder's email on the Companies record. Silent when absent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!entry.companyId) return;
        const company = await getCRMPortfolioRecord(entry.companyId);
        if (!company?.founderEmail) return;
        const financeId = await findCompanyRecordIdForEmail(company.founderEmail);
        if (!financeId) return;
        const points = revenuePoints(await fetchFinancials(financeId));
        if (!cancelled) setTrend(points);
      } catch { /* no trend available */ }
    })();
    return () => { cancelled = true; };
  }, [entry.companyId]);

  const hasPerformance = [entry.latestRevenue, entry.revenueGrowthPct, entry.monthlyBurn, entry.runwayMonths, entry.headcount, entry.openRoles]
    .some(v => v !== null);
  const maxRevenue = useMemo(() => Math.max(1, ...trend.map(p => p.revenue)), [trend]);

  function openComposer(kind: 'note' | 'followup') {
    setComposer(kind); setText(''); setDue(''); setNotice(null);
  }

  async function submitComposer(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !composer) return;
    if (composer === 'followup' && !due) return;
    setSaving(true); setNotice(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const firstLine = body.split('\n')[0].slice(0, 120);
      await createTimelineEvent(composer === 'note'
        ? { entryId: entry.id, type: 'Note', title: firstLine, date: today, details: body }
        : { entryId: entry.id, type: 'Follow-up', title: firstLine, date: due, details: body });
      setNotice({ ok: true, message: composer === 'note' ? t.noteSaved : t.followUpSaved });
      setComposer(null); setText(''); setDue('');
      await loadTimeline();
    } catch {
      setNotice({ ok: false, message: t.actionFailed });
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[28rem] bg-white border-l border-gray-100 shadow-2xl flex flex-col" aria-label={entry.companyName}>
      <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-gray-900 truncate">{entry.companyName}</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {[entry.sector, entry.currentStage, entry.geography].filter(Boolean).join(' · ') || '—'}
          </p>
          <div className="mt-2"><HealthBadge status={health.status} t={t} /></div>
        </div>
        <button onClick={onClose} aria-label={t.close} className="text-gray-400 hover:text-gray-700 p-1"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onOpenCompany} disabled={!entry.companyId}>
            <ExternalLink size={13} className="mr-1.5" /> {t.openCompany}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil size={13} className="mr-1.5" /> {t.editDetails}</Button>
        </div>

        <section>
          <HealthExplanation result={health} healthAsOf={entry.healthAsOf} language={language} t={t} />
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{t.performanceTitle}</h3>
          {hasPerformance ? (
            <>
              <p className="text-[11px] text-gray-400 mb-3">
                {[
                  entry.reportingPeriod && `${t.reportingPeriod}: ${entry.reportingPeriod}`,
                  entry.metricsAsOf && t.metricsAsOf.replace('{date}', formatDate(entry.metricsAsOf, locale)),
                ].filter(Boolean).join(' · ') || t.notReported}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Metric label={t.metricRevenue} value={formatMoney(entry.latestRevenue)} />
                <Metric label={t.metricRevenueGrowth} value={formatPercent(entry.revenueGrowthPct)} />
                <Metric label={t.metricBurn} value={formatMoney(entry.monthlyBurn)} />
                <Metric label={t.metricRunway} value={entry.runwayMonths === null ? '—' : t.months.replace('{n}', formatNumber(entry.runwayMonths, 1))} />
                <Metric label={t.metricHeadcount} value={formatNumber(entry.headcount)} />
                <Metric label={t.metricOpenRoles} value={formatNumber(entry.openRoles)} />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">{t.noPerformance}</p>
          )}

          {trend.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-700">{t.revenueTrend}</p>
              <p className="text-[11px] text-gray-400 mb-2">{t.revenueTrendNote}</p>
              <div className="flex items-end gap-2 h-24" role="img" aria-label={trend.map(p => `${p.label} ${formatMoney(p.revenue)}`).join(', ')}>
                {trend.map(p => (
                  <div key={p.label} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                    <div className={cn('w-full rounded-t', p.verified ? 'bg-indigo-500' : 'bg-indigo-200')}
                      style={{ height: `${Math.max(4, (p.revenue / maxRevenue) * 100)}%` }} title={`${p.label}: ${formatMoney(p.revenue)}`} />
                    <span className="text-[10px] text-gray-400 mt-1 truncate">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">{t.timelineTitle}</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openComposer('note')}><StickyNote size={13} className="mr-1.5" />{t.addNote}</Button>
              <Button variant="outline" size="sm" onClick={() => openComposer('followup')}><CalendarClock size={13} className="mr-1.5" />{t.createFollowUp}</Button>
            </div>
          </div>

          {notice && (
            <div className={cn('flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-3', notice.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
              {!notice.ok && <AlertCircle size={13} />}{notice.message}
            </div>
          )}

          {composer && (
            <form onSubmit={submitComposer} className="mb-4 space-y-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
              <Textarea
                label={composer === 'note' ? t.noteTitle : t.followUpWhat}
                placeholder={composer === 'note' ? t.notePlaceholder : undefined}
                value={text} onChange={e => setText(e.target.value)} rows={3} required autoFocus />
              {composer === 'followup' && (
                <Input label={`${t.followUpDue} *`} type="date" value={due} onChange={e => setDue(e.target.value)} required />
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setComposer(null)} disabled={saving}>{t.cancel}</Button>
                <Button type="submit" variant="primary" size="sm" disabled={saving || !text.trim() || (composer === 'followup' && !due)}>
                  {saving ? t.saving : t.save}
                </Button>
              </div>
            </form>
          )}

          {events === null ? (
            <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {t.loading}</p>
          ) : timelineError ? (
            <p className="text-sm text-red-600 flex items-center gap-2"><AlertCircle size={14} /> {t.timelineFailed}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-500">{t.timelineEmpty}</p>
          ) : (
            <ol className="space-y-3">
              {events.map(ev => {
                const Icon = EVENT_ICONS[ev.type] ?? CircleDot;
                return (
                  <li key={ev.id} className="flex gap-3">
                    <span className="w-7 h-7 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={13} className="text-gray-500" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 break-words">{ev.title}</p>
                      <p className="text-[11px] text-gray-400">
                        {ev.type} · {ev.type === 'Follow-up' ? t.dueOn.replace('{date}', formatDate(ev.date, locale)) : formatDate(ev.date, locale)}
                        {ev.amount !== null && ` · ${formatMoney(ev.amount)}`}
                      </p>
                      {ev.details && ev.details !== ev.title && <p className="text-xs text-gray-600 mt-1 whitespace-pre-line break-words">{ev.details}</p>}
                      {ev.link && /^https?:\/\//i.test(ev.link) && (
                        <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline break-all">{ev.link}</a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </aside>
  );
}

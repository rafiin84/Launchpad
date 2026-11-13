import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, MessageSquare, Phone, Plus, StickyNote, Users, CircleDot, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { ModalFrame } from '../portfolio/portfolioUi';
import { fetchSharedActivities } from '../../services/sharedActivities';
import { addTimelineEvent, fetchPortfolioEntries, type PortfolioEntry } from '../../services/crmPortfolioManagement';
import { INTERACTION_TYPES, TimelineFullError } from '../../lib/portfolioTimeline';
import { formatDate } from '../../lib/portfolioFormat';
import { cn } from '../../lib/cn';
import type { TranslationKeys } from '../../i18n';

type T = TranslationKeys['companyDetail'];

interface Item { id: string; kind: 'post' | 'log'; tag: string; title: string; text: string; who: string; date: string }

const ICONS: Record<string, typeof Phone> = { Call: Phone, Meeting: Users, Note: StickyNote, 'Follow-up': CalendarClock };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Calls, meetings, updates and interactions for one company — read live from CRM:
 * the interactions logged on its Portfolio Management timeline, and the feed
 * posts that name it. New interactions are logged onto the timeline.
 */
export default function ActivitiesTab({ companyId, companyName, locale, t }: { companyId: string; companyName: string; locale: string; t: T }) {
  const [entry, setEntry] = useState<PortfolioEntry | null>(null);
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof fetchSharedActivities>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [type, setType] = useState<string>(INTERACTION_TYPES[0]);
  const [date, setDate] = useState('');
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [entries, feed] = await Promise.all([fetchPortfolioEntries().catch(() => [] as PortfolioEntry[]), fetchSharedActivities().catch(() => [])]);
      setEntry(entries.find(e => e.companyId === companyId) ?? null);
      setPosts(feed.filter(a => same(a.companyName, companyName)));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [companyId, companyName, t.loadFailed]);

  useEffect(() => { void load(); }, [load]);

  const items = useMemo<Item[]>(() => {
    const logs: Item[] = (entry?.timeline ?? []).filter(e => e.type !== 'Milestone')
      .map(e => ({ id: e.id, kind: 'log', tag: e.type, title: e.title, text: e.details !== e.title ? e.details : '', who: '', date: e.date }));
    const feed: Item[] = posts.map(a => ({ id: a.id, kind: 'post', tag: a.activityType, title: a.title, text: a.content, who: a.authorName, date: a.createdTime }));
    return [...logs, ...feed].sort((a, b) => b.date.localeCompare(a.date));
  }, [entry, posts]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!entry || !text.trim() || !date) return;
    setSaving(true); setFormError('');
    try {
      await addTimelineEvent(entry.id, { type, title: text.trim().split('\n')[0].slice(0, 120), date, details: text.trim() });
      setOpen(false); setText(''); setNotice(t.actSaved);
      await load();
    } catch (err) {
      setFormError(err instanceof TimelineFullError ? t.actFailed : err instanceof Error && err.message ? err.message : t.actFailed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-32 bg-white border border-gray-100 rounded-3xl animate-pulse" aria-busy="true" aria-label={t.loading} />;
  if (error) {
    return (
      <div role="alert" className="bg-red-50 border border-red-100 rounded-3xl p-6 text-center">
        <AlertCircle size={20} className="text-red-300 mx-auto mb-2" />
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-red-500 bg-red-100 px-3 py-1.5 rounded-lg"><RefreshCw size={12} /> {t.retry}</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-400">{t.actNote}</p>
        {entry
          ? <Button variant="primary" size="sm" onClick={() => { setDate(new Date().toISOString().slice(0, 10)); setFormError(''); setOpen(true); }}><Plus size={13} className="mr-1.5" />{t.actLog}</Button>
          : <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">{t.actNeedEntry}</p>}
      </div>
      {notice && <p role="status" className="text-xs text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">{notice}</p>}

      {items.length === 0 ? (
        <div className="text-center py-14 bg-white border border-gray-100 rounded-3xl">
          <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-300 inline-flex items-center justify-center mb-3"><MessageSquare size={22} /></span>
          <p className="text-sm text-gray-500">{t.actEmpty}</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {items.map(it => {
            const Icon = ICONS[it.tag] ?? (it.kind === 'post' ? MessageSquare : CircleDot);
            return (
              <li key={`${it.kind}-${it.id}`} className="flex gap-3 bg-white border border-gray-100 rounded-3xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <span className={cn('w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0', it.kind === 'post' ? 'bg-sky-50 text-sky-400' : 'bg-indigo-50 text-indigo-400')}><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="text-sm font-semibold text-gray-900 break-words">{it.title}</p>
                    <span className="text-[11px] text-gray-400">{it.tag} · {it.kind === 'post' ? t.actFromFeed : t.actFromLog}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">{formatDate(it.date, locale)}{it.who ? ` · ${it.who}` : ''}</p>
                  {it.text && <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line break-words line-clamp-6">{it.text}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {open && (
        <ModalFrame title={t.actLog} onClose={() => { if (!saving) setOpen(false); }}
          footer={<>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t.cancel}</Button>
            <Button type="submit" form="act-form" variant="primary" disabled={saving || !text.trim() || !date}>{saving ? t.saving : t.save}</Button>
          </>}>
          <form id="act-form" onSubmit={save} className="space-y-4">
            {formError && <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Select label={`${t.actType} *`} value={type} onChange={e => setType(e.target.value)} options={INTERACTION_TYPES.map(v => ({ value: v, label: v }))} />
              <Input label={`${t.actDate} *`} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <Textarea label={`${t.actNotes} *`} value={text} onChange={e => setText(e.target.value)} rows={4} autoFocus />
          </form>
        </ModalFrame>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, MessageSquare, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { ModalFrame } from '../portfolio/portfolioUi';
import { fetchSharedActivities, postSharedActivity } from '../../services/sharedActivities';
import type { CRMActivity } from '../../services/crmActivities';
import { fetchFieldPicklists, type PicklistOption } from '../../services/zohoApi';
import { formatDate } from '../../lib/portfolioFormat';
import type { TranslationKeys } from '../../i18n';

type T = TranslationKeys['companyDetail'];
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The founder's side of the Activities tab. An update posted here goes through
 * the same path as the feed (the portal-writable Feed_Submissions module, which
 * Zoho's relay copies into My_Activities), tagged with the founder's company —
 * so it appears on the investor's Activities tab for that company, and in the
 * shared feed. The founder sees their company's activity: their own posts and
 * anything an investor posted about the company.
 */
export default function FounderActivitiesTab({ companyName, authorName, locale, t }: { companyName: string; authorName: string; locale: string; t: T }) {
  const [items, setItems] = useState<CRMActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [picklists, setPicklists] = useState<Record<string, PicklistOption[]> | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const all = await fetchSharedActivities();
      setItems(all.filter(a => (companyName && same(a.companyName, companyName)) || (a.authorRole === 'founder' && authorName && same(a.authorName, authorName)))
        .filter(a => a.activityType !== 'poll_vote' && a.activityType !== 'notification'));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [companyName, authorName, t.loadFailed]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void fetchFieldPicklists('My_Activities', true).then(setPicklists); }, []);

  const sorted = useMemo(() => [...items].sort((a, b) => b.createdTime.localeCompare(a.createdTime)), [items]);

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
        <p className="text-xs text-gray-400">{t.actFounderNote}</p>
        {companyName
          ? <Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus size={13} className="mr-1.5" />{t.actPost}</Button>
          : <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">{t.founderNeedProfile}</p>}
      </div>
      {notice && <p role="status" className="text-xs text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">{notice}</p>}

      {sorted.length === 0 ? (
        <div className="text-center py-14 bg-white border border-gray-100 rounded-3xl">
          <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-300 inline-flex items-center justify-center mb-3"><MessageSquare size={22} /></span>
          <p className="text-sm text-gray-500">{t.actEmpty}</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {sorted.map(a => (
            <li key={a.id} className="flex gap-3 bg-white border border-gray-100 rounded-3xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <span className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-400 flex items-center justify-center flex-shrink-0"><MessageSquare size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <p className="text-sm font-semibold text-gray-900 break-words">{a.title}</p>
                  <span className="text-[11px] text-gray-400">{a.activityType}</span>
                </div>
                <p className="text-[11px] text-gray-400">{formatDate(a.createdTime, locale)}{a.authorName ? ` · ${a.authorName}` : ''}</p>
                {a.content && <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line break-words line-clamp-6">{a.content}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {open && (
        <PostModal companyName={companyName} authorName={authorName} picklists={picklists} t={t} onClose={() => setOpen(false)}
          onPosted={a => { setOpen(false); setItems(prev => [a, ...prev]); setNotice(t.actPosted); void load(); }} />
      )}
    </div>
  );
}

function PostModal({ companyName, authorName, picklists, t, onClose, onPosted }: {
  companyName: string; authorName: string; picklists: Record<string, PicklistOption[]> | null; t: T; onClose: () => void; onPosted: (a: CRMActivity) => void;
}) {
  // Types come from the CRM picklist; if it can't be read, a plain update still works.
  const types = (picklists?.['Activity_Type'] ?? [{ actual: 'update', display: 'Update' }]);
  const [type, setType] = useState(types.find(o => o.actual === 'update')?.actual ?? types[0]?.actual ?? 'update');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true); setError('');
    try {
      const posted = await postSharedActivity({
        title: title.trim(), activityType: type, content: content.trim(), companyName, authorName, authorRole: 'founder', tags: '',
        imageUrl: '', imageData: '', postType: '', videoUrl: '', linkUrl: '', locationName: '', locationCoords: '', pollData: '',
        activityFileName: '', fileRef: '', visibility: 'public',
      });
      if (!posted.synced) { setError((posted as { error?: string }).error || t.actPostFailed); setSaving(false); return; }
      onPosted(posted);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.actPostFailed);
      setSaving(false);
    }
  }

  return (
    <ModalFrame title={t.actPost} onClose={() => { if (!saving) onClose(); }}
      footer={<>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
        <Button type="submit" form="fa-form" variant="primary" disabled={saving || !title.trim() || !content.trim()}>{saving ? t.saving : t.actPostAction}</Button>
      </>}>
      <form id="fa-form" onSubmit={submit} className="space-y-4">
        {error && <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 break-words">{error}</div>}
        <Select label={t.actTypeLabel} value={type} onChange={e => setType(e.target.value)} options={types.map(o => ({ value: o.actual, label: o.display }))} />
        <Input label={`${t.actTitleLabel} *`} value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        <Textarea label={`${t.actContentLabel} *`} value={content} onChange={e => setContent(e.target.value)} rows={4} />
      </form>
    </ModalFrame>
  );
}

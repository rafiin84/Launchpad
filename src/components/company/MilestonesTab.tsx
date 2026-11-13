import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, AlertTriangle, Pencil, Plus, Trash2, Flag } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { ModalFrame } from '../portfolio/portfolioUi';
import { Pill } from '../reports/reportUi';
import { getCRMPortfolioRecord, saveMilestones } from '../../services/crmPortfolio';
import { isPermissionError } from '../../services/crmInvestments';
import {
  MilestonesFullError, buildMilestone, completionPct, milestoneStatus, parseMilestones, sortMilestones, stringifyMilestones,
  type Milestone, type MilestoneInput,
} from '../../lib/milestones';
import { formatDate } from '../../lib/portfolioFormat';
import { cn } from '../../lib/cn';
import type { TranslationKeys } from '../../i18n';

type T = TranslationKeys['companyDetail'];
const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * A company's achievements and upcoming milestones, stored on its Companies
 * record. Completion status comes from the dates (lib/milestones.ts), never from
 * a stored flag. Every change re-reads the stored list first, so two people
 * editing don't overwrite each other's milestones.
 */
export default function MilestonesTab({ companyId, initialJson, founderOutlook, locale, t }: {
  companyId: string; initialJson: string; founderOutlook: string; locale: string; t: T;
}) {
  const [json, setJson] = useState(initialJson);
  const [editing, setEditing] = useState<null | { id?: string; input: MilestoneInput }>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = todayISO();

  const list = useMemo(() => sortMilestones(parseMilestones(json), today), [json, today]);
  const pct = completionPct(list);
  const done = list.filter(m => m.completedDate).length;

  /** Re-read the stored list, apply `change`, write it back. */
  async function mutate(change: (current: Milestone[]) => Milestone[]) {
    setSaving(true); setError('');
    try {
      const fresh = await getCRMPortfolioRecord(companyId);
      const next = stringifyMilestones(change(parseMilestones(fresh?.milestones ?? json)));
      await saveMilestones(companyId, next);
      setJson(next); setEditing(null);
    } catch (err) {
      setError(err instanceof MilestonesFullError ? t.msFull : isPermissionError(err) ? t.msNoPermission : err instanceof Error && err.message ? err.message : t.msFailed);
    } finally {
      setSaving(false);
    }
  }

  const toggle = (m: Milestone) => mutate(cur => cur.map(x => (x.id === m.id ? { ...x, completedDate: x.completedDate ? '' : todayISO() } : x)));
  const remove = (m: Milestone) => mutate(cur => cur.filter(x => x.id !== m.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[12rem] max-w-sm">
          {pct !== null && (
            <>
              <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
                <span>{t.msProgress.replace('{done}', String(done)).replace('{total}', String(list.length))}</span><span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-200" style={{ width: `${pct}%` }} /></div>
            </>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={() => { setError(''); setEditing({ input: { title: '', description: '', targetDate: '', completedDate: '' } }); }}>
          <Plus size={13} className="mr-1.5" />{t.msAdd}
        </Button>
      </div>
      {error && !editing && <div role="alert" className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}

      {list.length === 0 ? (
        <div className="text-center py-14 bg-white border border-gray-100 rounded-3xl">
          <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-300 inline-flex items-center justify-center mb-3"><Flag size={22} /></span>
          <p className="text-sm text-gray-500">{t.msEmpty}</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {list.map(m => {
            const status = milestoneStatus(m, today);
            const Icon = status === 'completed' ? CheckCircle2 : status === 'overdue' ? AlertTriangle : Circle;
            return (
              <li key={m.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-3xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <button onClick={() => void toggle(m)} disabled={saving} aria-label={status === 'completed' ? t.msReopen : t.msMarkDone}
                  title={status === 'completed' ? t.msReopen : t.msMarkDone}
                  className={cn('mt-0.5 flex-shrink-0 transition-colors', status === 'completed' ? 'text-emerald-300 hover:text-emerald-400' : status === 'overdue' ? 'text-rose-300 hover:text-emerald-300' : 'text-gray-300 hover:text-emerald-300')}>
                  <Icon size={22} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn('text-sm font-semibold break-words', status === 'completed' ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900')}>{m.title}</p>
                    <Pill tone={status === 'completed' ? 'emerald' : status === 'overdue' ? 'rose' : 'indigo'}>
                      {status === 'completed' ? t.msStatusCompleted : status === 'overdue' ? t.msStatusOverdue : t.msStatusUpcoming}
                    </Pill>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {m.targetDate ? `${t.msTarget}: ${formatDate(m.targetDate, locale)}` : t.msNoTarget}
                    {m.completedDate && ` · ${t.msCompletedOn}: ${formatDate(m.completedDate, locale)}`}
                  </p>
                  {m.description && <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line break-words">{m.description}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setError(''); setEditing({ id: m.id, input: { title: m.title, description: m.description, targetDate: m.targetDate, completedDate: m.completedDate } }); }}
                    aria-label={t.msEdit} title={t.msEdit} className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50"><Pencil size={14} /></button>
                  <button onClick={() => void remove(m)} disabled={saving} aria-label={t.msDelete} title={t.msDelete}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {founderOutlook.trim() && (
        <section className="bg-white border border-gray-100 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.msFounderOutlook}</h3>
            <Pill tone="indigo">{t.reportedByFounder}</Pill>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-line">{founderOutlook}</p>
        </section>
      )}

      {editing && (
        <MilestoneForm editing={editing} saving={saving} error={error} t={t} onClose={() => { if (!saving) setEditing(null); }}
          onSave={input => void mutate(cur => editing.id
            ? cur.map(x => (x.id === editing.id ? { ...x, title: input.title.trim(), description: input.description.trim(), targetDate: input.targetDate, completedDate: input.completedDate } : x))
            : [...cur, buildMilestone(input)])} />
      )}
    </div>
  );
}

function MilestoneForm({ editing, saving, error, t, onSave, onClose }: {
  editing: { id?: string; input: MilestoneInput }; saving: boolean; error: string; t: T; onSave: (i: MilestoneInput) => void; onClose: () => void;
}) {
  const [v, setV] = useState<MilestoneInput>(editing.input);
  const [titleError, setTitleError] = useState('');
  return (
    <ModalFrame title={editing.id ? t.msEdit : t.msAdd} onClose={onClose}
      footer={<>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
        <Button type="submit" form="ms-form" variant="primary" disabled={saving}>{saving ? t.saving : t.save}</Button>
      </>}>
      <form id="ms-form" noValidate className="space-y-4" onSubmit={e => { e.preventDefault(); if (!v.title.trim()) { setTitleError(t.msTitleRequired); return; } onSave(v); }}>
        {error && <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
        <Input label={`${t.msTitleLabel} *`} value={v.title} onChange={e => { setV({ ...v, title: e.target.value }); setTitleError(''); }} error={titleError} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t.msTarget} type="date" value={v.targetDate} onChange={e => setV({ ...v, targetDate: e.target.value })} />
          <Input label={t.msCompletedOn} type="date" value={v.completedDate} onChange={e => setV({ ...v, completedDate: e.target.value })} />
        </div>
        <Textarea label={t.msDescription} value={v.description} onChange={e => setV({ ...v, description: e.target.value })} rows={3} />
      </form>
    </ModalFrame>
  );
}

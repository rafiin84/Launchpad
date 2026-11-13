import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, Pencil, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select, Textarea } from '../ui/Input';
import { ModalFrame } from '../portfolio/portfolioUi';
import { Card, Kpi, Pill, Table } from '../reports/reportUi';
import { fetchFieldPicklists, type PicklistOption } from '../../services/zohoApi';
import {
  FINANCE_MODULE, REVIEW_STATUSES, fetchReportsForFounder, fetchReportsForInvestor, reviewReport, saveFounderReport,
} from '../../services/crmFinanceReports';
import { isPermissionError } from '../../services/crmInvestments';
import {
  FREQUENCY_MONTHS, METRICS, STATUS, compareReports, groupByPeriod, isFrequency, latestPerPeriod, periodKey, periodLabel,
  reportingStatus, type FinanceReport, type Frequency, type MetricDef, type PeriodStatus,
} from '../../lib/financeReports';
import { formatAmount } from '../../lib/investmentCalc';
import { formatDate } from '../../lib/portfolioFormat';
import { cn } from '../../lib/cn';
import { AreaLines, CountLines, GroupedBars, type SeriesRow } from './FinanceCharts';
import FinanceSubmitModal, { type SubmitValues } from './FinanceSubmitModal';
import { formatMetric, metricLabel, type FinText } from './financeText';

const today = () => new Date().toISOString().slice(0, 10);
const STATUS_TONE: Record<string, 'emerald' | 'rose' | 'gray' | 'indigo' | 'amber' | 'sky'> = {
  [STATUS.approved]: 'emerald', [STATUS.needsChanges]: 'rose', [STATUS.underReview]: 'sky',
  [STATUS.submitted]: 'indigo', [STATUS.draft]: 'gray',
};

interface Props {
  /** investor: reads (and reviews) one company's reports. founder: reads and submits their own. */
  mode: 'investor' | 'founder';
  /** The company's Founder_Companies record id. undefined = still resolving, null = none exists. */
  founderCompanyId: string | null | undefined;
  companyName: string;
  /** The signed-in person — the submitter (founder) or the reviewer (investor). */
  user: { name: string; email: string };
  t: FinText;
  locale: string;
}

export default function FinanceReportsPanel({ mode, founderCompanyId, companyName, user, t, locale }: Props) {
  const [reports, setReports] = useState<FinanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picklists, setPicklists] = useState<Record<string, PicklistOption[]> | null>(null);
  const [freq, setFreq] = useState<Frequency | ''>('');
  const [openKey, setOpenKey] = useState('');
  const [form, setForm] = useState<null | { frequency: Frequency; year: number; number: number }>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [review, setReview] = useState<null | FinanceReport>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [cmpA, setCmpA] = useState('');
  const [cmpB, setCmpB] = useState('');

  const load = useCallback(async () => {
    if (mode === 'investor' && !founderCompanyId) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      setReports(mode === 'founder' ? await fetchReportsForFounder() : await fetchReportsForInvestor(founderCompanyId as string));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [mode, founderCompanyId, t.loadFailed]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void fetchFieldPicklists(FINANCE_MODULE, mode === 'founder').then(setPicklists); }, [mode]);

  // Options come from the CRM picklists; if the metadata can't be read, from the data itself.
  const frequencies = useMemo<Frequency[]>(() => {
    const fromCrm = picklists?.['Frequency']?.map(o => o.actual).filter(isFrequency);
    return fromCrm && fromCrm.length ? fromCrm : (Object.keys(FREQUENCY_MONTHS) as Frequency[]);
  }, [picklists]);
  const currencies = useMemo(() => {
    const fromCrm = picklists?.['Report_Currency']?.map(o => o.actual);
    return fromCrm && fromCrm.length ? fromCrm : [...new Set(reports.map(r => r.currency).filter(Boolean))];
  }, [picklists, reports]);
  const statusLabel = useCallback((actual: string) => picklists?.['Review_Status']?.find(o => o.actual === actual)?.display ?? actual, [picklists]);
  const reviewChoices = useMemo(() => {
    const fromCrm = picklists?.['Review_Status']?.map(o => o.actual).filter(a => (REVIEW_STATUSES as readonly string[]).includes(a));
    return fromCrm && fromCrm.length ? fromCrm : [...REVIEW_STATUSES];
  }, [picklists]);

  const activeFreq: Frequency | '' = freq || (isFrequency(reports[0]?.frequency ?? '') ? (reports[0].frequency as Frequency) : (frequencies.includes('Quarterly') ? 'Quarterly' : frequencies[0] ?? ''));
  const sentOnly = useMemo(() => reports.filter(r => r.status !== STATUS.draft), [reports]);
  const series = useMemo(() => latestPerPeriod(sentOnly.filter(r => r.frequency === activeFreq)), [sentOnly, activeFreq]);
  const byPeriod = useMemo(() => groupByPeriod(reports.filter(r => r.frequency === activeFreq)), [reports, activeFreq]);
  const statusRows = useMemo(() => (activeFreq ? reportingStatus(activeFreq, reports, today(), 8) : []), [reports, activeFreq]);
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];

  const label = (r: { frequency: string; year: number; number: number }) => periodLabel(r.frequency as Frequency, r.year, r.number, locale);
  const money = (n: number) => formatAmount(n, latest?.currency ?? '', locale);
  const chartData = useMemo<SeriesRow[]>(() => series.slice(-12).map(r => ({
    label: periodLabel(r.frequency as Frequency, r.year, r.number, locale),
    revenue: r.revenue, expenses: r.expenses, netProfit: r.netProfit, cash: r.cash, burn: r.burn, customers: r.customers, employees: r.employees,
  })), [series, locale]);

  const a = series.find(r => periodKey(r) === cmpA) ?? previous;
  const b = series.find(r => periodKey(r) === cmpB) ?? latest;
  const deltas = useMemo(() => (a && b ? compareReports(a, b) : []), [a, b]);

  const failText = (err: unknown, fallback: string, perm: string) =>
    isPermissionError(err) ? perm : err instanceof Error && err.message ? err.message : fallback;

  async function save(values: SubmitValues, asDraft: boolean) {
    if (!founderCompanyId) return;
    setSaving(true); setFormError('');
    try {
      await saveFounderReport({
        founderCompanyId, companyName, frequency: values.frequency, year: values.year, number: values.number,
        currency: values.currency, metrics: values.metrics, founderNotes: values.notes, submitter: user, asDraft, existing: reports,
      });
      setForm(null); setFreq(values.frequency);
      setNotice({ ok: true, message: asDraft ? t.savedDraft : t.submitted });
      await load();
    } catch (err) {
      setFormError(failText(err, t.saveFailed, t.noPermission));
    } finally {
      setSaving(false);
    }
  }

  async function saveReview(r: FinanceReport, status: string, notes: string) {
    setSaving(true); setFormError('');
    try {
      await reviewReport(r.id, status, notes, user.name);
      setReview(null);
      setNotice({ ok: true, message: t.reviewSaved });
      await load();
    } catch (err) {
      setFormError(failText(err, t.reviewFailed, t.reviewNoPermission));
    } finally {
      setSaving(false);
    }
  }

  if (mode === 'founder' && founderCompanyId === null) {
    return <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">{t.founderNoProfile}</p>;
  }
  if (founderCompanyId === undefined) {
    return <div className="h-40 bg-white border border-gray-100 rounded-3xl animate-pulse" aria-busy="true" aria-label={t.loading} />;
  }
  if (founderCompanyId === null) {
    return <p className="text-sm text-gray-500 bg-white border border-gray-100 rounded-2xl px-4 py-3">{t.noCompany}</p>;
  }
  if (loading) {
    return <div className="space-y-3" aria-busy="true" aria-label={t.loading}>{[0, 1, 2].map(i => <div key={i} className="h-28 bg-white border border-gray-100 rounded-3xl animate-pulse" />)}</div>;
  }
  if (error) {
    return (
      <div role="alert" className="bg-red-50 border border-red-100 rounded-3xl p-6 text-center">
        <AlertCircle size={20} className="text-red-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-red-600">{t.loadFailed}</p>
        <p className="text-xs text-red-400 mt-1 break-words">{error}</p>
        <button onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-red-500 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg"><RefreshCw size={12} /> {t.retry}</button>
      </div>
    );
  }

  const openForm = (f: Frequency, year: number, number: number) => { setFormError(''); setForm({ frequency: f, year, number }); };
  const pill = (status: string) => <Pill tone={STATUS_TONE[status] ?? 'gray'}>{statusLabel(status)}</Pill>;
  const stateCell = (s: PeriodStatus) => {
    if (s.state === 'submitted' && s.report) return pill(s.report.status);
    if (s.state === 'draft') return <Pill tone="gray">{t.stateDraft}</Pill>;
    return <Pill tone={s.state === 'overdue' ? 'rose' : 'gray'}>{s.state === 'overdue' ? t.stateOverdue : t.stateInProgress}</Pill>;
  };
  const kpiDefs: MetricDef[] = METRICS.filter(m => ['revenue', 'netProfit', 'cash', 'burn', 'runway', 'customers', 'employees'].includes(m.key));
  const delta = (def: MetricDef) => {
    if (!latest || !previous || def.kind === 'percent') return undefined;
    const d = compareReports(previous, latest).find(x => x.key === def.key);
    return d?.pct == null ? undefined : `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(0)}% ${t.vsPrevious.replace('{period}', label(previous))}`;
  };
  const metricCols = METRICS.filter(m => ['revenue', 'expenses', 'netProfit', 'cash'].includes(m.key));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-gray-100/80 rounded-2xl overflow-x-auto max-w-full" role="tablist">
          {frequencies.map(f => (
            <button key={f} role="tab" aria-selected={activeFreq === f} onClick={() => setFreq(f)}
              className={cn('px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all', activeFreq === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>{f}</button>
          ))}
        </div>
        {mode === 'founder' && activeFreq && (
          <Button variant="primary" onClick={() => { const p = statusRows[0]; openForm(activeFreq, p.year, p.number); }}>
            <Plus size={14} className="mr-1.5" /> {t.submitReport}
          </Button>
        )}
      </div>
      {mode === 'investor' && <p className="text-[11px] text-gray-400">{t.scopeNote}</p>}
      {notice && <div role={notice.ok ? 'status' : 'alert'} className={cn('text-xs rounded-xl px-3 py-2', notice.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>{notice.message}</div>}

      {series.length === 0 && reports.length === 0 ? (
        <div className="text-center py-14 bg-white border border-gray-100 rounded-3xl">
          <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-300 inline-flex items-center justify-center mb-3"><TrendingUp size={22} /></span>
          <p className="text-sm font-medium text-gray-700 mb-1">{t.noReportsTitle}</p>
          <p className="text-xs text-gray-400">{mode === 'founder' ? t.noReportsFounder : t.noReportsInvestor}</p>
        </div>
      ) : null}

      {latest && (
        <>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">{t.latestReport.replace('{period}', label(latest))}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {kpiDefs.map((def, i) => (
                <Kpi key={def.key} icon={TrendingUp} tone={(['emerald', 'sky', 'violet', 'amber', 'indigo', 'rose', 'sky'] as const)[i % 7]}
                  label={metricLabel(t, def.key)} value={formatMetric(t, def, latest[def.key], latest.currency, locale)} sub={delta(def)} />
              ))}
            </div>
          </div>

          {series.length >= 2 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card title={t.chartRevenueExpenses}><GroupedBars data={chartData} format={money} series={[{ key: 'revenue', name: metricLabel(t, 'revenue') }, { key: 'expenses', name: metricLabel(t, 'expenses') }]} /></Card>
              <Card title={t.chartProfit}><AreaLines data={chartData} format={money} series={[{ key: 'netProfit', name: metricLabel(t, 'netProfit') }]} /></Card>
              <Card title={t.chartCash}><AreaLines data={chartData} format={money} series={[{ key: 'cash', name: metricLabel(t, 'cash') }, { key: 'burn', name: metricLabel(t, 'burn') }]} /></Card>
              <Card title={t.chartPeople}><CountLines data={chartData} format={n => n.toLocaleString(locale)} series={[{ key: 'customers', name: metricLabel(t, 'customers') }, { key: 'employees', name: metricLabel(t, 'employees') }]} /></Card>
            </div>
          ) : <p className="text-xs text-gray-400">{t.chartNeedTwo}</p>}
        </>
      )}

      {activeFreq && (
        <Card title={t.sectionStatus}>
          <ul className="divide-y divide-gray-50">
            {statusRows.map(s => (
              <li key={`${s.year}-${s.number}`} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="text-sm font-medium text-gray-900 w-24">{periodLabel(activeFreq, s.year, s.number, locale)}</span>
                {stateCell(s)}
                <span className="text-[11px] text-gray-400 flex-1 min-w-0 truncate">
                  {s.report && s.state === 'submitted' && t.submittedOnBy.replace('{date}', formatDate(s.report.submittedOn, locale)).replace('{name}', s.report.submittedBy || '—')}
                  {s.report && s.report.reviewedOn && ` · ${t.reviewedOnBy.replace('{date}', formatDate(s.report.reviewedOn, locale)).replace('{name}', s.report.reviewedBy || '—')}`}
                </span>
                {mode === 'founder' && (
                  <Button variant="outline" size="sm" onClick={() => openForm(activeFreq, s.year, s.number)}>
                    {s.state === 'draft' ? <><Pencil size={12} className="mr-1.5" />{t.editDraft}</> : s.state === 'submitted' ? t.submitReport : <><Plus size={12} className="mr-1.5" />{t.submitReport}</>}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {series.length >= 2 ? (
        <Card title={t.sectionCompare}>
          <div className="grid grid-cols-2 gap-3 max-w-md mb-4">
            <Select label={t.compareA} value={a ? periodKey(a) : ''} onChange={e => setCmpA(e.target.value)} options={series.map(r => ({ value: periodKey(r), label: label(r) }))} />
            <Select label={t.compareB} value={b ? periodKey(b) : ''} onChange={e => setCmpB(e.target.value)} options={series.map(r => ({ value: periodKey(r), label: label(r) }))} />
          </div>
          {a && b && (
            <Table head={['', label(a), label(b), t.compareChange]}>
              {METRICS.map(def => {
                const d = deltas.find(x => x.key === def.key);
                return (
                  <tr key={def.key} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 text-gray-600">{metricLabel(t, def.key)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatMetric(t, def, a[def.key], a.currency, locale)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatMetric(t, def, b[def.key], b.currency, locale)}</td>
                    <td className="px-4 py-2.5">{d?.pct == null ? '—' : <Pill tone={d.pct >= 0 ? 'emerald' : 'rose'}>{d.pct >= 0 ? '+' : ''}{d.pct.toFixed(1)}%</Pill>}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      ) : series.length > 0 ? <p className="text-xs text-gray-400">{t.compareNeedTwo}</p> : null}

      {byPeriod.size > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.sectionHistory}</h3>
          <Table head={[t.colPeriod, ...metricCols.map(m => metricLabel(t, m.key)), t.colStatus, t.colSubmitted, t.colVersion, '']}>
            {[...byPeriod.entries()].sort((x, y) => y[1][0].periodStart.localeCompare(x[1][0].periodStart)).map(([key, versions]) => {
              const cur = versions[0];
              const open = openKey === key;
              return (
                <Fragment key={key}>
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{label(cur)}</td>
                    {metricCols.map(m => <td key={m.key} className="px-4 py-3 tabular-nums whitespace-nowrap">{formatMetric(t, m, cur[m.key], cur.currency, locale)}</td>)}
                    <td className="px-4 py-3">{pill(cur.status)}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">{cur.submittedOn ? formatDate(cur.submittedOn, locale) : '—'}<span className="block text-gray-400">{cur.submittedBy}</span></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.versionShort.replace('{n}', String(cur.version))}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setOpenKey(open ? '' : key)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:underline">
                        {open ? t.hideVersions : `${t.showVersions} (${versions.length})`}<ChevronDown size={12} className={open ? 'rotate-180' : ''} />
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-gray-50/60">
                      <td colSpan={metricCols.length + 5} className="px-4 py-4">
                        <p className="text-xs font-semibold text-gray-700 mb-3">{t.sectionVersions} · {label(cur)}</p>
                        <ol className="space-y-3">
                          {versions.map((v, i) => (
                            <li key={v.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="text-sm font-semibold text-gray-900">{t.versionShort.replace('{n}', String(v.version))}</span>
                                {pill(v.status)}
                                <span className="text-[11px] text-gray-400">{v.submittedOn ? t.submittedOnBy.replace('{date}', formatDate(v.submittedOn, locale)).replace('{name}', v.submittedBy || '—') : t.stateDraft}</span>
                                {v.reviewedOn && <span className="text-[11px] text-gray-400">· {t.reviewedOnBy.replace('{date}', formatDate(v.reviewedOn, locale)).replace('{name}', v.reviewedBy || '—')}</span>}
                                {mode === 'investor' && i === 0 && (
                                  <Button variant="outline" size="sm" className="ml-auto" onClick={() => { setFormError(''); setReview(v); }}>{t.reviewTitle}</Button>
                                )}
                              </div>
                              <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                                {METRICS.map(m => (
                                  <div key={m.key}><dt className="text-[11px] text-gray-400">{metricLabel(t, m.key)}</dt><dd className="text-sm font-medium text-gray-800 tabular-nums">{formatMetric(t, m, v[m.key], v.currency, locale)}</dd></div>
                                ))}
                              </dl>
                              {v.founderNotes && <p className="mt-3 text-xs text-gray-600"><span className="font-medium">{t.founderNotes}:</span> {v.founderNotes}</p>}
                              {v.reviewNotes && <p className="mt-1 text-xs text-gray-600"><span className="font-medium">{t.reviewNotes}:</span> {v.reviewNotes}</p>}
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
        </div>
      )}

      {form && (
        <FinanceSubmitModal frequencies={frequencies} currencies={currencies.length ? currencies : ['USD']} existing={reports} initial={form}
          today={today()} locale={locale} saving={saving} error={formError} t={t}
          onSave={(v, d) => void save(v, d)} onClose={() => { if (!saving) setForm(null); }} />
      )}
      {review && (
        <ReviewModal report={review} choices={reviewChoices} statusLabel={statusLabel} saving={saving} error={formError} t={t}
          period={label(review)} onSave={(s, n) => void saveReview(review, s, n)} onClose={() => { if (!saving) setReview(null); }} />
      )}
    </div>
  );
}

function ReviewModal({ report, choices, statusLabel, saving, error, t, period, onSave, onClose }: {
  report: FinanceReport; choices: string[]; statusLabel: (s: string) => string; saving: boolean; error: string; t: FinText;
  period: string; onSave: (status: string, notes: string) => void; onClose: () => void;
}) {
  const [notes, setNotes] = useState(report.reviewNotes);
  return (
    <ModalFrame title={t.reviewTitle} onClose={onClose}
      footer={<Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t.reviewPrompt.replace('{period}', period).replace('{n}', String(report.version))}</p>
        {error && <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
        <Textarea label={t.reviewNotesLabel} value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        <div className="flex flex-wrap gap-2">
          {choices.map(c => (
            <Button key={c} variant={c === STATUS.approved ? 'primary' : 'outline'} disabled={saving} onClick={() => onSave(c, notes)}>{statusLabel(c)}</Button>
          ))}
        </div>
      </div>
    </ModalFrame>
  );
}

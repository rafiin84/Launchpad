import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Search, Plus, Download, AlertCircle, Loader2, Landmark, RefreshCw, Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { cn } from '../lib/cn';
import {
  amountsOf, createInvestment, emptyInvestmentInput, fetchInvestmentAccess, fetchInvestments,
  inputFromInvestment, isPermissionError, TX_STATUSES, updateInvestment,
  type InvestmentAccess, type InvestmentInput, type InvestmentRecord,
} from '../services/crmInvestments';
import { fetchCRMPortfolio, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { fetchPortfolioEntries } from '../services/crmPortfolioManagement';
import { formatAmount, ownership, ROUND_ORDER, sumByCurrency } from '../lib/investmentCalc';
import { formatDate, toCsv } from '../lib/portfolioFormat';
import InvestmentFormModal from '../components/investments/InvestmentFormModal';
import InvestmentPanel from '../components/investments/InvestmentPanel';
import RoundHistory from '../components/investments/RoundHistory';
import { StatusBadge } from '../components/investments/investmentUi';
import { statusLabel } from '../components/investments/investmentText';

type StatusFilter = 'all' | (typeof TX_STATUSES)[number];

function InvestmentsPage() {
  const { t: all, language } = useLanguage();
  const t = all.investments;
  const navigate = useNavigate();
  const locale = language === 'ja' ? 'ja-JP' : 'en-US';

  const [records, setRecords] = useState<InvestmentRecord[]>([]);
  const [access, setAccess] = useState<InvestmentAccess>({ canCreate: null, canEdit: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [round, setRound] = useState('');
  const [panelId, setPanelId] = useState<string | null>(null);

  const [form, setForm] = useState<null | { mode: 'add' | 'edit'; id?: string; initial: InvestmentInput }>(null);
  const [companies, setCompanies] = useState<CRMPortfolioRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [preparingAdd, setPreparingAdd] = useState(false);

  // Hide controls CRM says this user can't use. Unknown (null) keeps them visible —
  // CRM still enforces, and a refused write is reported plainly.
  const canCreate = access.canCreate !== false;
  const canEdit = access.canEdit !== false;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [recs, acc] = await Promise.all([fetchInvestments(), fetchInvestmentAccess()]);
      setRecords(recs); setAccess(acc);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of records) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [records]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter(r =>
      (status === 'all' || r.status === status) &&
      (!round || r.round === round) &&
      (!q || [r.companyName, r.reference, r.round, r.investorEntity].some(v => v.toLowerCase().includes(q))));
  }, [records, query, status, round]);

  // Summary cards — per currency, never across currencies.
  const summary = useMemo(() => ({
    committed: sumByCurrency(visible, r => r.committedAmount),
    funded: sumByCurrency(visible, r => amountsOf(r).funded),
    realized: sumByCurrency(visible, r => amountsOf(r).realized),
  }), [visible]);

  const panelRecord = panelId ? records.find(r => r.id === panelId) ?? null : null;

  async function openAdd() {
    setPreparingAdd(true); setFormError('');
    try {
      setCompanies(await fetchCRMPortfolio());
    } catch {
      setCompanies([]);
      setFormError(t.loadFailed);
    } finally {
      setPreparingAdd(false);
    }
    setForm({ mode: 'add', initial: emptyInvestmentInput() });
  }

  function openEdit(r: InvestmentRecord) {
    setFormError(''); setCompanies([]);
    setForm({ mode: 'edit', id: r.id, initial: inputFromInvestment(r) });
  }

  async function save(input: InvestmentInput) {
    if (!form) return;
    setSaving(true); setFormError('');
    try {
      if (form.mode === 'add') {
        // Link the record to the company's Portfolio Management entry when it has one.
        const entries = await fetchPortfolioEntries().catch(() => []);
        const entryId = entries.find(e => e.companyId && e.companyId === input.companyId)?.id;
        const id = await createInvestment(input, entryId);
        setPanelId(id);
      } else if (form.id) {
        await updateInvestment(form.id, input);
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormError(isPermissionError(err) ? t.noPermission : err instanceof Error && err.message ? err.message : t.actionFailed);
    } finally {
      setSaving(false);
    }
  }

  function exportTransactions() {
    if (visible.length === 0) return;
    const header = [
      t.colReference, t.colCompany, t.colRound, t.colInstrument, t.colInvestorEntity, t.colStatus, t.colCurrency,
      t.colInvestmentDate, t.colProposed, t.colProposedDate, t.colApprovalDate, t.colCommitted, t.colCommitmentDate,
      t.colFunded, t.colLastFundingDate, t.colRefunded, t.colRealized, t.colPreMoney, t.colValuation,
      t.colValuationDate, t.colHoldingValue, t.colHoldingAsOf, `${t.colOwnership} %`, t.colTermsReference,
    ];
    const body = visible.map(r => {
      const a = amountsOf(r);
      const own = ownership({
        sharesAcquired: r.sharesAcquired, fullyDilutedShares: r.fullyDilutedShares,
        capTableApproved: r.capTableApproved, recordedPct: r.recordedOwnershipPct,
      });
      return [
        r.reference, r.companyName, r.round, r.instrument, r.investorEntity, r.status, r.currency,
        r.investmentDate, r.proposedAmount, r.proposedDate, r.approvalDate, r.committedAmount, r.commitmentDate,
        a.funded, r.lastFundingDate, a.refunded, a.realized, r.preMoney, r.postMoney,
        r.valuationDate, r.holdingValue, r.holdingValueAsOf, own.pct, r.termsReference,
      ];
    });
    // A BOM so Excel reads the UTF-8 (company names, Japanese labels) correctly.
    const blob = new Blob(['﻿' + toCsv(header, body)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.exportFilename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const money = (items: Array<{ currency: string; amount: number }>) =>
    items.length === 0 ? t.notRecorded : items.map(i => formatAmount(i.amount, i.currency, locale)).join(' · ');

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={exportTransactions} disabled={visible.length === 0}>
        <Download size={14} className="mr-1.5" /> {t.exportTransactions}
      </Button>
      {canCreate && (
        <Button variant="primary" onClick={openAdd} disabled={preparingAdd}>
          {preparingAdd ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
          {t.addInvestmentRecord}
        </Button>
      )}
    </div>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <PageHeader title={t.title} description={t.intro} className="mb-4" />
      <div className="mb-6">{actions}</div>

      {!loading && !error && access.canEdit === false && (
        <p role="status" className="flex items-center gap-2 text-xs text-gray-500 mb-4"><Lock size={12} /> {t.readOnlyNote}</p>
      )}

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label={t.loading}>
          {[0, 1, 2, 3].map(i => <div key={i} className="h-14 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-700">{t.loadFailed}</p>
          <p className="text-xs text-red-500 mt-1 break-words">{error}</p>
          <button onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg">
            <RefreshCw size={12} /> {t.retry}
          </button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
          <Landmark size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">{t.emptyTitle}</p>
          <p className="text-xs text-gray-400 mb-4">{t.emptyDesc}</p>
          {canCreate && (
            <Button variant="primary" onClick={openAdd} disabled={preparingAdd}><Plus size={14} className="mr-1.5" /> {t.addInvestmentRecord}</Button>
          )}
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div className="space-y-6">
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([[t.summaryCommitted, summary.committed], [t.summaryFunded, summary.funded], [t.summaryRealized, summary.realized]] as const).map(([label, items]) => (
                <div key={label} className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                  <p className="text-[11px] text-gray-400">{label}</p>
                  <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">{money(items)}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">{t.summaryNote}</p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.colStatus}>
              {(['all', ...TX_STATUSES] as StatusFilter[]).map(f => (
                <button key={f} onClick={() => setStatus(f)} aria-pressed={status === f}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                    status === f ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  {f === 'all' ? t.filterAll : statusLabel(t, f)}
                  <span className="ml-1.5 opacity-60 tabular-nums">{f === 'all' ? records.length : counts[f] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="lg:ml-auto flex flex-col sm:flex-row gap-2 lg:w-[28rem]">
              <div className="sm:w-40">
                <Select value={round} onChange={e => setRound(e.target.value)} aria-label={t.colRound}
                  options={ROUND_ORDER.map(v => ({ value: v, label: v }))} placeholder={t.allRounds} />
              </div>
              <div className="flex-1">
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchPlaceholder}
                  aria-label={t.searchPlaceholder} icon={<Search size={15} />} />
              </div>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">{t.noMatches}</p>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[64rem]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    {[t.colCompany, t.colRound, t.colInstrument, t.colInvestmentDate, t.colCommitted, t.colFunded, t.colCurrency, t.colValuation, t.colStatus]
                      .map(h => <th key={h} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">{h}</th>)}
                    <th scope="col" className="px-3 py-3"><span className="sr-only">{t.viewInvestment}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.id} onClick={() => setPanelId(r.id)}
                      className={cn('border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50/70', panelId === r.id && 'bg-indigo-50/40')}>
                      <td className="px-3 py-3 font-semibold text-gray-900 whitespace-nowrap">
                        {r.companyName || '—'}
                        <span className="block text-[11px] font-normal text-gray-400">{r.reference}</span>
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{r.round || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{r.instrument || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.investmentDate, locale)}</td>
                      <td className="px-3 py-3 text-gray-900 tabular-nums whitespace-nowrap">{formatAmount(r.committedAmount, r.currency, locale)}</td>
                      <td className="px-3 py-3 text-gray-900 tabular-nums whitespace-nowrap">{formatAmount(amountsOf(r).funded, r.currency, locale)}</td>
                      <td className="px-3 py-3 text-gray-600">{r.currency || '—'}</td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        <span className="text-gray-900">{formatAmount(r.postMoney, r.currency, locale)}</span>
                        {r.valuationDate && <span className="block text-[11px] text-gray-400">{formatDate(r.valuationDate, locale)}</span>}
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={r.status} t={t} /></td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={ev => { ev.stopPropagation(); setPanelId(r.id); }}
                          className="text-xs font-medium text-indigo-600 hover:underline whitespace-nowrap">{t.viewInvestment}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <RoundHistory investments={visible} language={language} t={t} onSelect={setPanelId} />
        </div>
      )}

      {panelRecord && (
        <InvestmentPanel
          key={panelRecord.id}
          inv={panelRecord} canEdit={canEdit} language={language} t={t}
          onClose={() => setPanelId(null)}
          onEdit={() => openEdit(panelRecord)}
          onOpenCompany={() => navigate(`/portfolio/${panelRecord.companyId}`)}
          onChanged={updated => setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)))}
        />
      )}

      {form && (
        <InvestmentFormModal
          key={form.id ?? 'new'}
          mode={form.mode} initial={form.initial} companies={companies}
          saving={saving} error={formError} t={t}
          onSave={save} onClose={() => { if (!saving) setForm(null); }}
        />
      )}
    </div>
  );
}

// Investor-side only. Reviewers are investor-side users but have no access to this
// module, and founders are never shown it.
export default function Investments() {
  const { isInvestor, isReviewer } = useAuth();
  if (!isInvestor || isReviewer) return <Navigate to="/" replace />;
  return <InvestmentsPage />;
}

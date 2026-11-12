import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Search, Plus, Download, GitCompare, AlertCircle, Loader2, Briefcase, RefreshCw, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/cn';
import {
  createPortfolioEntry, emptyInput, fetchPortfolioEntries,
  inputFromEntry, updatePortfolioEntry, type PortfolioEntry, type PortfolioEntryInput,
} from '../services/crmPortfolioManagement';
import { fetchCRMPortfolio, type CRMPortfolioRecord } from '../services/crmPortfolio';
import {
  evaluateHealth, hasNotReportedRecently, staleThresholdDays, type HealthStatus,
} from '../lib/portfolioHealth';
import { HEALTH_RULES as rules } from '../config/portfolioHealthRules';
import type { TimelineEvent } from '../lib/portfolioTimeline';
import { formatDate, formatMoney, formatPercent, toCsv } from '../lib/portfolioFormat';
import AllocationCards from '../components/portfolio/AllocationCards';
import CompanyPanel from '../components/portfolio/CompanyPanel';
import CompareModal from '../components/portfolio/CompareModal';
import EntryFormModal from '../components/portfolio/EntryFormModal';
import { HealthBadge } from '../components/portfolio/portfolioUi';
import { healthLabel } from '../components/portfolio/portfolioText';

const MAX_COMPARE = 4;
// Rules are a config constant, so the stale threshold is too.
const staleDays = staleThresholdDays(rules);
type Filter = 'all' | HealthStatus;
const HEALTH_FILTERS: HealthStatus[] = ['on_track', 'needs_attention', 'at_risk', 'data_unavailable'];

function PortfolioManagementPage() {
  const { t: all, language } = useLanguage();
  const t = all.portfolioManagement;
  const navigate = useNavigate();
  const locale = language === 'ja' ? 'ja-JP' : 'en-US';

  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareNotice, setCompareNotice] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);

  const [form, setForm] = useState<null | { mode: 'add' | 'edit'; entryId?: string; initial: PortfolioEntryInput }>(null);
  const [formCompanies, setFormCompanies] = useState<CRMPortfolioRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [preparingAdd, setPreparingAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setEntries(await fetchPortfolioEntries());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => { void load(); }, [load]);


  const rows = useMemo(() => entries.map(entry => ({
    entry,
    health: evaluateHealth({
      runwayMonths: entry.runwayMonths,
      revenueGrowthPct: entry.revenueGrowthPct,
      monthlyBurn: entry.monthlyBurn,
      lastCompanyUpdate: entry.lastCompanyUpdate,
      recordedStatus: entry.recordedHealth,
      recordedReason: entry.recordedHealthReason,
    }, rules),
    stale: hasNotReportedRecently(entry.lastCompanyUpdate, staleDays),
  })), [entries]);

  const counts = useMemo(() => {
    const c: Record<HealthStatus, number> = { on_track: 0, needs_attention: 0, at_risk: 0, data_unavailable: 0 };
    for (const r of rows) c[r.health.status]++;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r =>
      (filter === 'all' || r.health.status === filter) &&
      (!q || [r.entry.companyName, r.entry.sector, r.entry.geography, r.entry.currentStage].some(v => v.toLowerCase().includes(q))));
  }, [rows, query, filter]);

  const staleCount = rows.filter(r => r.stale).length;
  const panelRow = panelId ? rows.find(r => r.entry.id === panelId) ?? null : null;
  const compareRows = compareIds.map(id => rows.find(r => r.entry.id === id)).filter((r): r is NonNullable<typeof r> => !!r);

  function toggleCompare(id: string) {
    setCompareNotice(false);
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_COMPARE) { setCompareNotice(true); return prev; }
      return [...prev, id];
    });
  }

  async function openAdd() {
    setPreparingAdd(true); setFormError('');
    try {
      const companies = await fetchCRMPortfolio();
      const taken = new Set(entries.map(e => e.companyId).filter(Boolean));
      setFormCompanies(companies.filter(c => !taken.has(c.id)));
    } catch {
      setFormCompanies([]);
      setFormError(t.loadFailed);
    } finally {
      setPreparingAdd(false);
    }
    setForm({ mode: 'add', initial: { ...emptyInput(), confirmedOn: new Date().toISOString().slice(0, 10) } });
  }

  function openEdit(entry: PortfolioEntry) {
    setFormError(''); setFormCompanies([]);
    setForm({ mode: 'edit', entryId: entry.id, initial: inputFromEntry(entry) });
  }

  async function save(input: PortfolioEntryInput) {
    if (!form) return;
    setSaving(true); setFormError('');
    try {
      if (form.mode === 'add') {
        // The investment goes on the company's timeline in the same create call.
        const amount = input.totalInvested.trim() === '' ? null : Number(input.totalInvested);
        const id = await createPortfolioEntry(input, {
          type: 'Initial Investment', title: input.companyName.trim(),
          date: input.initialInvestmentDate || new Date().toISOString().slice(0, 10),
          amount: amount !== null && Number.isFinite(amount) ? amount : null,
        });
        setPanelId(id);
      } else if (form.entryId) {
        await updatePortfolioEntry(form.entryId, input);
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error && err.message ? err.message : t.actionFailed);
    } finally {
      setSaving(false);
    }
  }

  /** The panel just saved an event — mirror it here so the page and panel agree without a refetch. */
  function applyTimeline(entryId: string, timeline: TimelineEvent[]) {
    setEntries(prev => prev.map(e => (e.id === entryId ? { ...e, timeline } : e)));
  }

  function exportCsv() {
    if (visible.length === 0) return;
    const header = [
      t.colCompany, t.colSector, t.colGeography, t.colStage, t.colInitialInvestment, t.colTotalInvested,
      t.colLatestValuation, t.colValuationAsOf, t.colOwnership, t.colStatus, t.colHealth,
      t.reportingPeriod, t.colMetricsAsOf, t.metricRevenue, t.metricRevenueGrowth,
      t.metricBurn, t.metricRunway, t.metricHeadcount, t.metricOpenRoles, t.colLastUpdate,
    ];
    const body = visible.map(({ entry: e, health }) => [
      e.companyName, e.sector, e.geography, e.currentStage, e.initialInvestmentDate, e.totalInvested,
      e.latestValuation, e.valuationAsOf, e.ownershipPct, e.status, healthLabel(t, health.status),
      e.reportingPeriod, e.metricsAsOf, e.latestRevenue, e.revenueGrowthPct, e.monthlyBurn,
      e.runwayMonths, e.headcount, e.openRoles, e.lastCompanyUpdate,
    ]);
    // A BOM so Excel reads the UTF-8 (company names, Japanese labels) correctly.
    const blob = new Blob(['﻿' + toCsv(header, body)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.exportFilename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setCompareOpen(true)} disabled={compareIds.length < 2}
        title={compareIds.length < 2 ? t.compareHint : undefined}>
        <GitCompare size={14} className="mr-1.5" /> {t.compareCompanies}{compareIds.length > 0 && ` (${compareIds.length})`}
      </Button>
      <Button variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
        <Download size={14} className="mr-1.5" /> {t.exportPortfolio}
      </Button>
      <Button variant="primary" onClick={openAdd} disabled={preparingAdd}>
        {preparingAdd ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
        {t.addInvestment}
      </Button>
    </div>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <PageHeader title={t.title} description={t.intro} className="mb-4" />
      <div className="mb-6">{actions}</div>

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

      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
          <Briefcase size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">{t.emptyTitle}</p>
          <p className="text-xs text-gray-400 mb-4">{t.emptyDesc}</p>
          <Button variant="primary" onClick={openAdd} disabled={preparingAdd}><Plus size={14} className="mr-1.5" /> {t.addInvestment}</Button>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="space-y-6">
          {staleCount > 0 && (
            <div role="status" className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3.5">
              <Clock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">{t.staleBanner}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {t.staleDetail.replace('{n}', String(staleCount)).replace('{total}', String(rows.length)).replace('{days}', String(staleDays))}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.colHealth}>
              {(['all', ...HEALTH_FILTERS] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                    filter === f ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  {f === 'all' ? t.filterAll : healthLabel(t, f)}
                  <span className="ml-1.5 opacity-60 tabular-nums">{f === 'all' ? rows.length : counts[f]}</span>
                </button>
              ))}
            </div>
            <div className="lg:ml-auto lg:w-72">
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder} icon={<Search size={15} />} />
            </div>
          </div>

          {compareNotice && <p role="status" className="text-xs text-amber-700">{t.compareMax}</p>}

          {visible.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">{t.noMatches}</p>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[60rem]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="pl-4 py-3 w-8"><span className="sr-only">{t.compareCompanies}</span></th>
                    {[t.colCompany, t.colSector, t.colStage, t.colInitialInvestment, t.colTotalInvested, t.colLatestValuation, t.colOwnership, t.colStatus, t.colHealth, t.colLastUpdate]
                      .map(h => <th key={h} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ entry: e, health, stale }) => (
                    <tr key={e.id} onClick={() => setPanelId(e.id)}
                      className={cn('border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50/70', panelId === e.id && 'bg-indigo-50/40')}>
                      <td className="pl-4 py-3" onClick={ev => ev.stopPropagation()}>
                        <input type="checkbox" checked={compareIds.includes(e.id)} onChange={() => toggleCompare(e.id)}
                          aria-label={`${t.compareCompanies}: ${e.companyName}`} className="rounded border-gray-300" />
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-900 whitespace-nowrap">
                        <button className="text-left hover:text-indigo-600" onClick={ev => { ev.stopPropagation(); setPanelId(e.id); }}>{e.companyName}</button>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{e.sector || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{e.currentStage || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDate(e.initialInvestmentDate, locale)}</td>
                      <td className="px-3 py-3 text-gray-900 tabular-nums whitespace-nowrap">{formatMoney(e.totalInvested)}</td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        <span className="text-gray-900">{formatMoney(e.latestValuation)}</span>
                        {e.valuationAsOf && <span className="block text-[11px] text-gray-400">{t.asOf.replace('{date}', formatDate(e.valuationAsOf, locale))}</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-600 tabular-nums">{formatPercent(e.ownershipPct)}</td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{e.status || '—'}</td>
                      <td className="px-3 py-3"><HealthBadge status={health.status} t={t} /></td>
                      <td className={cn('px-3 py-3 whitespace-nowrap', stale ? 'text-amber-600' : 'text-gray-600')}>
                        {e.lastCompanyUpdate ? formatDate(e.lastCompanyUpdate, locale) : t.notReported}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <AllocationCards entries={entries} t={t} />
        </div>
      )}

      {panelRow && (
        <CompanyPanel
          key={panelRow.entry.id}
          entry={panelRow.entry} health={panelRow.health} language={language} t={t}
          onClose={() => setPanelId(null)}
          onEdit={() => openEdit(panelRow.entry)}
          onOpenCompany={() => navigate(`/portfolio/${panelRow.entry.companyId}`)}
          onTimelineChange={timeline => applyTimeline(panelRow.entry.id, timeline)}
        />
      )}

      {compareOpen && compareRows.length >= 2 && (
        <CompareModal rows={compareRows} language={language} t={t} onClose={() => setCompareOpen(false)} />
      )}

      {form && (
        <EntryFormModal
          key={form.entryId ?? 'new'}
          mode={form.mode} initial={form.initial} companies={formCompanies}
          saving={saving} error={formError} t={t}
          onSave={save} onClose={() => { if (!saving) setForm(null); }}
        />
      )}
    </div>
  );
}

// Only the investor sees this page. Reviewers are investor-side users but have no
// access to this module in CRM, and founders are never shown it.
export default function PortfolioManagement() {
  const { isInvestor, isReviewer } = useAuth();
  if (!isInvestor || isReviewer) return <Navigate to="/" replace />;
  return <PortfolioManagementPage />;
}


import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle, BarChart3, CalendarDays, ChevronDown, Clock, Coins, FileDown, FileText, Loader2, RefreshCw, Save, SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { cn } from '../lib/cn';
import {
  createSavedView, fetchSavedViews, isReportPermissionError, loadReportSources, REPORTS_MODULE,
  updateSavedView, type ReportSources, type SavedView,
} from '../services/crmReports';
import { fetchModuleAccess } from '../services/zohoApi';
import {
  activeFilterCount, buildReport, emptyFilters, REPORT_TABS, type Report, type ReportFilters, type ReportTab,
} from '../lib/reportAnalytics';
import ReportFiltersDrawer, { type FilterOptions } from '../components/reports/ReportFiltersDrawer';
import { ActivitySection, CompaniesSection, PerformanceSection, SummarySection } from '../components/reports/ReportSections';
import MethodologyPanel from '../components/reports/MethodologyPanel';
import SaveViewModal from '../components/reports/SaveViewModal';
import { reportCsv } from '../components/reports/reportExport';
import {
  conversionLine, dataAsOfText, exclusionMessage, periodText,
} from '../components/reports/reportText';

const todayISO = () => new Date().toISOString().slice(0, 10);

// When a report is printed ("Export PDF"), show only the report area, with every
// section open and no controls.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print { position: absolute; left: 0; top: 0; width: 100%; }
  .report-print-hide { display: none !important; }
  * { overflow: visible !important; }
}`;

function ReportsPage() {
  const { t: all, language } = useLanguage();
  const t = all.reports;
  const locale = language === 'ja' ? 'ja-JP' : 'en-US';

  const [sources, setSources] = useState<ReportSources | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [draft, setDraft] = useState<ReportFilters>(emptyFilters());
  const [applied, setApplied] = useState<ReportFilters>(emptyFilters());
  const [tab, setTab] = useState<ReportTab>('summary');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showExcluded, setShowExcluded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  const [views, setViews] = useState<SavedView[]>([]);
  const [canSave, setCanSave] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState<{ id: string; name: string } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const generate = useCallback(async (filters: ReportFilters, openTab?: ReportTab) => {
    setGenerating(true); setError('');
    try {
      // Always read the sources fresh, so the data-as-of timestamp is honest.
      const src = await loadReportSources();
      setSources(src);
      setReport(buildReport(src.investments, src.entries, filters, {
        fetchedAt: src.fetchedAt, today: todayISO(), portfolioUnavailable: src.portfolioUnavailable,
      }, { unspecified: t.unspecified }));
      setApplied(filters);
      if (openTab) setTab(openTab);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.loadFailed);
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, [t.unspecified, t.loadFailed]);

  useEffect(() => {
    void generate(emptyFilters());
    void fetchSavedViews().then(setViews).catch(() => setViews([]));
    void fetchModuleAccess(REPORTS_MODULE).then(a => setCanSave(a.canCreate));
  }, [generate]);

  const options: FilterOptions = useMemo(() => {
    const inv = sources?.investments ?? [];
    const entries = sources?.entries ?? [];
    const companies = new Map<string, string>();
    for (const i of inv) if (i.companyId) companies.set(i.companyId, i.companyName);
    for (const e of entries) if (e.companyId) companies.set(e.companyId, e.companyName);
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      funds: uniq(inv.map(i => i.investorEntity)),
      companies: [...companies.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      sectors: uniq(entries.map(e => e.sector)),
      currencies: uniq(inv.map(i => i.currency)),
    };
  }, [sources]);

  const excluded = useMemo(() => (report ? report.exclusions.map(e => exclusionMessage(t, e)) : []), [report, t]);
  const incomplete = useMemo(() => (report ? report.exclusions.filter(e => e.incomplete) : []), [report]);

  function openView(id: string) {
    const v = views.find(x => x.id === id);
    if (!v) return;
    setDraft(v.filters); setLoaded({ id: v.id, name: v.name }); setNotice({ ok: true, message: t.savedViewLoaded.replace('{name}', v.name) });
    void generate(v.filters, v.tab);
  }

  async function saveView(name: string, updateId: string | null) {
    if (!report) return;
    setSaving(true); setSaveError('');
    try {
      let id = updateId;
      if (updateId) await updateSavedView(updateId, name, tab, applied, report);
      else id = await createSavedView(name, tab, applied, report);
      setLoaded(id ? { id, name: name.trim() } : null);
      setSaveOpen(false);
      setNotice({ ok: true, message: t.saved });
      void fetchSavedViews().then(setViews).catch(() => undefined);
    } catch (err) {
      setSaveError(isReportPermissionError(err) ? t.noPermission : err instanceof Error && err.message ? err.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    if (!report) return;
    const blob = new Blob(['﻿' + reportCsv(report, tab, t, locale, excluded)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${t.exportFilename}-${tab}-${report.periodEnd}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const filterCount = activeFilterCount(applied);

  // What the report was generated with, in words — shown on screen and in the printed report.
  const filterChips = useMemo(() => {
    const chips: string[] = [];
    if (applied.periodStart) chips.push(`${t.filterPeriodStart}: ${applied.periodStart}`);
    if (applied.periodEnd) chips.push(`${t.filterPeriodEnd}: ${applied.periodEnd}`);
    if (applied.fund) chips.push(`${t.filterFund}: ${applied.fund}`);
    if (applied.companyId) chips.push(`${t.filterCompany}: ${options.companies.find(c => c.id === applied.companyId)?.name ?? applied.companyId}`);
    if (applied.sector) chips.push(`${t.filterSector}: ${applied.sector}`);
    if (applied.stage) chips.push(`${t.filterStage}: ${applied.stage}`);
    if (applied.currency) chips.push(`${t.filterCurrency}: ${applied.currency}`);
    return chips;
  }, [applied, options.companies, t]);

  const tabLabel: Record<ReportTab, string> = {
    summary: t.tabSummary, performance: t.tabPerformance, activity: t.tabActivity, companies: t.tabCompanies,
  };

  function exportPdf() {
    // Show every section (the charts need a moment to size themselves) and then
    // open the print dialog; the browser's "Save as PDF" makes the file.
    setPrinting(true);
    window.setTimeout(() => window.print(), 900);
  }
  useEffect(() => {
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  const noReport = !report || report.isEmpty;
  const headerActions = (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      {views.length > 0 && (
        <div className="w-44">
          <Select aria-label={t.savedViews} value={loaded?.id ?? ''} onChange={e => openView(e.target.value)}
            options={views.map(v => ({ value: v.id, label: v.name }))} placeholder={t.savedViewsPlaceholder} className="py-2 text-xs" />
        </div>
      )}
      <Button variant="outline" onClick={() => setFiltersOpen(true)}>
        <SlidersHorizontal size={14} className="mr-1.5" /> {t.filters}
        {filterCount > 0 && <span className="ml-1.5 bg-gray-900 text-white text-[10px] font-semibold rounded-full min-w-[1.1rem] h-[1.1rem] px-1 inline-flex items-center justify-center">{filterCount}</span>}
      </Button>
      <Button variant="primary" onClick={() => void generate(draft)} disabled={generating}>
        {generating ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <RefreshCw size={14} className="mr-1.5" />}
        {generating ? t.generating : t.generate}
      </Button>
    </div>
  );

  const chip = 'inline-flex items-center gap-1.5 text-[11px] text-gray-600 bg-white border border-gray-100 rounded-full px-2.5 py-1';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[90rem]">
      <style>{PRINT_CSS}</style>
      <div className="report-print-hide">
        <PageHeader title={t.title} description={t.intro} action={headerActions} className="mb-5" />
        {notice && (
          <div role={notice.ok ? 'status' : 'alert'}
            className={cn('text-xs rounded-xl px-3 py-2 mb-4', notice.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
            {notice.message}
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label={t.loading}>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white border border-gray-100 rounded-3xl animate-pulse" />)}</div>
          <div className="h-64 bg-white border border-gray-100 rounded-3xl animate-pulse" />
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="bg-red-50 border border-red-100 rounded-3xl p-6 text-center">
          <AlertCircle size={20} className="text-red-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-600">{t.loadFailed}</p>
          <p className="text-xs text-red-400 mt-1 break-words">{error}</p>
          <button onClick={() => void generate(draft)} className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-red-500 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg">
            <RefreshCw size={12} /> {t.retry}
          </button>
        </div>
      )}

      {!loading && !error && report && (
        <div className="report-print space-y-5">
          <header className="space-y-2">
            <h2 className="hidden print:block text-lg font-bold text-gray-900">{t.title}{loaded ? ` · ${loaded.name}` : ''}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className={chip}><Clock size={12} className="text-gray-400" />{dataAsOfText(t, report, locale)}</span>
              <span className={chip}><CalendarDays size={12} className="text-gray-400" />{periodText(t, report)}</span>
              <span className={chip}><Coins size={12} className="text-gray-400" />{t.reportingIn.replace('{currency}', report.currency || '—')}</span>
              {filterChips.map(c => <span key={c} className="inline-flex items-center text-[11px] text-indigo-500 bg-indigo-50 rounded-full px-2.5 py-1">{c}</span>)}
            </div>
            <p className="text-[11px] text-gray-400">{conversionLine(t, report)}</p>
          </header>

          {incomplete.length > 0 && (
            <div role="status" className="bg-amber-50/70 border border-amber-100 rounded-2xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-amber-700">{t.excludedBanner}</p>
                <button onClick={() => setShowExcluded(s => !s)} aria-expanded={showExcluded}
                  className="report-print-hide flex items-center gap-1 text-xs font-medium text-amber-600 whitespace-nowrap">
                  {showExcluded ? t.excludedHide : t.excludedShow}
                  <ChevronDown size={13} className={showExcluded ? 'rotate-180' : ''} />
                </button>
              </div>
              <ul className={cn('mt-2 space-y-1 text-xs text-amber-600 list-disc pl-4', showExcluded ? 'block' : 'hidden print:block')}>
                {excluded.map(m => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}

          {report.isEmpty ? (
            <div className="text-center py-20 bg-white border border-gray-100 rounded-3xl">
              <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-300 inline-flex items-center justify-center mb-3"><BarChart3 size={22} /></span>
              <p className="text-sm font-medium text-gray-700 mb-1">{t.emptyTitle}</p>
              <p className="text-xs text-gray-400">{t.emptyDesc}</p>
            </div>
          ) : (
            <>
              <div className="report-print-hide flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                <div className="inline-flex p-1 bg-gray-100/80 rounded-2xl overflow-x-auto max-w-full" role="tablist">
                  {REPORT_TABS.map(k => (
                    <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                      className={cn('px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                        tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
                      {tabLabel[k]}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={exportCsv} disabled={noReport}><FileText size={13} className="mr-1.5" /> {t.exportCsv}</Button>
                  <Button variant="outline" size="sm" onClick={exportPdf} disabled={noReport} title={t.pdfNote}><FileDown size={13} className="mr-1.5" /> {t.exportPdf}</Button>
                  {canSave !== false && (
                    <Button variant="outline" size="sm" onClick={() => { setSaveError(''); setSaveOpen(true); }} disabled={noReport}>
                      <Save size={13} className="mr-1.5" /> {t.saveView}
                    </Button>
                  )}
                </div>
              </div>
              {REPORT_TABS.map(k => (
                <section key={k} className={cn(tab === k || printing ? 'block' : 'hidden print:block')} aria-label={tabLabel[k]}>
                  <h2 className="hidden print:block text-sm font-bold text-gray-900 mt-4 mb-2">{tabLabel[k]}</h2>
                  {(tab === k || printing) && k === 'summary' && <SummarySection report={report} t={t} locale={locale} />}
                  {(tab === k || printing) && k === 'performance' && <PerformanceSection report={report} t={t} locale={locale} />}
                  {(tab === k || printing) && k === 'activity' && <ActivitySection report={report} t={t} locale={locale} />}
                  {(tab === k || printing) && k === 'companies' && <CompaniesSection report={report} t={t} locale={locale} />}
                </section>
              ))}
            </>
          )}

          <MethodologyPanel t={t} />
        </div>
      )}

      {filtersOpen && (
        <ReportFiltersDrawer initial={draft} options={options}
          reportCurrency={report?.currency ?? ''} currenciesInScope={report?.currenciesInScope ?? []}
          generating={generating} t={t} onClose={() => setFiltersOpen(false)}
          onGenerate={f => { setDraft(f); setFiltersOpen(false); void generate(f); }} />
      )}
      {saveOpen && report && (
        <SaveViewModal key={loaded?.id ?? 'new'} initialName={loaded?.name ?? ''} loadedView={loaded}
          saving={saving} error={saveError} t={t} onSave={(n, id) => void saveView(n, id)}
          onClose={() => { if (!saving) setSaveOpen(false); }} />
      )}
    </div>
  );
}

// Investor-side only: the report's sources are investor-side modules, reviewers have
// no access to them, and founders are never shown this page.
export default function ReportsAnalytics() {
  const { isInvestor, isReviewer } = useAuth();
  if (!isInvestor || isReviewer) return <Navigate to="/" replace />;
  return <ReportsPage />;
}

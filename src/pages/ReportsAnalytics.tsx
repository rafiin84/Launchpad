import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, FileDown, FileText, Loader2, RefreshCw, Save, BarChart3, ChevronDown } from 'lucide-react';
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
  buildReport, emptyFilters, REPORT_TABS, type Report, type ReportFilters, type ReportTab,
} from '../lib/reportAnalytics';
import ReportFiltersPanel, { type FilterOptions } from '../components/reports/ReportFiltersPanel';
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

  const tabLabel: Record<ReportTab, string> = {
    summary: t.tabSummary, performance: t.tabPerformance, activity: t.tabActivity, companies: t.tabCompanies,
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={exportCsv} disabled={!report || report.isEmpty}>
        <FileText size={14} className="mr-1.5" /> {t.exportCsv}
      </Button>
      <Button variant="outline" onClick={() => window.print()} disabled={!report || report.isEmpty} title={t.pdfNote}>
        <FileDown size={14} className="mr-1.5" /> {t.exportPdf}
      </Button>
      {canSave !== false && (
        <Button variant="primary" onClick={() => { setSaveError(''); setSaveOpen(true); }} disabled={!report || report.isEmpty}>
          <Save size={14} className="mr-1.5" /> {t.saveView}
        </Button>
      )}
    </div>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <style>{PRINT_CSS}</style>
      <div className="report-print-hide">
        <PageHeader title={t.title} description={t.intro} className="mb-4" />
        <div className="mb-4 flex flex-col lg:flex-row lg:items-end gap-3">
          {actions}
          {views.length > 0 && (
            <div className="lg:ml-auto lg:w-72">
              <Select label={t.savedViews} value={loaded?.id ?? ''} onChange={e => openView(e.target.value)}
                options={views.map(v => ({ value: v.id, label: v.name }))} placeholder={t.savedViewsPlaceholder} />
            </div>
          )}
        </div>
        {notice && (
          <div role={notice.ok ? 'status' : 'alert'}
            className={cn('text-xs rounded-lg px-3 py-2 mb-4', notice.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {notice.message}
          </div>
        )}
        <div className="mb-6">
          <ReportFiltersPanel draft={draft} onChange={setDraft} options={options}
            reportCurrency={report?.currency ?? ''} currenciesInScope={report?.currenciesInScope ?? []}
            generating={generating} onGenerate={() => void generate(draft)} t={t} />
        </div>
      </div>

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label={t.loading}>
          {[0, 1, 2].map(i => <div key={i} className="h-24 bg-white border border-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-700">{t.loadFailed}</p>
          <p className="text-xs text-red-500 mt-1 break-words">{error}</p>
          <button onClick={() => void generate(draft)} className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg">
            <RefreshCw size={12} /> {t.retry}
          </button>
        </div>
      )}

      {!loading && !error && report && (
        <div className="report-print space-y-4">
          <header className="space-y-0.5">
            <h2 className="hidden print:block text-lg font-bold text-gray-900">{t.title}{loaded ? ` · ${loaded.name}` : ''}</h2>
            <p className="text-xs font-medium text-gray-700">{dataAsOfText(t, report, locale)}</p>
            <p className="text-xs text-gray-500">{periodText(t, report)} · {t.reportingIn.replace('{currency}', report.currency || '—')}</p>
            <p className="text-xs text-gray-500">{conversionLine(t, report)}</p>
          </header>

          {incomplete.length > 0 && (
            <div role="status" className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-amber-800">{t.excludedBanner}</p>
                <button onClick={() => setShowExcluded(s => !s)} aria-expanded={showExcluded}
                  className="report-print-hide flex items-center gap-1 text-xs font-medium text-amber-700 whitespace-nowrap">
                  {showExcluded ? t.excludedHide : t.excludedShow}
                  <ChevronDown size={13} className={showExcluded ? 'rotate-180' : ''} />
                </button>
              </div>
              <ul className={cn('mt-2 space-y-1 text-xs text-amber-700 list-disc pl-4', showExcluded ? 'block' : 'hidden print:block')}>
                {excluded.map(m => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}

          {report.isEmpty ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
              <BarChart3 size={28} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">{t.emptyTitle}</p>
              <p className="text-xs text-gray-400">{t.emptyDesc}</p>
            </div>
          ) : (
            <>
              <div className="report-print-hide flex flex-wrap gap-1.5" role="tablist">
                {REPORT_TABS.map(k => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                      tab === k ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                    {tabLabel[k]}
                  </button>
                ))}
              </div>
              {REPORT_TABS.map(k => (
                <section key={k} className={cn(tab === k ? 'block' : 'hidden print:block')} aria-label={tabLabel[k]}>
                  <h2 className="hidden print:block text-sm font-bold text-gray-900 mt-4 mb-2">{tabLabel[k]}</h2>
                  {k === 'summary' && <SummarySection report={report} t={t} locale={locale} />}
                  {k === 'performance' && <PerformanceSection report={report} t={t} locale={locale} />}
                  {k === 'activity' && <ActivitySection report={report} t={t} locale={locale} />}
                  {k === 'companies' && <CompaniesSection report={report} t={t} locale={locale} />}
                </section>
              ))}
            </>
          )}

          <MethodologyPanel t={t} />
        </div>
      )}

      {saveOpen && report && (
        <SaveViewModal key={loaded?.id ?? 'new'} initialName={loaded?.name ?? ''} loadedView={loaded}
          saving={saving} error={saveError} t={t} onSave={(n, id) => void saveView(n, id)}
          onClose={() => { if (!saving) setSaveOpen(false); }} />
      )}
      {generating && !loading && (
        <div className="fixed bottom-4 right-4 report-print-hide flex items-center gap-2 bg-black text-white text-xs px-3 py-2 rounded-xl shadow-lg" role="status">
          <Loader2 size={13} className="animate-spin" /> {t.generating}
        </div>
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

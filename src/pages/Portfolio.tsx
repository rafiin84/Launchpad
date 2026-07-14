import React, { useState, useEffect, useRef } from 'react';
import { CompanyLogo } from '../components/ui/CompanyLogo';
import {
  TrendingUp,
  Building2,
  Plus,
  MapPin,
  Calendar,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  List,
  Search,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { usePageTitle } from '../context/PageTitleContext';
import { fetchCRMPortfolio, deleteCRMPortfolioRecord, setPortfolioModuleOverride, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { fetchZohoModules, type ZohoModule } from '../services/zohoApi';
import { fetchAllCompanyProfiles } from '../services/companyProfile';
import { loadToken } from '../services/oauth';
import { cn } from '../lib/cn';
import { useLanguage } from '../context/LanguageContext';

// ─── CRM Company Card ────────────────────────────────────────────────────────

function CRMCompanyCard({ c, onDelete, logoUrl }: { c: CRMPortfolioRecord; onDelete: (id: string) => void; logoUrl?: string }) {
  const { t, language } = useLanguage();
  const amount = parseFloat(c.investmentAmount) || 0;
  const statusColors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    exited: 'bg-indigo-50 text-indigo-700',
    'written-off': 'bg-red-50 text-red-600',
    'follow-on': 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <Link to={`/portfolio/${c.id}`} className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
          <CompanyLogo name={c.companyName || '?'} website={c.website} logoUrl={logoUrl} size={10} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{c.companyName}</p>
            <p className="text-xs text-gray-400 capitalize">{c.industry}{c.stage ? ` · ${c.stage}` : ''}</p>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {c.status && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
            </span>
          )}
          <Link
            to={`/portfolio/${c.id}/edit`}
            className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
            title={t.common.edit}
          >
            <Pencil size={13} />
          </Link>
          <button
            onClick={() => onDelete(c.id)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title={t.common.delete}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <Link to={`/portfolio/${c.id}`} className="block cursor-pointer">
        {c.shortDescription && <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">{c.shortDescription}</p>}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
          <div>
            <p className="text-xs text-gray-400">{t.portfolioPage.invested}</p>
            <p className="text-sm font-bold text-gray-900">{amount >= 1000000 ? `$${(amount/1000000).toFixed(1)}M` : amount >= 1000 ? `$${(amount/1000).toFixed(0)}K` : `$${amount}`}</p>
          </div>
          {c.ownershipPct && (
            <div>
              <p className="text-xs text-gray-400">{t.portfolioPage.ownership}</p>
              <p className="text-sm font-bold text-gray-900">{c.ownershipPct}%</p>
            </div>
          )}
        </div>
        {(c.location || c.investmentDate) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            {c.location && <span className="flex items-center gap-1"><MapPin size={10} />{c.location}</span>}
            {c.investmentDate && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(c.investmentDate).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', year: 'numeric' })}</span>}
          </div>
        )}
      </Link>
    </div>
  );
}

// ─── Portfolio List Table ─────────────────────────────────────────────────────

function PortfolioTable({ companies, onDelete, logoMap }: { companies: CRMPortfolioRecord[]; onDelete: (id: string) => void; logoMap: Record<string, string> }) {
  const { t } = useLanguage();
  const statusColors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    exited: 'bg-indigo-50 text-indigo-700',
    'written-off': 'bg-red-50 text-red-600',
    'follow-on': 'bg-amber-50 text-amber-700',
  };

  function fmtAmount(val: string) {
    const amount = parseFloat(val) || 0;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return amount ? `$${amount}` : '—';
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3.5 w-52">{t.portfolioPage.company}</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-40">{t.portfolioPage.industryStage}</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-32">{t.portfolioPage.status}</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5 w-28">{t.portfolioPage.invested}</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5 w-28">{t.portfolioPage.ownershipPct}</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-36">{t.portfolioPage.location}</th>
              <th className="px-4 py-3.5 w-20" />
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr
                key={c.id}
                className="group border-b border-gray-50 hover:bg-gray-50/60 transition-colors last:border-0"
              >
                {/* Logo + Name */}
                <td className="px-5 py-4">
                  <Link to={`/portfolio/${c.id}`} className="flex items-center gap-3">
                    <CompanyLogo name={c.companyName || '?'} website={c.website} logoUrl={logoMap[c.founderEmail?.toLowerCase() || ''] || logoMap[c.companyName?.toLowerCase() || '']} size={8} />
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.companyName}</p>
                  </Link>
                </td>

                {/* Industry / Stage */}
                <td className="px-4 py-4">
                  <p className="text-xs text-gray-700 truncate capitalize">{c.industry || '—'}</p>
                  {c.stage && <p className="text-xs text-gray-400 truncate capitalize">{c.stage}</p>}
                </td>

                {/* Status */}
                <td className="px-4 py-4">
                  {c.status ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>

                {/* Invested */}
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-semibold text-gray-900">{fmtAmount(c.investmentAmount)}</span>
                </td>

                {/* Ownership */}
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-semibold text-gray-900">{c.ownershipPct ? `${c.ownershipPct}%` : '—'}</span>
                </td>

                {/* Location */}
                <td className="px-4 py-4">
                  <span className="text-xs text-gray-600">{c.location || '—'}</span>
                </td>

                {/* Actions */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Link
                      to={`/portfolio/${c.id}/edit`}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                      title={t.common.edit}
                    >
                      <Pencil size={13} />
                    </Link>
                    <button
                      onClick={() => onDelete(c.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title={t.common.delete}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const { t, language } = useLanguage();
  const { setPageTitle } = usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get('view') as 'grid' | 'list') || 'list';
  const setView = (v: 'grid' | 'list') =>
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('view', v); return p; });
  const [crmCompanies, setCrmCompanies] = useState<CRMPortfolioRecord[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState('');
  const [availableModules, setAvailableModules] = useState<ZohoModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [logoMap, setLogoMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const isConnected = !!loadToken();

  // Ref for the Portfolio Companies section
  const companiesSectionRef = useRef<HTMLDivElement>(null);

  const loadCRMData = () => {
    if (!isConnected) { setCrmLoading(false); return; }
    setCrmLoading(true);
    setCrmError('');
    fetchCRMPortfolio()
      .then(data => { setCrmCompanies(data); setAvailableModules([]); })
      .catch(err => setCrmError(err instanceof Error ? err.message : 'Failed to load CRM data'))
      .finally(() => setCrmLoading(false));
  };

  const handleFetchModules = () => {
    setModulesLoading(true);
    fetchZohoModules()
      .then(setAvailableModules)
      .catch(err => setCrmError(err instanceof Error ? err.message : 'Could not load module list'))
      .finally(() => setModulesLoading(false));
  };

  const handleSelectModule = (apiName: string) => {
    setPortfolioModuleOverride(apiName);
    setAvailableModules([]);
    setCrmError('');
    loadCRMData();
  };

  useEffect(() => { setPageTitle(t.nav.portfolio, t.portfolioPage.description); return () => setPageTitle(null); }, [t]);

  useEffect(() => {
    loadCRMData();
    fetchAllCompanyProfiles().then(profiles => {
      const map: Record<string, string> = {};
      for (const p of profiles) {
        if (p.logo && p.email) map[p.email.toLowerCase()] = p.logo;
        if (p.logo && p.data.name) map[p.data.name.toLowerCase()] = p.logo;
      }
      setLogoMap(map);
    }).catch(() => {});
  }, []);

  const handleDeleteCRM = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await deleteCRMPortfolioRecord(pendingDeleteId);
      setCrmCompanies(prev => prev.filter(c => c.id !== pendingDeleteId));
    } catch (err) {
      setCrmError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {pendingDeleteId !== null && (
        <DeleteConfirmModal
          title={t.portfolioPage.deleteTitle}
          message={t.portfolioPage.deleteMessage}
          onConfirm={handleDeleteCRM}
          onCancel={() => setPendingDeleteId(null)}
          deleting={deleting}
        />
      )}
      {/* Action bar */}
      <div className="w-full flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t.portfolioPage.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
          />
        </div>
        <div className="hidden sm:flex items-center gap-2 ml-auto">
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-2 transition-colors ${view === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}
              title={t.portfolioPage.gridView}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}
              title={t.portfolioPage.listView}
            >
              <List size={15} />
            </button>
          </div>
          <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
            <Plus size={15} /> {t.investorDashboard.addCompany}
          </Link>
        </div>
      </div>

      {/* Everything else constrained to max-w-5xl */}
      <div className="w-full">
        {/* Portfolio companies */}
        <div ref={companiesSectionRef} className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">{t.portfolioPage.portfolioCompanies}</h2>
          {isConnected && (
            <button
              onClick={loadCRMData}
              disabled={crmLoading}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              <RefreshCw size={12} className={crmLoading ? 'animate-spin' : ''} />
              {crmLoading ? t.common.loading : t.portfolioPage.refresh}
            </button>
          )}
        </div>

        {/* Not connected notice */}
        {!isConnected && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-4">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">{t.portfolioPage.connectCRM}</p>
              <p className="text-xs text-amber-600 mt-0.5">{t.portfolioPage.connectCRMDesc}</p>
            </div>
            <Link to="/login" className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
              {t.portfolioPage.connect}
            </Link>
          </div>
        )}

        {/* CRM error + module picker */}
        {crmError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 mb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-red-700">{crmError}</p>
              </div>
              {availableModules.length === 0 && (
                <button
                  onClick={handleFetchModules}
                  disabled={modulesLoading}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {modulesLoading
                    ? <><Loader2 size={12} className="animate-spin" /> {t.common.loading}…</>
                    : <><RefreshCw size={12} /> {t.portfolioPage.showMyModules}</>}
                </button>
              )}
            </div>

            {availableModules.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-3">
                  {t.portfolioPage.selectModule}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {availableModules.map(m => (
                    <button
                      key={m.api_name}
                      onClick={() => handleSelectModule(m.api_name)}
                      className="text-left bg-white border border-red-100 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl px-3 py-2.5 transition-all group"
                    >
                      <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-indigo-700">
                        {m.plural_label || m.module_name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">{m.api_name}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-red-400 mt-3">
                  {t.portfolioPage.selectionSaved}
                </p>
              </div>
            )}
          </div>
        )}

        {/* CRM loading skeleton */}
        {crmLoading && crmCompanies.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-2.5 bg-gray-100 rounded w-full mb-2" />
                <div className="h-2.5 bg-gray-100 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}

        {(() => {
          const q = search.toLowerCase().trim();
          const filtered = q
            ? crmCompanies.filter(c =>
                [c.companyName, c.industry, c.stage, c.location, c.founderName, c.tags]
                  .some(f => f?.toLowerCase().includes(q))
              )
            : crmCompanies;
          return view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(c => (
                <CRMCompanyCard key={c.id} c={c} onDelete={setPendingDeleteId} logoUrl={logoMap[c.founderEmail?.toLowerCase() || ''] || logoMap[c.companyName?.toLowerCase() || '']} />
              ))}
            </div>
          ) : (
            filtered.length > 0 && (
              <PortfolioTable companies={filtered} onDelete={setPendingDeleteId} logoMap={logoMap} />
            )
          );
        })()}

        {isConnected && !crmLoading && crmCompanies.length === 0 && !crmError && (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center mt-4">
            <Building2 size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 mb-1">{t.investorDashboard.noPortfolioCompanies}</p>
            <p className="text-xs text-gray-400 mb-4">{t.portfolioPage.noCompaniesDesc}</p>
            <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
              <Plus size={14} /> {t.investorDashboard.addCompany}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

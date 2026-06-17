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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { fetchCRMPortfolio, deleteCRMPortfolioRecord, setPortfolioModuleOverride, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { fetchZohoModules, type ZohoModule } from '../services/zohoApi';
import { loadToken } from '../services/oauth';

// ─── CRM Company Card ────────────────────────────────────────────────────────

function CRMCompanyCard({ c, onDelete }: { c: CRMPortfolioRecord; onDelete: (id: string) => void }) {
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
          <CompanyLogo name={c.companyName || '?'} website={c.website} size={10} />
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
            title="Edit"
          >
            <Pencil size={13} />
          </Link>
          <button
            onClick={() => onDelete(c.id)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <Link to={`/portfolio/${c.id}`} className="block cursor-pointer">
        {c.shortDescription && <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">{c.shortDescription}</p>}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
          <div>
            <p className="text-xs text-gray-400">Invested</p>
            <p className="text-sm font-bold text-gray-900">{amount >= 1000000 ? `$${(amount/1000000).toFixed(1)}M` : amount >= 1000 ? `$${(amount/1000).toFixed(0)}K` : `$${amount}`}</p>
          </div>
          {c.ownershipPct && (
            <div>
              <p className="text-xs text-gray-400">Ownership</p>
              <p className="text-sm font-bold text-gray-900">{c.ownershipPct}%</p>
            </div>
          )}
        </div>
        {(c.location || c.investmentDate) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            {c.location && <span className="flex items-center gap-1"><MapPin size={10} />{c.location}</span>}
            {c.investmentDate && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(c.investmentDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
          </div>
        )}
      </Link>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const [crmCompanies, setCrmCompanies] = useState<CRMPortfolioRecord[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState('');
  const [availableModules, setAvailableModules] = useState<ZohoModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  useEffect(() => { loadCRMData(); }, []);

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
          title="Delete Portfolio Company"
          message="Are you sure you want to delete this company record? This action cannot be undone."
          onConfirm={handleDeleteCRM}
          onCancel={() => setPendingDeleteId(null)}
          deleting={deleting}
        />
      )}
      {/* Constrained header */}
      <div className="w-full">
        <PageHeader
          title="Portfolio"
          description="Your invested companies and portfolio performance"
          action={
            <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
              <Plus size={15} /> Add Company
            </Link>
          }
        />
      </div>

      {/* Everything else constrained to max-w-5xl */}
      <div className="w-full">
        {/* Portfolio companies */}
        <div ref={companiesSectionRef} className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Portfolio Companies</h2>
          {isConnected && (
            <button
              onClick={loadCRMData}
              disabled={crmLoading}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              <RefreshCw size={12} className={crmLoading ? 'animate-spin' : ''} />
              {crmLoading ? 'Loading…' : 'Refresh'}
            </button>
          )}
        </div>

        {/* Not connected notice */}
        {!isConnected && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-4">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">Connect Zoho CRM to see live portfolio data</p>
              <p className="text-xs text-amber-600 mt-0.5">Go to Login page and click "Sign in with Zoho CRM".</p>
            </div>
            <Link to="/login" className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
              Connect
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
                    ? <><Loader2 size={12} className="animate-spin" /> Loading…</>
                    : <><RefreshCw size={12} /> Show my modules</>}
                </button>
              )}
            </div>

            {availableModules.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-3">
                  Click the correct module below to connect it as your Portfolio module:
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
                  This saves your selection. The app will retry immediately.
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {crmCompanies.map(c => (
            <CRMCompanyCard key={c.id} c={c} onDelete={setPendingDeleteId} />
          ))}
        </div>

        {isConnected && !crmLoading && crmCompanies.length === 0 && !crmError && (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center mt-4">
            <Building2 size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 mb-1">No records in Zoho CRM yet</p>
            <p className="text-xs text-gray-400 mb-4">Add your first portfolio company to sync it to your CRM.</p>
            <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
              <Plus size={14} /> Add Company
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

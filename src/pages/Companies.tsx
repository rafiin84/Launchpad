import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Calendar, Plus, AlertCircle, RefreshCw, Building2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchCRMPortfolio, deleteCRMPortfolioRecord, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { loadToken } from '../services/oauth';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/layout/PageHeader';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';

const STAGE_STYLES: Record<string, string> = {
  'Pre-Seed': 'bg-gray-100 text-gray-600',
  'Seed':     'bg-violet-50 text-violet-700',
  'Series A': 'bg-blue-50 text-blue-700',
  'Series B': 'bg-indigo-50 text-indigo-700',
  'Series C': 'bg-sky-50 text-sky-700',
  'Growth':   'bg-emerald-50 text-emerald-700',
};

function CompanyCard({ company, onDelete }: { company: CRMPortfolioRecord; onDelete: (id: string) => void }) {
  const tags = company.tags ? company.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <Link to={`/portfolio/${company.id}`} className="block">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-sm transition-all group relative">
        {/* Delete button */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(company.id); }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
            <Building2 size={20} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {company.companyName || '—'}
              </h3>
              {company.stage && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_STYLES[company.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                  {company.stage}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">{company.industry || '—'}</p>
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
              {company.shortDescription || company.fullDescription || '—'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 pt-3 border-t border-gray-50">
          {company.location && (
            <span className="text-xs text-gray-500">{company.location}</span>
          )}
          {company.foundedYear && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar size={13} />
              Founded {company.foundedYear}
            </div>
          )}
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 ml-auto"
            >
              <ExternalLink size={12} />
              Website
            </a>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

const STAGE_FILTERS = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth'];

export default function Companies() {
  const [companies, setCompanies] = useState<CRMPortfolioRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isConnected = !!loadToken();

  const load = () => {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true);
    setError('');
    fetchCRMPortfolio()
      .then(setCompanies)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await deleteCRMPortfolioRecord(pendingDeleteId);
      setCompanies(prev => prev.filter(c => c.id !== pendingDeleteId));
    } catch {
      // swallow
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  const filtered = query
    ? companies.filter(
        c =>
          c.companyName.toLowerCase().includes(query.toLowerCase()) ||
          c.industry.toLowerCase().includes(query.toLowerCase()) ||
          c.tags.toLowerCase().includes(query.toLowerCase()) ||
          c.stage.toLowerCase().includes(query.toLowerCase())
      )
    : companies;

  return (
    <div className="max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      {pendingDeleteId !== null && (
        <DeleteConfirmModal
          title="Delete Company"
          message="Are you sure you want to delete this company? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setPendingDeleteId(null)}
          deleting={deleting}
        />
      )}
      <PageHeader
        title="Portfolio Companies"
        description="The founders and companies in our network"
        action={
          <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
            <Plus size={15} /> Add Company
          </Link>
        }
      />

      {/* Not-connected banner */}
      {!isConnected && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Connect Zoho CRM to see live data</p>
            <p className="text-xs text-amber-600 mt-0.5">Go to Login and sign in with Zoho CRM.</p>
          </div>
          <Link to="/login" className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">Connect</Link>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search by name, industry, or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Search size={16} />}
        />
      </div>

      {/* Stage filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setQuery('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${!query ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All
        </button>
        {STAGE_FILTERS.map((stage) => (
          <button
            key={stage}
            onClick={() => setQuery(stage)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
          >
            {stage}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && isConnected && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
          <Building2 size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No companies yet</p>
          <p className="text-xs text-gray-400 mb-4">Add your first portfolio company to get started.</p>
          <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Plus size={14} /> Add Company
          </Link>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <p className="text-xs text-gray-500 mb-4">{filtered.length} companies</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((company) => (
              <CompanyCard key={company.id} company={company} onDelete={setPendingDeleteId} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

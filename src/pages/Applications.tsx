import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Inbox, Search, ArrowUpRight, ChevronRight,
  AlertCircle, Plus, Building2, Trash2, RefreshCw,
} from 'lucide-react';
import { fetchCRMApplications, deleteCRMApplication, type CRMApplication } from '../services/crmApplications';
import { loadToken } from '../services/oauth';
import { PageHeader } from '../components/layout/PageHeader';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const PIPELINE_STAGES: { id: string; label: string; color: string; bg: string }[] = [
  { id: 'New',                  label: 'New',               color: '#6b7280', bg: '#f9fafb' },
  { id: 'Under Review',         label: 'Under Review',      color: '#3b82f6', bg: '#eff6ff' },
  { id: 'Meeting Scheduled',    label: 'Meeting Scheduled', color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'Due Diligence',        label: 'Due Diligence',     color: '#f59e0b', bg: '#fffbeb' },
  { id: 'IC Review',            label: 'IC Review',         color: '#10b981', bg: '#ecfdf5' },
  { id: 'Rejected',             label: 'Rejected',          color: '#ef4444', bg: '#fef2f2' },
];

function StagePill({ stage }: { stage: string }) {
  const s = PIPELINE_STAGES.find(p => p.id === stage);
  if (!s) {
    return <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{stage || '—'}</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

// ─── Applications Table ───────────────────────────────────────────────────────

function ApplicationsTable({ apps, onDelete }: { apps: CRMApplication[]; onDelete: (id: string) => void }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3.5 w-48">Company</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-40">Founder</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-44">Contact</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">What they're building</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-36">Stage</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5 w-28">Ask</th>
              <th className="px-4 py-3.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr
                key={app.id}
                className="group border-b border-gray-50 hover:bg-gray-50/60 transition-colors last:border-0 cursor-pointer"
                onClick={() => navigate(`/applications/${app.id}`)}
              >
                {/* Company */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      <Building2 size={14} className="text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{app.companyName || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{app.industry || '—'}</p>
                    </div>
                  </div>
                </td>

                {/* Founder */}
                <td className="px-4 py-4">
                  <p className="text-sm font-medium text-gray-900 truncate">{app.founderName || '—'}</p>
                  <p className="text-xs text-gray-400 truncate">{app.location || '—'}</p>
                </td>

                {/* Contact */}
                <td className="px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 truncate">{app.founderEmail || '—'}</p>
                    {app.website && (
                      <a
                        href={app.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:text-indigo-700 truncate flex items-center gap-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        {app.website.replace(/^https?:\/\//, '')}
                        <ArrowUpRight size={10} />
                      </a>
                    )}
                  </div>
                </td>

                {/* Description */}
                <td className="px-4 py-4">
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {app.companyDescription || app.useOfFunds || '—'}
                  </p>
                </td>

                {/* Stage */}
                <td className="px-4 py-4">
                  <StagePill stage={app.pipelineStage} />
                </td>

                {/* Ask */}
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {app.fundingAsk ? formatCurrency(parseFloat(app.fundingAsk)) : '—'}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-400">
                      <ChevronRight size={14} />
                    </div>
                    <button
                      onClick={() => onDelete(app.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
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

export default function Applications() {
  const [records, setRecords] = useState<CRMApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isConnected = !!loadToken();

  const load = () => {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true);
    setError('');
    fetchCRMApplications()
      .then(setRecords)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await deleteCRMApplication(pendingDeleteId);
      setRecords(prev => prev.filter(r => r.id !== pendingDeleteId));
    } catch {
      // swallow
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  const filtered = query
    ? records.filter(a =>
        a.companyName.toLowerCase().includes(query.toLowerCase()) ||
        a.industry.toLowerCase().includes(query.toLowerCase()) ||
        a.founderName.toLowerCase().includes(query.toLowerCase())
      )
    : records;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {pendingDeleteId !== null && (
        <DeleteConfirmModal
          title="Delete Application"
          message="Are you sure you want to delete this application? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setPendingDeleteId(null)}
          deleting={deleting}
        />
      )}
      <div className="w-full">
        <PageHeader
          title="Applications"
          description="Manage your deal pipeline from first look to committee"
          action={
            <Link to="/applications/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
              <Plus size={15} /> Add Application
            </Link>
          }
        />
      </div>

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

      {/* Table section */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">
            All Applications
            <span className="ml-2 text-xs font-medium text-gray-400">{filtered.length}</span>
          </h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies, founders..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 w-64"
            />
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
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
            <Inbox size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 mb-1">No applications yet</p>
            <p className="text-xs text-gray-400 mb-4">Add your first application to get started.</p>
            <Link to="/applications/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl">
              <Plus size={14} /> Add Application
            </Link>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <ApplicationsTable apps={filtered} onDelete={setPendingDeleteId} />
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Inbox, Search, ArrowUpRight, ChevronRight,
  AlertCircle, Plus, Building2, Trash2, RefreshCw,
  LayoutGrid, List, Video,
} from 'lucide-react';
import { fetchCRMApplications, deleteCRMApplication, type CRMApplication } from '../services/crmApplications';
import { loadPitchVideoUrl, hasPitchVideo, videoWasUploaded } from '../lib/pitchVideoStore';
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

// ─── Video helpers ────────────────────────────────────────────────────────────

/** Small inline indicator shown in list rows when a video exists */
function VideoBadge({ appId, videoUrl }: { appId: string; videoUrl: string }) {
  const [has, setHas] = useState(() => !!videoUrl || videoWasUploaded(appId));

  useEffect(() => {
    if (has) return;
    hasPitchVideo(appId).then(setHas).catch(() => {});
  }, [appId, has]);

  if (!has) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full ml-1.5">
      <Video size={9} /> Video
    </span>
  );
}

/** YouTube thumbnail that expands to an iframe on click (no page navigation) */
function YoutubeMiniPlayer({ ytId }: { ytId: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div
      className="mt-3 rounded-xl overflow-hidden bg-black h-36 relative"
      onClick={e => { e.stopPropagation(); setPlaying(true); }}
    >
      {playing ? (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <>
          <img
            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
            alt="Video thumbnail"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow">
              <Video size={14} className="text-gray-800 ml-0.5" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Mini video preview for grid cards — blob player, YouTube thumbnail, or re-upload prompt */
function VideoPreviewMini({ appId, videoUrl }: { appId: string; videoUrl: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    loadPitchVideoUrl(appId)
      .then(url => {
        if (cancelled.current) { if (url) URL.revokeObjectURL(url); return; }
        objectUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled.current) setChecked(true); });
    return () => {
      cancelled.current = true;
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    };
  }, [appId]);

  if (!checked) return null;

  // CRM URL video (YouTube etc.)
  const effective = blobUrl || videoUrl || '';
  if (effective && !effective.startsWith('blob:')) {
    try {
      const u = new URL(effective);
      if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
        const ytId = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
        if (ytId) return <YoutubeMiniPlayer ytId={ytId} />;
      }
    } catch { /* ignore */ }
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-indigo-600" onClick={e => e.stopPropagation()}>
        <Video size={12} /> Pitch video attached
      </div>
    );
  }

  // Local blob — playable inline
  if (blobUrl) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden bg-black h-36" onClick={e => e.stopPropagation()}>
        <video src={blobUrl} controls className="w-full h-full object-contain" playsInline />
      </div>
    );
  }

  // Blob was uploaded in this browser (localStorage flag) but not in IndexedDB anymore
  // (e.g. different origin / storage cleared) — show re-upload prompt
  if (videoWasUploaded(appId)) {
    return (
      <div
        className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
        onClick={e => e.stopPropagation()}
      >
        <Video size={12} className="flex-shrink-0" />
        <span>Video stored locally — <Link to={`/applications/${appId}/edit`} className="underline font-medium">re-upload</Link> to view here.</span>
      </div>
    );
  }

  return null;
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
                  <div className="flex items-center flex-wrap gap-1">
                    <StagePill stage={app.pipelineStage} />
                    <VideoBadge appId={app.id} videoUrl={app.pitchVideoUrl} />
                  </div>
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

// ─── Applications Grid ────────────────────────────────────────────────────────

function ApplicationsGrid({ apps, onDelete }: { apps: CRMApplication[]; onDelete: (id: string) => void }) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {apps.map(app => (
        <div
          key={app.id}
          className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-all cursor-pointer"
          onClick={() => navigate(`/applications/${app.id}`)}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
              <Building2 size={16} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{app.companyName || '—'}</p>
              <p className="text-xs text-gray-400 truncate">{app.industry || '—'}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(app.id); }}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-medium text-gray-700">{app.founderName || '—'}</p>
              {app.location && <p className="text-xs text-gray-400">{app.location}</p>}
            </div>
            <StagePill stage={app.pipelineStage} />
          </div>

          {app.fundingAsk && (
            <p className="text-xs text-gray-500 mb-2">
              Asking <span className="font-semibold text-gray-800">{formatCurrency(parseFloat(app.fundingAsk))}</span>
            </p>
          )}

          {(app.companyDescription || app.useOfFunds) && (
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
              {app.companyDescription || app.useOfFunds}
            </p>
          )}

          <VideoPreviewMini appId={app.id} videoUrl={app.pitchVideoUrl} />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Applications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get('view') as 'grid' | 'list') || 'grid';
  const setView = (v: 'grid' | 'list') =>
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('view', v); return p; });
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
            <div className="hidden sm:flex items-center gap-2 ml-auto">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setView('grid')}
                  className={`p-2 transition-colors ${view === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Grid view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2 transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                  title="List view"
                >
                  <List size={15} />
                </button>
              </div>
              {/* Mobile: icon only; Desktop: full label */}
              <Link
                to="/applications/new"
                className="inline-flex items-center justify-center gap-2 bg-black text-white font-medium rounded-xl hover:bg-gray-800 transition-colors px-3 py-2 sm:px-4"
                title="Add Application"
              >
                <Plus size={15} />
                <span className="hidden sm:inline text-sm">Add Application</span>
              </Link>
            </div>
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
              id="app-search"
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
          view === 'list'
            ? <ApplicationsTable apps={filtered} onDelete={setPendingDeleteId} />
            : <ApplicationsGrid apps={filtered} onDelete={setPendingDeleteId} />
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Mail, MapPin, Users, Phone,
  DollarSign, TrendingUp, ExternalLink, Building2,
  Link2, Trash2, Calendar, Briefcase, FileText, CheckCircle, Edit2, Video,
} from 'lucide-react';
import { getCRMApplication, deleteCRMApplication, type CRMApplication } from '../services/crmApplications';
import { loadPitchVideoUrl, videoWasUploaded } from '../lib/pitchVideoStore';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';

function formatCurrency(val: string) {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const PIPELINE_STAGES = [
  { id: 'New',               label: 'New',               color: '#6b7280' },
  { id: 'Under Review',      label: 'Under Review',      color: '#3b82f6' },
  { id: 'Meeting Scheduled', label: 'Meeting Scheduled', color: '#8b5cf6' },
  { id: 'Due Diligence',     label: 'Due Diligence',     color: '#f59e0b' },
  { id: 'IC Review',         label: 'IC Review',         color: '#10b981' },
];

const STAGE_COLOR: Record<string, string> = {
  'New':               '#6b7280',
  'Under Review':      '#3b82f6',
  'Meeting Scheduled': '#8b5cf6',
  'Due Diligence':     '#f59e0b',
  'IC Review':         '#10b981',
  'Rejected':          '#ef4444',
};

function StageTimeline({ current }: { current: string }) {
  const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === current);
  const isRejected  = current === 'Rejected';
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Application Progress</h3>
      <div className="flex items-center gap-1">
        {PIPELINE_STAGES.map((stage, i) => {
          const isPast   = currentIdx > i;
          const isActive = currentIdx === i;
          return (
            <div key={stage.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-all flex-shrink-0"
                  style={{
                    backgroundColor: isPast || isActive ? stage.color : '#f3f4f6',
                    color: isPast || isActive ? 'white' : '#9ca3af',
                    boxShadow: isActive ? `0 0 0 3px ${stage.color}33` : undefined,
                  }}
                >
                  {isPast ? <CheckCircle size={13} /> : i + 1}
                </div>
                <span className="text-center text-[9px] leading-tight text-gray-400 max-w-[56px] truncate hidden sm:block">
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  className="h-0.5 flex-none w-4 mb-5 rounded-full"
                  style={{ backgroundColor: isPast ? stage.color : '#e5e7eb' }}
                />
              )}
            </div>
          );
        })}
      </div>
      {isRejected && (
        <div className="mt-3 px-3 py-2 bg-red-50 rounded-xl text-xs font-medium text-red-600 text-center">
          This application was not moved forward
        </div>
      )}
    </div>
  );
}

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (u.hostname.includes('loom.com') && u.pathname.includes('/share/')) {
      const id = u.pathname.split('/share/')[1]?.split('?')[0];
      return id ? `https://www.loom.com/embed/${id}` : null;
    }
    return null;
  } catch { return null; }
}

function Field({ icon, label, value, href }: { icon: React.ReactNode; label: string; value?: string; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-300 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-sm text-indigo-600 font-medium hover:underline inline-flex items-center gap-1">
            {value} <ExternalLink size={11} />
          </a>
        ) : (
          <p className="text-sm text-gray-800 font-medium">{value}</p>
        )}
      </div>
    </div>
  );
}

const TABS = ['Overview', 'Founder', 'Funding', 'Video'] as const;
type Tab = typeof TABS[number];

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [app, setApp]               = useState<CRMApplication | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [activeTab, setActiveTab]   = useState<Tab>('Overview');

  useEffect(() => {
    if (!id) return;
    getCRMApplication(id)
      .then(r => { setApp(r); setLoading(false); })
      .catch(err => { setError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false); });
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteCRMApplication(id);
      navigate('/applications');
    } catch (err) {
      setDeleting(false);
      setShowDelete(false);
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full animate-pulse space-y-4">
      <div className="h-4 bg-gray-100 rounded w-32" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );

  if (error || !app) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
      <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 mb-6">
        <ArrowLeft size={15} /> Applications
      </Link>
      <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
        <Building2 size={28} className="text-red-300 mx-auto mb-3" />
        <p className="text-sm text-red-600">{error || 'Application not found'}</p>
      </div>
    </div>
  );

  const stageColor = STAGE_COLOR[app.pipelineStage] ?? '#6b7280';
  const fundingAsk = formatCurrency(app.fundingAsk);
  const prevFunding = formatCurrency(app.previousFunding);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
      {showDelete && (
        <DeleteConfirmModal
          title="Delete Application"
          message={`Are you sure you want to delete the application for "${app.companyName}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          deleting={deleting}
        />
      )}

      {/* Back link */}
      <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-4">
        <ArrowLeft size={15} /> Applications
      </Link>

      {/* ── Banner ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden mb-4">
        <div className="h-48 sm:h-60">
          <img
            src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?fm=jpg&q=80&w=1600&auto=format&fit=crop"
            alt="banner"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              (e.currentTarget.parentElement as HTMLElement).style.background = 'linear-gradient(135deg,#1e1b4b,#4338ca)';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>

        {/* Edit / Delete top-right */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Link
            to={`/applications/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-1.5 rounded-xl hover:bg-white/30 transition-colors"
          >
            <Edit2 size={13} /><span className="hidden sm:inline">Edit</span>
          </Link>
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-red-500/70 backdrop-blur-sm border border-red-400/30 px-3 py-1.5 rounded-xl hover:bg-red-500/90 transition-colors"
          >
            <Trash2 size={13} /><span className="hidden sm:inline">Delete</span>
          </button>
        </div>

        {/* Company logo — centred, straddling banner bottom */}
        <div className="absolute -bottom-6 left-6">
          <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center border-4 border-white">
            <Building2 size={30} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* Company name + badges — left-aligned */}
      <div className="mt-10 mb-6">
        <h1 className="text-xl font-bold text-gray-900">{app.companyName}</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {app.industry && <span className="text-sm text-gray-500">{app.industry}</span>}
          {app.location && <span className="text-sm text-gray-400">· {app.location}</span>}
          <span
            className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ color: stageColor, backgroundColor: `${stageColor}18` }}
          >
            {app.pipelineStage || 'New'}
          </span>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* LEFT — tabs */}
        <div className="lg:col-span-2 space-y-4">

          {/* Stage progress */}
          <StageTimeline current={app.pipelineStage} />

          {/* Tab bar */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="flex border-b border-gray-100">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-5">

              {/* ── Overview tab ── */}
              {activeTab === 'Overview' && (
                <div className="space-y-5">
                  {app.companyDescription ? (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">About the Company</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{app.companyDescription}</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <FileText size={28} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No description provided</p>
                    </div>
                  )}
                  {app.useOfFunds && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <DollarSign size={12} className="text-emerald-500" /> Use of Funds
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{app.useOfFunds}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Founder tab ── */}
              {activeTab === 'Founder' && (
                <div className="space-y-4">
                  {app.founderName ? (
                    <>
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-700 font-bold text-xl">
                            {app.founderName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-gray-900">{app.founderName}</p>
                          <p className="text-sm text-gray-500">Founder</p>
                        </div>
                      </div>
                      <Field icon={<Mail size={14} />}  label="Email"    value={app.founderEmail}
                        href={app.founderEmail ? `mailto:${app.founderEmail}` : undefined} />
                      <Field icon={<Phone size={14} />} label="Phone"    value={app.founderPhone}
                        href={app.founderPhone ? `tel:${app.founderPhone}` : undefined} />
                      <Field icon={<Link2 size={14} />} label="LinkedIn" value={app.founderLinkedin ? 'View Profile' : undefined}
                        href={app.founderLinkedin || undefined} />
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Users size={28} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No founder info provided</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Funding tab ── */}
              {activeTab === 'Funding' && (
                <div className="space-y-0">
                  {[
                    { label: 'Funding Ask',       value: fundingAsk,   icon: <DollarSign size={14} className="text-emerald-500" /> },
                    { label: 'Previous Funding',  value: prevFunding,  icon: <TrendingUp size={14} className="text-indigo-500" /> },
                    { label: 'Pipeline Stage',    value: app.pipelineStage || 'New', icon: <CheckCircle size={14} className="text-violet-500" /> },
                    { label: 'Founded Year',      value: app.foundedYear || '—', icon: <Calendar size={14} className="text-amber-500" /> },
                  ].map((row, i, arr) => (
                    <div key={row.label} className={`flex items-center justify-between py-3.5 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className="flex items-center gap-2.5 text-sm text-gray-600">
                        {row.icon}
                        {row.label}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{row.value}</span>
                    </div>
                  ))}
                  {app.useOfFunds && (
                    <div className="pt-4 mt-2 border-t border-gray-50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Use of Funds</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{app.useOfFunds}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Video tab ── */}
              {activeTab === 'Video' && (
                <PitchVideoCard appId={app.id} videoUrl={app.pitchVideoUrl} />
              )}

            </div>
          </div>

        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-4">

          {/* Key metrics */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Funding Ask',      value: fundingAsk,   color: 'bg-emerald-50 text-emerald-600' },
                { label: 'Prev. Funding',    value: prevFunding,  color: 'bg-indigo-50 text-indigo-600' },
                { label: 'Founded',          value: app.foundedYear || '—', color: 'bg-amber-50 text-amber-600' },
                { label: 'Team Size',        value: app.teamSize ? `${app.teamSize}` : '—', color: 'bg-violet-50 text-violet-600' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-3 ${s.color.split(' ')[0]}`}>
                  <p className={`text-lg font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Company details */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Company Info</h3>
            <div className="space-y-3">
              <Field icon={<Globe size={14} />}     label="Website"  value={app.website}
                href={app.website ? (app.website.startsWith('http') ? app.website : `https://${app.website}`) : undefined} />
              <Field icon={<MapPin size={14} />}    label="Location" value={app.location} />
              <Field icon={<Briefcase size={14} />} label="Industry" value={app.industry} />
              <Field icon={<Calendar size={14} />}  label="Founded"  value={app.foundedYear} />
              <Field icon={<Users size={14} />}     label="Team"     value={app.teamSize ? `${app.teamSize} people` : undefined} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function PitchVideoCard({ appId, videoUrl }: { appId: string; videoUrl: string }) {
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    loadPitchVideoUrl(appId)
      .then(url => { objectUrlRef.current = url; setLocalUrl(url); })
      .catch(() => setLocalUrl(null))
      .finally(() => setLoadingLocal(false));
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, [appId]);

  if (loadingLocal) return <div className="h-8 animate-pulse bg-gray-50 rounded-xl" />;

  const effectiveUrl = localUrl || videoUrl || '';

  if (!effectiveUrl && videoWasUploaded(appId)) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
        <Video size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Video not available in this browser</p>
          <p className="text-xs text-amber-600 mt-0.5">
            The pitch video was uploaded on a different browser or device. Please{' '}
            <Link to={`/applications/${appId}/edit`} className="underline font-medium">edit this application</Link>
            {' '}to re-upload or add a YouTube/Vimeo URL.
          </p>
        </div>
      </div>
    );
  }

  if (!effectiveUrl) return (
    <div className="text-center py-8 text-gray-400">
      <Video size={28} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">No pitch video uploaded yet</p>
      <Link to={`/applications/${appId}/edit`} className="text-xs text-indigo-500 hover:underline mt-1 inline-block">
        Add a video
      </Link>
    </div>
  );

  const isBlob   = effectiveUrl.startsWith('blob:');
  const embedUrl = isBlob ? null : toEmbedUrl(effectiveUrl);

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden bg-black aspect-video">
        {isBlob || !embedUrl ? (
          <video src={effectiveUrl} controls className="w-full h-full object-contain" />
        ) : (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
      {!isBlob && (
        <a href={effectiveUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
          <ExternalLink size={11} /> Open in new tab
        </a>
      )}
    </div>
  );
}

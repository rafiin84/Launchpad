import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Mail, MapPin, Users, Phone,
  DollarSign, TrendingUp, ExternalLink, Building2,
  Link2, Trash2, Calendar, Briefcase, FileText, CheckCircle, Edit2, Video,
} from 'lucide-react';
import { getCRMApplication, deleteCRMApplication, type CRMApplication } from '../services/crmApplications';
import { loadPitchVideoUrl } from '../lib/pitchVideoStore';
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
    <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
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

/** Convert a YouTube/Vimeo/Loom watch URL → embed URL */
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    const ytId = u.searchParams.get('v') || u.pathname.split('/').pop();
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    // Loom
    if (u.hostname.includes('loom.com') && u.pathname.includes('/share/')) {
      const id = u.pathname.split('/share/')[1]?.split('?')[0];
      return id ? `https://www.loom.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
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

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [app, setApp]               = useState<CRMApplication | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);

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

  /* ── Loading ── */
  if (loading) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl animate-pulse space-y-4">
      <div className="h-4 bg-gray-100 rounded w-32" />
      <div className="h-40 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );

  /* ── Error / Not found ── */
  if (error || !app) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl">
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
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl">
      {showDelete && (
        <DeleteConfirmModal
          title="Delete Application"
          message={`Are you sure you want to delete the application for "${app.companyName}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          deleting={deleting}
        />
      )}

      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft size={15} /> Applications
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/applications/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Edit2 size={14} /> Edit
          </Link>
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Building2 size={22} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{app.companyName}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {app.industry}{app.location ? ` · ${app.location}` : ''}
                </p>
              </div>
              <span
                className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ color: stageColor, backgroundColor: `${stageColor}18` }}
              >
                {app.pipelineStage || 'New'}
              </span>
            </div>
            {app.companyDescription && (
              <p className="text-sm text-gray-600 leading-relaxed mt-3">{app.companyDescription}</p>
            )}
          </div>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-50">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Funding Ask</p>
            <p className="text-lg font-bold text-gray-900">{fundingAsk}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Previous Funding</p>
            <p className="text-lg font-bold text-gray-900">{prevFunding}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Founded</p>
            <p className="text-lg font-bold text-gray-900">{app.foundedYear || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Team Size</p>
            <p className="text-lg font-bold text-gray-900">{app.teamSize ? `${app.teamSize} people` : '—'}</p>
          </div>
        </div>
      </div>

      {/* Stage timeline */}
      <StageTimeline current={app.pipelineStage} />

      {/* Two-column detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Founder info */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Founder Information</h3>
          <div className="space-y-3">
            <Field icon={<Users size={14} />}    label="Founder Name"  value={app.founderName} />
            <Field icon={<Mail size={14} />}     label="Email"         value={app.founderEmail}
              href={app.founderEmail ? `mailto:${app.founderEmail}` : undefined} />
            <Field icon={<Phone size={14} />}    label="Phone"         value={app.founderPhone}
              href={app.founderPhone ? `tel:${app.founderPhone}` : undefined} />
            <Field icon={<Link2 size={14} />}    label="LinkedIn"      value={app.founderLinkedin ? 'View Profile' : undefined}
              href={app.founderLinkedin || undefined} />
          </div>
        </div>

        {/* Company details */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Company Details</h3>
          <div className="space-y-3">
            <Field icon={<Globe size={14} />}      label="Website"   value={app.website}
              href={app.website ? (app.website.startsWith('http') ? app.website : `https://${app.website}`) : undefined} />
            <Field icon={<MapPin size={14} />}     label="Location"  value={app.location} />
            <Field icon={<Briefcase size={14} />}  label="Industry"  value={app.industry} />
            <Field icon={<Calendar size={14} />}   label="Founded"   value={app.foundedYear} />
            <Field icon={<Users size={14} />}      label="Team Size" value={app.teamSize ? `${app.teamSize} people` : undefined} />
          </div>
        </div>

        {/* Use of funds */}
        {app.useOfFunds && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign size={14} className="text-emerald-500" /> Use of Funds
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">{app.useOfFunds}</p>
          </div>
        )}

        {/* Investment summary */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-indigo-500" /> Investment Summary
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-xs text-gray-500">Funding Ask</span>
              <span className="text-sm font-bold text-gray-900">{fundingAsk}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-xs text-gray-500">Previous Funding</span>
              <span className="text-sm font-bold text-gray-900">{prevFunding}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-gray-500">Pipeline Stage</span>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ color: stageColor, backgroundColor: `${stageColor}18` }}
              >
                {app.pipelineStage || 'New'}
              </span>
            </div>
          </div>
        </div>

        {/* Company description full */}
        {app.companyDescription && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 md:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText size={14} className="text-violet-500" /> About the Company
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">{app.companyDescription}</p>
          </div>
        )}

        {/* Pitch Video */}
        <PitchVideoCard appId={app.id} videoUrl={app.pitchVideoUrl} />

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
      .then(url => {
        objectUrlRef.current = url;
        setLocalUrl(url);
      })
      .catch(() => setLocalUrl(null))
      .finally(() => setLoadingLocal(false));

    return () => {
      // Revoke the object URL when the component unmounts to free memory
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [appId]);

  if (loadingLocal) return null; // wait silently

  const effectiveUrl = localUrl || videoUrl || '';

  if (!effectiveUrl) {
    return (
      <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center md:col-span-2">
        <Video size={28} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">No pitch video uploaded</p>
        <p className="text-xs text-gray-400 mt-1">Add a video URL or upload a file when editing this application.</p>
      </div>
    );
  }

  const isBlob   = effectiveUrl.startsWith('blob:');
  const embedUrl = isBlob ? null : toEmbedUrl(effectiveUrl);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 md:col-span-2">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Video size={14} className="text-indigo-500" /> Pitch Video
      </h3>
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
        <a
          href={effectiveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <ExternalLink size={11} /> Open in new tab
        </a>
      )}
    </div>
  );
}

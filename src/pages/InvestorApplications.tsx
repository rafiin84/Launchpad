import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox, Search, Building2, Heart, MessageSquare, Star,
  Calendar, FileSearch, DollarSign, XCircle, ChevronDown,
  ChevronUp, ExternalLink, FileText, Play, StickyNote,
  TrendingUp, Users, BarChart3, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getApplications,
  updateApplicationStatus,
  updateApplication,
  type InvestmentApplication,
  type ApplicationStatus,
} from '../services/investmentApplications';
import { addNotification } from '../services/notifications';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Status & stage styling ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
  draft:               { label: 'Draft',            color: 'text-gray-600',    bg: 'bg-gray-100' },
  submitted:           { label: 'Submitted',        color: 'text-blue-600',    bg: 'bg-blue-50' },
  under_review:        { label: 'Under Review',     color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  interested:          { label: 'Interested',       color: 'text-emerald-600', bg: 'bg-emerald-50' },
  more_info_requested: { label: 'More Info',        color: 'text-amber-600',   bg: 'bg-amber-50' },
  shortlisted:         { label: 'Shortlisted',      color: 'text-purple-600',  bg: 'bg-purple-50' },
  meeting_scheduled:   { label: 'Meeting',          color: 'text-violet-600',  bg: 'bg-violet-50' },
  due_diligence:       { label: 'Due Diligence',    color: 'text-orange-600',  bg: 'bg-orange-50' },
  invested:            { label: 'Invested',         color: 'text-green-600',   bg: 'bg-green-50' },
  rejected:            { label: 'Rejected',         color: 'text-red-600',     bg: 'bg-red-50' },
};

const STAGE_COLORS: Record<string, { color: string; bg: string }> = {
  Idea:        { color: 'text-gray-600',    bg: 'bg-gray-100' },
  'Pre-Seed':  { color: 'text-sky-600',     bg: 'bg-sky-50' },
  Seed:        { color: 'text-blue-600',    bg: 'bg-blue-50' },
  'Series A':  { color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  'Series B':  { color: 'text-violet-600',  bg: 'bg-violet-50' },
  'Series C':  { color: 'text-purple-600',  bg: 'bg-purple-50' },
  Growth:      { color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_COLORS[stage] ?? { color: 'text-gray-600', bg: 'bg-gray-100' };
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      {stage || 'Unknown'}
    </span>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | ApplicationStatus;

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',               label: 'All' },
  { id: 'submitted',         label: 'Submitted' },
  { id: 'under_review',      label: 'Under Review' },
  { id: 'interested',        label: 'Interested' },
  { id: 'shortlisted',       label: 'Shortlisted' },
  { id: 'meeting_scheduled', label: 'Meeting' },
  { id: 'due_diligence',     label: 'Due Diligence' },
  { id: 'invested',          label: 'Invested' },
  { id: 'rejected',          label: 'Rejected' },
];

// ─── Video embed helper ───────────────────────────────────────────────────────

function VideoEmbed({ url }: { url: string }) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const ytId = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      if (ytId) {
        return (
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const vimeoId = u.pathname.split('/').pop();
      if (vimeoId) {
        return (
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}`}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }
    }
    // Loom
    if (u.hostname.includes('loom.com')) {
      const loomId = u.pathname.split('/').pop();
      if (loomId) {
        return (
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            <iframe
              src={`https://www.loom.com/embed/${loomId}`}
              className="w-full h-full"
              allowFullScreen
            />
          </div>
        );
      }
    }
  } catch { /* not a valid URL */ }
  // Fallback link
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
      <Play size={12} /> Watch Demo Video <ExternalLink size={10} />
    </a>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ApplicationDetail({
  app,
  onAction,
  onNotesChange,
}: {
  app: InvestmentApplication;
  onAction: (id: string, status: ApplicationStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const [notes, setNotes] = useState(app.investorNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    onNotesChange(app.id, notes);
    setTimeout(() => setSavingNotes(false), 400);
  };

  const actions: { label: string; status: ApplicationStatus; icon: React.ElementType; color: string; hoverBg: string }[] = [
    { label: 'Interested',        status: 'interested',          icon: Heart,          color: 'text-emerald-600', hoverBg: 'hover:bg-emerald-50' },
    { label: 'Request Info',      status: 'more_info_requested', icon: MessageSquare,  color: 'text-amber-600',   hoverBg: 'hover:bg-amber-50' },
    { label: 'Shortlist',         status: 'shortlisted',         icon: Star,           color: 'text-purple-600',  hoverBg: 'hover:bg-purple-50' },
    { label: 'Schedule Meeting',  status: 'meeting_scheduled',   icon: Calendar,       color: 'text-violet-600',  hoverBg: 'hover:bg-violet-50' },
    { label: 'Due Diligence',     status: 'due_diligence',       icon: FileSearch,     color: 'text-orange-600',  hoverBg: 'hover:bg-orange-50' },
    { label: 'Invest',            status: 'invested',            icon: DollarSign,     color: 'text-green-600',   hoverBg: 'hover:bg-green-50' },
    { label: 'Reject',            status: 'rejected',            icon: XCircle,        color: 'text-red-600',     hoverBg: 'hover:bg-red-50' },
  ];

  // Parse supporting docs
  let supportingDocs: { name: string; url: string }[] = [];
  try {
    if (app.supportingDocs) supportingDocs = JSON.parse(app.supportingDocs);
  } catch { /* ignore */ }

  const financials = [
    { label: 'Current Revenue', value: app.currentRevenue },
    { label: 'MRR',             value: app.mrr },
    { label: 'ARR',             value: app.arr },
    { label: 'Monthly Burn',    value: app.monthlyBurn },
    { label: 'Runway',          value: app.runway },
    { label: 'Active Users',    value: app.activeUsers },
    { label: 'MoM Growth',      value: app.momGrowth },
    { label: 'Churn Rate',      value: app.churnRate },
    { label: 'NPS',             value: app.nps },
  ].filter(f => f.value);

  return (
    <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-6 space-y-6">
      {/* Action Buttons */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</p>
        <div className="flex flex-wrap gap-2">
          {actions.map(a => {
            const Icon = a.icon;
            const isActive = app.status === a.status;
            return (
              <button
                key={a.status}
                onClick={() => onAction(app.id, a.status)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                  isActive
                    ? `${a.color} border-current opacity-100`
                    : `text-gray-600 border-gray-200 ${a.hoverBg} hover:border-gray-300`
                )}
              >
                <Icon size={12} /> {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Company & Founder Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Company Details</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
            {app.companyWebsite && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Website</span>
                <a href={app.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5">
                  {app.companyWebsite.replace(/^https?:\/\//, '')} <ExternalLink size={10} />
                </a>
              </div>
            )}
            {app.companyIndustry && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Industry</span>
                <span className="text-xs font-medium text-gray-900">{app.companyIndustry}</span>
              </div>
            )}
            {app.companyStage && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Stage</span>
                <StageBadge stage={app.companyStage} />
              </div>
            )}
            {app.companyLocation && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Location</span>
                <span className="text-xs font-medium text-gray-900">{app.companyLocation}</span>
              </div>
            )}
            {app.foundedYear && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Founded</span>
                <span className="text-xs font-medium text-gray-900">{app.foundedYear}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Founder Details</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
            {app.founderName && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Name</span>
                <span className="text-xs font-medium text-gray-900">{app.founderName}</span>
              </div>
            )}
            {app.founderEmail && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Email</span>
                <span className="text-xs font-medium text-gray-900">{app.founderEmail}</span>
              </div>
            )}
            {app.founderPhone && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Phone</span>
                <span className="text-xs font-medium text-gray-900">{app.founderPhone}</span>
              </div>
            )}
            {app.founderRole && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Role</span>
                <span className="text-xs font-medium text-gray-900">{app.founderRole}</span>
              </div>
            )}
            {app.founderLinkedin && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">LinkedIn</span>
                <a href={app.founderLinkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5">
                  Profile <ExternalLink size={10} />
                </a>
              </div>
            )}
            {app.coFounders && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Co-Founders</span>
                <span className="text-xs font-medium text-gray-900">{app.coFounders}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Business Overview */}
      {(app.problemStatement || app.solution || app.targetMarket || app.businessModel || app.competitiveAdvantage) && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Business Overview</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            {app.problemStatement && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Problem</p>
                <p className="text-xs text-gray-600 leading-relaxed">{app.problemStatement}</p>
              </div>
            )}
            {app.solution && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Solution</p>
                <p className="text-xs text-gray-600 leading-relaxed">{app.solution}</p>
              </div>
            )}
            {app.targetMarket && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Target Market</p>
                <p className="text-xs text-gray-600 leading-relaxed">{app.targetMarket}</p>
              </div>
            )}
            {app.businessModel && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Business Model</p>
                <p className="text-xs text-gray-600 leading-relaxed">{app.businessModel}</p>
              </div>
            )}
            {app.competitiveAdvantage && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Competitive Advantage</p>
                <p className="text-xs text-gray-600 leading-relaxed">{app.competitiveAdvantage}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Funding Details */}
      {(app.fundingAsk || app.useOfFunds || app.previousFunding || app.currentValuation || app.equityOffered) && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Funding</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {app.fundingAsk && (
              <div>
                <p className="text-xs text-gray-500">Funding Ask</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(parseFloat(app.fundingAsk))}</p>
              </div>
            )}
            {app.currentValuation && (
              <div>
                <p className="text-xs text-gray-500">Valuation</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(parseFloat(app.currentValuation))}</p>
              </div>
            )}
            {app.equityOffered && (
              <div>
                <p className="text-xs text-gray-500">Equity Offered</p>
                <p className="text-sm font-semibold text-gray-900">{app.equityOffered}%</p>
              </div>
            )}
            {app.previousFunding && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-gray-500">Previous Funding</p>
                <p className="text-xs text-gray-700 leading-relaxed">{app.previousFunding}</p>
              </div>
            )}
            {app.useOfFunds && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-gray-500">Use of Funds</p>
                <p className="text-xs text-gray-700 leading-relaxed">{app.useOfFunds}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financial Metrics */}
      {financials.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Financial Metrics</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {financials.map(f => (
              <div key={f.label}>
                <p className="text-xs text-gray-500">{f.label}</p>
                <p className="text-sm font-semibold text-gray-900">{f.value}</p>
              </div>
            ))}
            {app.keyMetric && (
              <div>
                <p className="text-xs text-gray-500">{app.keyMetricLabel || 'Key Metric'}</p>
                <p className="text-sm font-semibold text-gray-900">{app.keyMetric}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pitch Deck */}
      {app.pitchDeckUrl && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pitch Deck</p>
          {app.pitchDeckUrl.startsWith('data:') ? (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <iframe
                src={app.pitchDeckUrl}
                className="w-full"
                style={{ height: '500px' }}
                title="Pitch Deck"
              />
            </div>
          ) : (
            <a
              href={app.pitchDeckUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-white border border-gray-100 rounded-2xl px-4 py-3"
            >
              <FileText size={14} />
              {app.pitchDeckName || 'View Pitch Deck'}
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      {/* Demo Video */}
      {app.demoVideoUrl && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Demo Video</p>
          <VideoEmbed url={app.demoVideoUrl} />
        </div>
      )}

      {/* Supporting Documents */}
      {supportingDocs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Supporting Documents</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
            {supportingDocs.map((doc, i) => (
              <a
                key={i}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-indigo-600 transition-colors py-1"
              >
                <FileText size={12} className="text-gray-400 flex-shrink-0" />
                {doc.name}
                <ExternalLink size={10} className="text-gray-300 ml-auto flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Investor Notes */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <StickyNote size={12} /> Investor Notes
        </p>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Write private notes about this application..."
            className="w-full text-xs text-gray-700 leading-relaxed border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-y min-h-[80px]"
            rows={4}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="text-xs font-semibold text-white bg-black hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvestorApplications() {
  const { currentUser } = useAuth();
  const [applications, setApplications] = useState<InvestmentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    try {
      const all = getApplications().filter(a => a.status !== 'draft');
      setApplications(all);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Action handler ────────────────────────────────────────────────────────

  const handleStatusChange = (id: string, newStatus: ApplicationStatus) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;

    updateApplicationStatus(id, newStatus, currentUser.name);

    const statusLabel = STATUS_CONFIG[newStatus]?.label ?? newStatus;
    addNotification({
      type: 'company_update',
      title: `Application ${statusLabel}`,
      message: `${app.companyName} has been marked as "${statusLabel}" by ${currentUser.name}.`,
      actor: currentUser.name,
      actorRole: 'investor',
      link: '/investor-applications',
    });

    window.dispatchEvent(new Event('notifications-updated'));
    load();
  };

  const handleNotesChange = (id: string, notes: string) => {
    updateApplication(id, { investorNotes: notes });
  };

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = applications.filter(app => {
    // Status filter
    if (activeTab !== 'all' && app.status !== activeTab) return false;
    // Search filter
    if (query) {
      const q = query.toLowerCase();
      return (
        app.companyName.toLowerCase().includes(q) ||
        app.companyIndustry.toLowerCase().includes(q) ||
        app.founderName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = [
    { label: 'Total Applications', value: applications.length,                                  icon: BarChart3,   color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Under Review',       value: applications.filter(a => a.status === 'under_review').length, icon: Clock,       color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Shortlisted',        value: applications.filter(a => a.status === 'shortlisted').length,  icon: Star,        color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Invested',           value: applications.filter(a => a.status === 'invested').length,     icon: TrendingUp,  color: 'text-green-600',  bg: 'bg-green-50' },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="w-full">
        <PageHeader
          title="Investment Applications"
          description="Review and evaluate startup investment proposals"
        />
      </div>

      {/* Search + Filter Tabs */}
      <div className="mb-6 space-y-4">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search companies, industries, founders..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', stat.bg)}>
                  <Icon size={14} className={stat.color} />
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Applications
          <span className="ml-2 text-xs font-medium text-gray-400">{filtered.length}</span>
        </h2>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
          <Inbox size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No applications yet</p>
          <p className="text-xs text-gray-400">Applications submitted by founders will appear here.</p>
        </div>
      )}

      {/* Application Cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(app => {
            const isExpanded = expandedId === app.id;
            return (
              <div key={app.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-all">
                {/* Card header — clickable */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : app.id)}
                >
                  {/* Logo placeholder */}
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    <Building2 size={16} className="text-gray-400" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{app.companyName || 'Untitled'}</p>
                      <StageBadge stage={app.companyStage} />
                      <StatusBadge status={app.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{app.companyIndustry || 'No industry'}</span>
                      {app.companyLocation && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>{app.companyLocation}</span>
                        </>
                      )}
                      {app.founderName && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>{app.founderName}</span>
                        </>
                      )}
                      {app.founderEmail && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="truncate">{app.founderEmail}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {app.fundingAsk && (
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(parseFloat(app.fundingAsk))}
                      </span>
                    )}
                    {app.submittedAt && (
                      <span className="text-xs text-gray-400 hidden sm:inline">{relativeTime(app.submittedAt)}</span>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <ApplicationDetail
                    app={app}
                    onAction={handleStatusChange}
                    onNotesChange={handleNotesChange}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

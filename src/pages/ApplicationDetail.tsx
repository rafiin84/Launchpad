import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, ExternalLink, FileText, Play, StickyNote,
  CheckCircle2, Pause, XCircle, MessageSquare, FileUp, Calendar,
  Star, Send, Inbox,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getApplicationById,
  updateApplicationStatus,
  updateApplication,
  approveApplication,
  type InvestmentApplication,
  type ApplicationStatus,
} from '../services/investmentApplications';
import { addNotification } from '../services/notifications';
import { cn } from '../lib/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === 0) return '—';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
  draft:                { label: 'Draft',              color: 'text-gray-600',    bg: 'bg-gray-100' },
  submitted:            { label: 'Submitted',          color: 'text-blue-600',    bg: 'bg-blue-50' },
  under_review:         { label: 'Under Review',       color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  interested:           { label: 'Interested',         color: 'text-emerald-600', bg: 'bg-emerald-50' },
  more_info_requested:  { label: 'More Info',          color: 'text-amber-600',   bg: 'bg-amber-50' },
  documents_requested:  { label: 'Docs Requested',     color: 'text-yellow-600',  bg: 'bg-yellow-50' },
  shortlisted:          { label: 'Shortlisted',        color: 'text-purple-600',  bg: 'bg-purple-50' },
  meeting_scheduled:    { label: 'Meeting',            color: 'text-violet-600',  bg: 'bg-violet-50' },
  due_diligence:        { label: 'Due Diligence',      color: 'text-orange-600',  bg: 'bg-orange-50' },
  on_hold:              { label: 'On Hold',            color: 'text-slate-600',   bg: 'bg-slate-100' },
  approved:             { label: 'Approved',           color: 'text-green-600',   bg: 'bg-green-50' },
  invested:             { label: 'Invested',           color: 'text-green-700',   bg: 'bg-green-100' },
  rejected:             { label: 'Rejected',           color: 'text-red-600',     bg: 'bg-red-50' },
};

const NOTIFICATION_MESSAGES: Record<string, (companyName: string, investorName: string) => { title: string; message: string }> = {
  approved:            (c, i) => ({ title: 'Application Approved', message: `Congratulations! Your application for ${c} has been approved by ${i}.` }),
  rejected:            (c, i) => ({ title: 'Application Rejected', message: `Your application for ${c} has been reviewed and was not selected to move forward.` }),
  on_hold:             (c, i) => ({ title: 'Application On Hold', message: `Your application for ${c} has been placed on hold. The investor will follow up soon.` }),
  more_info_requested: (c, i) => ({ title: 'Additional Information Requested', message: `${i} has requested additional information for your application (${c}). Please check your application and provide the requested details.` }),
  documents_requested: (c, i) => ({ title: 'Documents Requested', message: `${i} has requested additional documents for your application (${c}). Please upload the required documents.` }),
  meeting_scheduled:   (c, i) => ({ title: 'Meeting Scheduled', message: `${i} would like to schedule a meeting to discuss your application for ${c}. Please check for further details.` }),
  shortlisted:         (c, i) => ({ title: 'Application Shortlisted', message: `Great news! Your application for ${c} has been shortlisted by ${i} for further evaluation.` }),
  under_review:        (c, i) => ({ title: 'Application Under Review', message: `Your application for ${c} is now being actively reviewed by the investment team.` }),
  interested:          (c, i) => ({ title: 'Investor Interested', message: `${i} has expressed interest in your application for ${c}.` }),
  due_diligence:       (c, i) => ({ title: 'Due Diligence Started', message: `Your application for ${c} has moved to due diligence review.` }),
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
    <span className={cn('inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full', cfg.color, cfg.bg)}>
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

// ─── Video embed ──────────────────────────────────────────────────────────────

function VideoEmbed({ url }: { url: string }) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const ytId = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      if (ytId) return (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <iframe src={`https://www.youtube.com/embed/${ytId}`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      );
    }
    if (u.hostname.includes('vimeo.com')) {
      const vid = u.pathname.split('/').pop();
      if (vid) return (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <iframe src={`https://player.vimeo.com/video/${vid}`} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      );
    }
    if (u.hostname.includes('loom.com')) {
      const lid = u.pathname.split('/').pop();
      if (lid) return (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <iframe src={`https://www.loom.com/embed/${lid}`} className="w-full h-full" allowFullScreen />
        </div>
      );
    }
  } catch { /* not a valid URL */ }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
      <Play size={12} /> Watch Demo Video <ExternalLink size={10} />
    </a>
  );
}

// ─── Detail section components ────────────────────────────────────────────────

function InfoRow({ label, value, href }: { label: string; value?: string; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 font-medium">
          {value} <ExternalLink size={10} />
        </a>
      ) : (
        <span className="text-xs font-medium text-gray-900">{value}</span>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        {children}
      </div>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-xs text-gray-600 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentUser, isInvestor, isFounder } = useAuth();

  const [app, setApp] = useState<InvestmentApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadApp = useCallback(async () => {
    if (!id) return;
    try {
      const result = await getApplicationById(id, isInvestor);
      if (result) {
        setApp(result);
        setNotes(result.investorNotes || '');
      } else {
        setError('Application not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    }
    setLoading(false);
  }, [id, isInvestor]);

  useEffect(() => { loadApp(); }, [loadApp]);

  if (isFounder) {
    return <Navigate to="/applications/track" replace />;
  }

  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    if (!app || !id) return;
    setActionLoading(newStatus);

    try {
      if (newStatus === 'approved') {
        await approveApplication(id, currentUser.name, isInvestor);
      } else {
        await updateApplicationStatus(id, newStatus, currentUser.name, isInvestor);
      }

      const notifGen = NOTIFICATION_MESSAGES[newStatus];
      if (notifGen) {
        const { title, message } = notifGen(app.companyName, currentUser.name);
        addNotification({
          type: 'company_update',
          title,
          message,
          actor: currentUser.name,
          actorRole: 'investor',
          link: '/applications/track',
        });
      } else {
        const statusLabel = STATUS_CONFIG[newStatus]?.label ?? newStatus;
        addNotification({
          type: 'company_update',
          title: `Application ${statusLabel}`,
          message: `${app.companyName} has been marked as "${statusLabel}" by ${currentUser.name}.`,
          actor: currentUser.name,
          actorRole: 'investor',
          link: '/applications/track',
        });
      }

      window.dispatchEvent(new Event('notifications-updated'));
      await loadApp();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
    setActionLoading(null);
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    await updateApplication(id, { investorNotes: notes }, isInvestor);
    setTimeout(() => setSavingNotes(false), 400);
  };

  const handleSendMessage = async () => {
    if (!app || !id || !messageText.trim()) return;
    setSendingMessage(true);
    const existing = app.investorNotes || '';
    const timestamp = new Date().toLocaleString();
    const newNotes = existing
      ? `${existing}\n\n[${timestamp}] ${currentUser.name}: ${messageText}`
      : `[${timestamp}] ${currentUser.name}: ${messageText}`;
    await updateApplication(id, {
      investorNotes: newNotes,
      reviewedBy: currentUser.name,
      reviewedAt: new Date().toISOString(),
    }, isInvestor);

    addNotification({
      type: 'company_update',
      title: 'Message from Investor',
      message: `${currentUser.name} sent a message regarding ${app.companyName}: "${messageText.slice(0, 80)}${messageText.length > 80 ? '...' : ''}"`,
      actor: currentUser.name,
      actorRole: 'investor',
      link: '/applications/track',
    });

    window.dispatchEvent(new Event('notifications-updated'));
    setMessageText('');
    setShowMessage(false);
    setSendingMessage(false);
    await loadApp();
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
      <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
        <Inbox size={28} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">{error || 'Application not found'}</p>
      </div>
    </div>
  );

  const actions: { label: string; status: ApplicationStatus; icon: React.ElementType; color: string; hoverBg: string; borderColor: string }[] = [
    { label: 'Approve',          status: 'approved',            icon: CheckCircle2,  color: 'text-green-600',   hoverBg: 'hover:bg-green-50',  borderColor: 'border-green-200' },
    { label: 'Hold',             status: 'on_hold',             icon: Pause,         color: 'text-slate-600',   hoverBg: 'hover:bg-slate-50',  borderColor: 'border-slate-200' },
    { label: 'Reject',           status: 'rejected',            icon: XCircle,       color: 'text-red-600',     hoverBg: 'hover:bg-red-50',    borderColor: 'border-red-200' },
    { label: 'Request Info',     status: 'more_info_requested', icon: MessageSquare, color: 'text-amber-600',   hoverBg: 'hover:bg-amber-50',  borderColor: 'border-amber-200' },
    { label: 'Request Docs',     status: 'documents_requested', icon: FileUp,        color: 'text-yellow-600',  hoverBg: 'hover:bg-yellow-50', borderColor: 'border-yellow-200' },
    { label: 'Schedule Meeting', status: 'meeting_scheduled',   icon: Calendar,      color: 'text-violet-600',  hoverBg: 'hover:bg-violet-50', borderColor: 'border-violet-200' },
    { label: 'Shortlist',        status: 'shortlisted',         icon: Star,          color: 'text-purple-600',  hoverBg: 'hover:bg-purple-50', borderColor: 'border-purple-200' },
  ];

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
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
      <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-6">
        <ArrowLeft size={15} /> Back to Applications
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
            <Building2 size={24} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{app.companyName || 'Untitled Application'}</h1>
              <StatusBadge status={app.status} />
              {app.companyStage && <StageBadge stage={app.companyStage} />}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
              {app.companyIndustry && <span>{app.companyIndustry}</span>}
              {app.companyLocation && <><span className="text-gray-300">|</span><span>{app.companyLocation}</span></>}
              {app.founderName && <><span className="text-gray-300">|</span><span>{app.founderName}</span></>}
              {app.submittedAt && <><span className="text-gray-300">|</span><span>Submitted {relativeTime(app.submittedAt)}</span></>}
            </div>
          </div>
          {app.fundingAsk && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-500">Funding Ask</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(parseFloat(app.fundingAsk))}</p>
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">

          {/* Actions */}
          <Section title="Actions">
            <div className="flex flex-wrap gap-2 mb-3">
              {actions.map(a => {
                const Icon = a.icon;
                const isActive = app.status === a.status;
                const isLoading = actionLoading === a.status;
                return (
                  <button
                    key={a.status}
                    onClick={() => handleStatusChange(a.status)}
                    disabled={!!actionLoading}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                      isActive
                        ? `${a.color} ${a.borderColor} bg-opacity-10`
                        : `text-gray-600 border-gray-200 ${a.hoverBg} hover:border-gray-300`,
                      isLoading && 'opacity-50 cursor-wait'
                    )}
                  >
                    <Icon size={13} /> {isLoading ? 'Updating...' : a.label}
                  </button>
                );
              })}
              <button
                onClick={() => setShowMessage(!showMessage)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                  showMessage
                    ? 'text-blue-600 border-blue-300 bg-blue-50'
                    : 'text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-gray-300'
                )}
              >
                <Send size={12} /> Send Message
              </button>
            </div>
            {showMessage && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mt-2">
                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Type a message to the founder..."
                  className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !messageText.trim()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send size={11} /> {sendingMessage ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Business Overview */}
          {(app.problemStatement || app.solution || app.targetMarket || app.businessModel || app.competitiveAdvantage || app.companyDescription) && (
            <Section title="Business Overview">
              <div className="space-y-4">
                <TextBlock label="About the Company" text={app.companyDescription} />
                <TextBlock label="Problem" text={app.problemStatement} />
                <TextBlock label="Solution" text={app.solution} />
                <TextBlock label="Target Market" text={app.targetMarket} />
                <TextBlock label="Business Model" text={app.businessModel} />
                <TextBlock label="Competitive Advantage" text={app.competitiveAdvantage} />
              </div>
            </Section>
          )}

          {/* Funding Details */}
          {(app.fundingAsk || app.useOfFunds || app.previousFunding || app.currentValuation || app.equityOffered) && (
            <Section title="Funding">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                    <p className="text-xs text-gray-700 leading-relaxed mt-1">{app.previousFunding}</p>
                  </div>
                )}
                {app.useOfFunds && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-gray-500">Use of Funds</p>
                    <p className="text-xs text-gray-700 leading-relaxed mt-1">{app.useOfFunds}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Financial Metrics */}
          {financials.length > 0 && (
            <Section title="Financial Metrics">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
            </Section>
          )}

          {/* Pitch Deck */}
          {app.pitchDeckUrl && (
            <Section title="Pitch Deck">
              {app.pitchDeckUrl.startsWith('data:') ? (
                <iframe src={app.pitchDeckUrl} className="w-full rounded-xl" style={{ height: '500px' }} title="Pitch Deck" />
              ) : (
                <a href={app.pitchDeckUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  <FileText size={14} /> {app.pitchDeckName || 'View Pitch Deck'} <ExternalLink size={10} />
                </a>
              )}
            </Section>
          )}

          {/* Demo Video */}
          {app.demoVideoUrl && (
            <Section title="Demo Video">
              <VideoEmbed url={app.demoVideoUrl} />
            </Section>
          )}

          {/* Supporting Documents */}
          {supportingDocs.length > 0 && (
            <Section title="Supporting Documents">
              <div className="space-y-2">
                {supportingDocs.map((doc, i) => (
                  <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-indigo-600 transition-colors py-1">
                    <FileText size={12} className="text-gray-400 flex-shrink-0" />
                    {doc.name}
                    <ExternalLink size={10} className="text-gray-300 ml-auto flex-shrink-0" />
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-6">

          {/* Company Details */}
          <Section title="Company Info">
            <div>
              <InfoRow label="Website" value={app.companyWebsite ? app.companyWebsite.replace(/^https?:\/\//, '') : undefined} href={app.companyWebsite ? (app.companyWebsite.startsWith('http') ? app.companyWebsite : `https://${app.companyWebsite}`) : undefined} />
              <InfoRow label="Industry" value={app.companyIndustry} />
              <InfoRow label="Stage" value={app.companyStage} />
              <InfoRow label="Location" value={app.companyLocation} />
              <InfoRow label="Founded" value={app.foundedYear} />
            </div>
          </Section>

          {/* Founder Details */}
          <Section title="Founder Details">
            <div>
              <InfoRow label="Name" value={app.founderName} />
              <InfoRow label="Email" value={app.founderEmail} href={app.founderEmail ? `mailto:${app.founderEmail}` : undefined} />
              <InfoRow label="Phone" value={app.founderPhone} href={app.founderPhone ? `tel:${app.founderPhone}` : undefined} />
              <InfoRow label="Role" value={app.founderRole} />
              <InfoRow label="LinkedIn" value={app.founderLinkedin ? 'View Profile' : undefined} href={app.founderLinkedin || undefined} />
              {app.coFounders && <InfoRow label="Co-Founders" value={app.coFounders} />}
            </div>
          </Section>

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
                className="w-full text-xs text-gray-700 leading-relaxed border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-y"
                rows={5}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="text-xs font-semibold text-white bg-black hover:bg-gray-800 px-3.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

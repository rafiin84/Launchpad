import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox, Search, Building2, Star,
  XCircle, ExternalLink,
  BarChart3, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getApplications,
  type InvestmentApplication,
  type ApplicationStatus,
} from '../services/investmentApplications';
import { cn } from '../lib/cn';
import { usePageTitle } from '../context/PageTitleContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function createRelativeTime(t: { activities: { justNow: string; minutesAgo: string; hoursAgo: string; yesterday: string; daysAgo: string } }, language: string) {
  return function relativeTime(iso: string): string {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return t.activities.justNow;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t.activities.minutesAgo.replace('{n}', String(minutes));
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t.activities.hoursAgo.replace('{n}', String(hours));
    const days = Math.floor(hours / 24);
    if (days === 1) return t.activities.yesterday;
    if (days < 7) return t.activities.daysAgo.replace('{n}', String(days));
    return new Date(iso).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' });
  };
}

// ─── Status & stage styling ───────────────────────────────────────────────────

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
  const { t } = useLanguage();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  const statusLabels: Record<string, string> = {
    draft: t.applicationTracker.statusDraft,
    submitted: t.applicationTracker.statusSubmitted,
    under_review: t.applicationTracker.statusUnderReview,
    interested: t.applicationTracker.statusInterested,
    more_info_requested: t.applicationTracker.statusMoreInfo,
    documents_requested: t.applicationTracker.statusDocsRequested,
    shortlisted: t.applicationTracker.statusShortlisted,
    meeting_scheduled: t.applicationTracker.statusMeeting,
    due_diligence: t.applicationTracker.statusDueDiligence,
    on_hold: t.applicationTracker.statusOnHold,
    approved: t.applicationTracker.statusApproved,
    invested: t.applicationTracker.statusInvested,
    rejected: t.applicationTracker.statusRejected,
  };
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      {statusLabels[status] || cfg.label}
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
  { id: 'shortlisted',       label: 'Shortlisted' },
  { id: 'meeting_scheduled', label: 'Meeting' },
  { id: 'on_hold',           label: 'On Hold' },
  { id: 'approved',          label: 'Approved' },
  { id: 'rejected',          label: 'Rejected' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvestorApplications() {
  const { isInvestor } = useAuth();
  const { t, language } = useLanguage();
  const { setPageTitle } = usePageTitle();
  const relativeTime = createRelativeTime(t, language);
  const navigate = useNavigate();
  const [applications, setApplications] = useState<InvestmentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filterLabels: Record<string, string> = {
    all: t.investorApplications.all,
    submitted: t.investorApplications.submitted,
    under_review: t.investorApplications.underReview,
    shortlisted: t.investorApplications.shortlisted,
    meeting_scheduled: t.investorApplications.meeting,
    on_hold: t.investorApplications.onHold,
    approved: t.investorApplications.approved,
    rejected: t.investorApplications.rejected,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getApplications(isInvestor);
      setApplications(all.filter(a => a.status !== 'draft'));
    } catch { /* ignore */ }
    setLoading(false);
  }, [isInvestor]);

  useEffect(() => { setPageTitle(t.nav.applications, t.applications.title); return () => setPageTitle(null); }, [t]);
  useEffect(() => { load(); }, [load]);

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
    { label: t.investorApplications.total,       value: applications.length,                                                                                             icon: BarChart3,    color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: t.investorApplications.shortlisted, value: applications.filter(a => a.status === 'shortlisted').length,                                                     icon: Star,         color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: t.investorApplications.approved,    value: applications.filter(a => a.status === 'approved' || a.status === 'invested').length,                              icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50' },
    { label: t.investorApplications.rejected,    value: applications.filter(a => a.status === 'rejected').length,                                                        icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50' },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Search + Filter Tabs */}
      <div className="mb-6 space-y-4">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t.investorApplications.searchPlaceholder}
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
              {filterLabels[tab.id] || tab.label}
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
          {t.nav.applications}
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
          <p className="text-sm font-medium text-gray-500 mb-1">{t.common.noResults}</p>
          <p className="text-xs text-gray-400">{t.applications.title}</p>
        </div>
      )}

      {/* Application Cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(app => (
            <div
              key={app.id}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-all cursor-pointer"
              onClick={() => navigate(`/applications/${app.id}`)}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
                  <Building2 size={16} className="text-gray-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{app.companyName || t.investorApplications.untitled}</p>
                    <StageBadge stage={app.companyStage} />
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{app.companyIndustry || t.investorApplications.noIndustry}</span>
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

                <div className="flex items-center gap-4 flex-shrink-0">
                  {app.fundingAsk && (
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(parseFloat(app.fundingAsk))}
                    </span>
                  )}
                  {app.submittedAt && (
                    <span className="text-xs text-gray-400 hidden sm:inline">{relativeTime(app.submittedAt)}</span>
                  )}
                  <ExternalLink size={14} className="text-gray-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

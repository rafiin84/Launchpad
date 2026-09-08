import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox, Search, Building2, Star,
  XCircle, ExternalLink,
  BarChart3, CheckCircle2, Layers, Check, Lock, X as XIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getApplications,
  getPipelineState,
  canViewApplication,
  REVIEW_LEVELS,
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
  level1_screening:     { label: 'L1 Screening',       color: 'text-sky-600',     bg: 'bg-sky-50' },
  level1_cleared:       { label: 'L1 Cleared',         color: 'text-sky-700',     bg: 'bg-sky-100' },
  level2_cleared:       { label: 'L2 Cleared',         color: 'text-indigo-700',  bg: 'bg-indigo-100' },
  level3_cleared:       { label: 'L3 Cleared',         color: 'text-violet-700',  bg: 'bg-violet-100' },
  not_shortlisted:      { label: 'Not Shortlisted',    color: 'text-red-600',     bg: 'bg-red-50' },
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
    level1_screening: t.applicationTracker.statusLevel1Screening,
    level1_cleared: t.applicationTracker.statusLevel1Cleared,
    level2_cleared: t.applicationTracker.statusLevel2Cleared,
    level3_cleared: t.applicationTracker.statusLevel3Cleared,
    not_shortlisted: t.applicationTracker.statusNotShortlisted,
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
  { id: 'all',              label: 'All' },
  { id: 'submitted',        label: 'Awaiting L1' },
  { id: 'level1_cleared',   label: 'L1 Cleared' },
  { id: 'level2_cleared',   label: 'L2 Cleared' },
  { id: 'level3_cleared',   label: 'Ready for Decision' },
  { id: 'not_shortlisted',  label: 'Not Shortlisted' },
  { id: 'approved',         label: 'Approved' },
  { id: 'rejected',         label: 'Rejected' },
];

// ─── Level progress indicator (list view) ─────────────────────────────────────

function LevelProgress({ app }: { app: InvestmentApplication }) {
  const { t } = useLanguage();
  const state = getPipelineState(app);
  const { clearedCount, droppedAtLevel, currentLevel } = state;

  return (
    <div className="flex items-center gap-1" title={
      droppedAtLevel !== null
        ? t.reviewPipeline.droppedBanner.replace('{n}', String(droppedAtLevel))
        : currentLevel !== null
        ? t.reviewPipeline.reviewLevel.replace('{n}', String(currentLevel))
        : t.reviewPipeline.finalStage
    }>
      {REVIEW_LEVELS.map(level => {
        const cleared = clearedCount >= level;
        const dropped = droppedAtLevel === level;
        const isCurrent = currentLevel === level;
        return (
          <span
            key={level}
            className={cn(
              'w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold ring-1',
              dropped   ? 'bg-red-50 text-red-600 ring-red-200'
                : cleared ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
                : isCurrent ? 'bg-amber-50 text-amber-700 ring-amber-300'
                : 'bg-gray-50 text-gray-300 ring-gray-200',
            )}
          >
            {dropped ? <XIcon size={9} /> : cleared ? <Check size={9} /> : isCurrent ? level : <Lock size={8} />}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvestorApplications() {
  const { isInvestor, viewerRole, reviewerLevel, isReviewer } = useAuth();
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
      // Stage-scoped: the service asks CRM only for the statuses this viewer
      // may see. The extra filter is a safety net, not the mechanism.
      const all = await getApplications(isInvestor, undefined, viewerRole);
      setApplications(all.filter(a => a.status !== 'draft' && canViewApplication(a, viewerRole)));
    } catch { /* ignore */ }
    setLoading(false);
  }, [isInvestor, viewerRole]);

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
    { label: t.reviewPipeline.title,             value: applications.filter(a => ['submitted','under_review','level1_screening','level1_cleared','level2_cleared','level3_cleared'].includes(a.status)).length, icon: Layers,       color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: t.investorApplications.approved,    value: applications.filter(a => a.status === 'approved' || a.status === 'invested').length,                              icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50' },
    { label: t.investorApplications.rejected,    value: applications.filter(a => a.status === 'rejected').length,                                                        icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50' },
  ];

  // Queue identity: each reviewer level gets its own framing, and the tabs
  // only offer statuses that can actually appear in that queue.
  const queueTitle = reviewerLevel === 1 ? t.reviewerQueue.l1Title
    : reviewerLevel === 2 ? t.reviewerQueue.l2Title
    : reviewerLevel === 3 ? t.reviewerQueue.l3Title
    : t.reviewerQueue.investorTitle;
  const queueDesc = reviewerLevel === 1 ? t.reviewerQueue.l1Desc
    : reviewerLevel === 2 ? t.reviewerQueue.l2Desc
    : reviewerLevel === 3 ? t.reviewerQueue.l3Desc
    : t.reviewerQueue.investorDesc;
  const emptyDesc = reviewerLevel === 1 ? t.reviewerQueue.emptyL1Desc
    : isReviewer ? t.reviewerQueue.emptyQueueDesc
    : t.reviewerQueue.emptyInvestorDesc;

  // Reviewers have a single-stage queue, so status tabs are meaningless for
  // them; only the investor sees more than one status.
  const visibleTabs = isReviewer
    ? []
    : FILTER_TABS.filter(tab => ['all', 'level3_cleared', 'approved', 'rejected'].includes(tab.id));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Queue header — states plainly whose queue this is */}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">{queueTitle}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{queueDesc}</p>
        {isReviewer && (
          <p className="text-[11px] text-gray-400 mt-1.5 inline-flex items-center gap-1">
            <Lock size={10} /> {t.reviewerQueue.stageScoped}
          </p>
        )}
      </div>

      {/* Search + Filter Tabs */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t.investorApplications.searchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {visibleTabs.map(tab => (
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

      {/* Stats Cards — the investor sees the funnel; a reviewer sees their queue */}
      <div className={cn('grid gap-3 mb-6', isReviewer ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        {(isReviewer ? stats.slice(0, 1) : stats).map(stat => {
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
          {t.reviewerQueue.queueCount.replace('{n}', String(filtered.length))}
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
          <p className="text-sm font-medium text-gray-500 mb-1">{t.reviewerQueue.emptyQueue}</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">{emptyDesc}</p>
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
                  <LevelProgress app={app} />
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

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox, Plus, FileText, Clock, CheckCircle, XCircle,
  TrendingUp, Building2, DollarSign, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getApplications,
  canApplyAgain,
  type InvestmentApplication,
  type ApplicationStatus,
} from '../services/investmentApplications';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(raw: string): string {
  const num = parseFloat(raw);
  if (!num || isNaN(num)) return '--';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

// ─── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string; text: string }> = {
  draft:               { label: 'Draft',              color: '#6b7280', bg: 'bg-gray-100',    text: 'text-gray-600' },
  submitted:           { label: 'Submitted',          color: '#3b82f6', bg: 'bg-blue-50',     text: 'text-blue-600' },
  under_review:        { label: 'Under Review',       color: '#6366f1', bg: 'bg-indigo-50',   text: 'text-indigo-600' },
  interested:          { label: 'Interested',         color: '#10b981', bg: 'bg-emerald-50',  text: 'text-emerald-600' },
  more_info_requested: { label: 'More Info Requested',color: '#f59e0b', bg: 'bg-amber-50',    text: 'text-amber-600' },
  documents_requested: { label: 'Docs Requested',     color: '#eab308', bg: 'bg-yellow-50',   text: 'text-yellow-600' },
  shortlisted:         { label: 'Shortlisted',        color: '#a855f7', bg: 'bg-purple-50',   text: 'text-purple-600' },
  meeting_scheduled:   { label: 'Meeting Scheduled',  color: '#8b5cf6', bg: 'bg-violet-50',   text: 'text-violet-600' },
  due_diligence:       { label: 'Due Diligence',      color: '#f97316', bg: 'bg-orange-50',   text: 'text-orange-600' },
  on_hold:             { label: 'On Hold',            color: '#475569', bg: 'bg-slate-100',   text: 'text-slate-600' },
  approved:            { label: 'Approved',           color: '#22c55e', bg: 'bg-green-50',    text: 'text-green-600' },
  invested:            { label: 'Invested',           color: '#15803d', bg: 'bg-green-100',   text: 'text-green-700' },
  rejected:            { label: 'Rejected',           color: '#ef4444', bg: 'bg-red-50',      text: 'text-red-600' },
};

const PIPELINE_STAGES: ApplicationStatus[] = [
  'submitted',
  'under_review',
  'shortlisted',
  'meeting_scheduled',
  'due_diligence',
  'approved',
];

function stageIndex(status: ApplicationStatus): number {
  const idx = PIPELINE_STAGES.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function progressPercent(status: ApplicationStatus): number {
  if (status === 'draft') return 0;
  if (status === 'rejected') return 100;
  const idx = stageIndex(status);
  return Math.round(((idx + 1) / PIPELINE_STAGES.length) * 100);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function PipelineVisualization({ apps }: { apps: InvestmentApplication[] }) {
  const nonDraft = apps.filter(a => a.status !== 'draft');
  const counts: Record<string, number> = {};
  for (const a of nonDraft) {
    counts[a.status] = (counts[a.status] || 0) + 1;
  }

  const allStages: { status: ApplicationStatus; label: string }[] = [
    { status: 'submitted', label: 'Submitted' },
    { status: 'under_review', label: 'Under Review' },
    { status: 'shortlisted', label: 'Shortlisted' },
    { status: 'meeting_scheduled', label: 'Meeting' },
    { status: 'due_diligence', label: 'Due Diligence' },
    { status: 'approved', label: 'Approved' },
    { status: 'on_hold', label: 'On Hold' },
    { status: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 overflow-x-auto">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Application Pipeline</h3>
      <div className="flex items-center gap-1 min-w-[640px]">
        {allStages.map((stage, i) => {
          const count = counts[stage.status] || 0;
          const cfg = STATUS_CONFIG[stage.status];
          const hasApps = count > 0;
          return (
            <div key={stage.status} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    hasApps ? 'border-current shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-300',
                  )}
                  style={hasApps ? { color: cfg.color, backgroundColor: `${cfg.color}15` } : undefined}
                >
                  {count}
                </div>
                <span className={cn(
                  'text-[10px] mt-1.5 text-center font-medium leading-tight',
                  hasApps ? 'text-gray-700' : 'text-gray-400',
                )}>
                  {stage.label}
                </span>
              </div>
              {i < allStages.length - 1 && (
                <div className={cn('h-0.5 w-4 flex-shrink-0', hasApps && (counts[allStages[i + 1]?.status] || 0) > 0 ? 'bg-indigo-200' : 'bg-gray-100')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ACTION_REQUIRED: ApplicationStatus[] = ['more_info_requested', 'documents_requested'];

function ApplicationCard({ app, expanded, onToggle }: { app: InvestmentApplication; expanded: boolean; onToggle: () => void }) {
  const cfg = STATUS_CONFIG[app.status];
  const isDraft = app.status === 'draft';
  const isApproved = app.status === 'approved' || app.status === 'invested';
  const needsAction = ACTION_REQUIRED.includes(app.status);
  const progress = progressPercent(app.status);

  return (
    <div className={cn(
      'bg-white border rounded-2xl p-5 transition-all',
      isDraft ? 'border-amber-200 bg-amber-50/30' :
      isApproved ? 'border-green-200 bg-green-50/30' :
      needsAction ? 'border-amber-200 bg-amber-50/20' :
      app.status === 'on_hold' ? 'border-slate-200 bg-slate-50/30' :
      app.status === 'rejected' ? 'border-red-200 bg-red-50/20' :
      'border-gray-100',
    )}>
      {/* Action required banner */}
      {needsAction && (
        <div className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg px-3 py-1.5 mb-3">
          <Clock size={12} />
          {app.status === 'more_info_requested' ? 'Investor has requested more information' : 'Investor has requested documents'}
        </div>
      )}
      {isApproved && (
        <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-100 rounded-lg px-3 py-1.5 mb-3">
          <CheckCircle size={12} />
          Your application has been approved! You are now a Founder.
        </div>
      )}
      {app.status === 'on_hold' && (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg px-3 py-1.5 mb-3">
          <Clock size={12} />
          Your application is currently on hold.
        </div>
      )}
      {app.status === 'rejected' && (
        <div className="flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg px-3 py-1.5 mb-3">
          <XCircle size={12} />
          Your application has been declined.
        </div>
      )}
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
            <Building2 size={16} className="text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{app.companyName || 'Untitled'}</p>
            {app.companyIndustry && (
              <span className="inline-flex text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full mt-0.5">
                {app.companyIndustry}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {/* Info row */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        {app.fundingAsk && (
          <span className="flex items-center gap-1">
            <DollarSign size={12} className="text-gray-400" />
            <span className="font-medium text-gray-700">{formatCurrency(app.fundingAsk)}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={12} className="text-gray-400" />
          {relativeTime(app.status === 'draft' ? app.updatedAt : app.submittedAt)}
        </span>
      </div>

      {/* Progress bar (non-drafts only) */}
      {!isDraft && (
        <div className="mb-3">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: app.status === 'rejected' ? '#ef4444' : cfg.color,
              }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {app.status === 'rejected' ? 'Rejected' : `${PIPELINE_STAGES[stageIndex(app.status)]?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Submitted'} (${progress}%)`}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isDraft ? (
          <Link
            to={`/applications/apply?edit=${app.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <FileText size={12} /> Continue Editing
          </Link>
        ) : (
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            {expanded ? 'Hide Details' : 'View Details'}
            <ArrowRight size={12} className={cn('transition-transform', expanded && 'rotate-90')} />
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && !isDraft && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {app.companyDescription && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</p>
              <p className="text-xs text-gray-700 leading-relaxed">{app.companyDescription}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {app.companyStage && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Stage</p>
                <p className="text-xs text-gray-700">{app.companyStage}</p>
              </div>
            )}
            {app.companyLocation && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
                <p className="text-xs text-gray-700">{app.companyLocation}</p>
              </div>
            )}
            {app.currentRevenue && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Revenue</p>
                <p className="text-xs text-gray-700">{formatCurrency(app.currentRevenue)}</p>
              </div>
            )}
            {app.equityOffered && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Equity Offered</p>
                <p className="text-xs text-gray-700">{app.equityOffered}%</p>
              </div>
            )}
          </div>
          {app.problemStatement && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Problem</p>
              <p className="text-xs text-gray-700 leading-relaxed">{app.problemStatement}</p>
            </div>
          )}
          {app.solution && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Solution</p>
              <p className="text-xs text-gray-700 leading-relaxed">{app.solution}</p>
            </div>
          )}
          {app.useOfFunds && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Use of Funds</p>
              <p className="text-xs text-gray-700 leading-relaxed">{app.useOfFunds}</p>
            </div>
          )}
          {app.investorNotes && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-1">Investor Notes</p>
              <p className="text-xs text-indigo-700 leading-relaxed">{app.investorNotes}</p>
              {app.reviewedBy && (
                <p className="text-[10px] text-indigo-400 mt-1">
                  Reviewed by {app.reviewedBy} {app.reviewedAt ? `on ${new Date(app.reviewedAt).toLocaleDateString()}` : ''}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FounderApplicationTracker() {
  const { currentUser, isInvestor } = useAuth();
  const [applications, setApplications] = useState<InvestmentApplication[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all = await getApplications(isInvestor, currentUser?.email);
      if (!cancelled) {
        setApplications(all);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isInvestor, currentUser?.email]);

  const drafts = applications.filter(a => a.status === 'draft');
  const nonDrafts = applications.filter(a => a.status !== 'draft');

  // Stats
  const inProgressStatuses: ApplicationStatus[] = ['under_review', 'interested', 'shortlisted', 'meeting_scheduled', 'due_diligence', 'more_info_requested', 'documents_requested'];
  const totalSubmitted = nonDrafts.length;
  const inProgress = nonDrafts.filter(a => inProgressStatuses.includes(a.status)).length;
  const approved = nonDrafts.filter(a => a.status === 'approved' || a.status === 'invested').length;
  const rejected = nonDrafts.filter(a => a.status === 'rejected').length;

  const isEmpty = applications.length === 0;
  const allowNewApplication = canApplyAgain(applications);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <PageHeader
        title="My Application"
        description="Track the status of your investment proposal"
        action={
          allowNewApplication ? (
            <Link
              to="/applications/apply"
              className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Plus size={14} /> {applications.some(a => a.status === 'rejected') ? 'Re-Apply' : 'New Application'}
            </Link>
          ) : null
        }
      />

      {/* Loading state */}
      {loading && (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading applications...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && isEmpty && (
        <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl">
          <Inbox size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No application yet</p>
          <p className="text-xs text-gray-400 mb-5">Submit your investment proposal to get started</p>
          <Link
            to="/applications/apply"
            className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} /> Apply Now
          </Link>
        </div>
      )}

      {!loading && !isEmpty && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={<FileText size={16} className="text-indigo-500" />}
              label="Total Submitted"
              value={totalSubmitted}
              color="bg-indigo-50"
            />
            <StatCard
              icon={<TrendingUp size={16} className="text-amber-500" />}
              label="In Progress"
              value={inProgress}
              color="bg-amber-50"
            />
            <StatCard
              icon={<CheckCircle size={16} className="text-green-500" />}
              label="Approved"
              value={approved}
              color="bg-green-50"
            />
            <StatCard
              icon={<XCircle size={16} className="text-red-500" />}
              label="Rejected"
              value={rejected}
              color="bg-red-50"
            />
          </div>

          {/* Pipeline visualization */}
          <PipelineVisualization apps={applications} />

          {/* Draft section */}
          {drafts.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText size={14} className="text-amber-500" />
                Drafts
                <span className="text-xs font-medium text-gray-400">{drafts.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {drafts.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    expanded={expandedId === app.id}
                    onToggle={() => setExpandedId(expandedId === app.id ? null : app.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Submitted applications */}
          {nonDrafts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                Submitted Applications
                <span className="ml-2 text-xs font-medium text-gray-400">{nonDrafts.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {nonDrafts.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    expanded={expandedId === app.id}
                    onToggle={() => setExpandedId(expandedId === app.id ? null : app.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

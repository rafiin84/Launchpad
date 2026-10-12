import { useState, useEffect } from 'react';
import { Inbox, CheckCircle2, XCircle, Clock, ArrowRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getReviewerStats, type ReviewerStats } from '../services/investmentApplications';

const REVIEWER_QUEUE_TITLES: Record<1 | 2 | 3, (t: ReturnType<typeof useLanguage>['t']) => string> = {
  1: t => t.reviewerQueue.l1Title,
  2: t => t.reviewerQueue.l2Title,
  3: t => t.reviewerQueue.l3Title,
};

/**
 * The reviewer's own dashboard — replaces the investor's portfolio/CEO
 * dashboard for Level 1/2/3 Reviewer accounts. Shows only their own review
 * volume (received / approved / rejected / pending at their level), never
 * portfolio value, other companies' data, or other reviewers' stats.
 */
export default function ReviewerDashboard() {
  const { currentUser, reviewerLevel } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<ReviewerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reviewerLevel) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getReviewerStats(reviewerLevel)
      .then(s => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setError(t.reviewerDashboard.loadFailed); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reviewerLevel, t]);

  const queueTitle = reviewerLevel ? REVIEWER_QUEUE_TITLES[reviewerLevel](t) : '';

  const cards = stats ? [
    { label: t.reviewerDashboard.received, sub: t.reviewerDashboard.receivedSub, value: stats.received, icon: Inbox,       color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: t.reviewerDashboard.pending,  sub: t.reviewerDashboard.pendingSub,  value: stats.pending,  icon: Clock,       color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    { label: t.reviewerDashboard.approved, sub: t.reviewerDashboard.approvedSub, value: stats.approved, icon: CheckCircle2,color: 'text-green-600',   bg: 'bg-green-50' },
    { label: t.reviewerDashboard.rejected, sub: t.reviewerDashboard.rejectedSub, value: stats.rejected, icon: XCircle,     color: 'text-red-600',     bg: 'bg-red-50' },
  ] : [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
      <div className="flex items-center gap-5 mb-6">
        <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow flex-shrink-0 relative bg-indigo-100">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-indigo-700 font-bold text-sm">
              {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t.reviewerDashboard.greeting.replace('{name}', currentUser.name.split(' ')[0])}
          </h1>
          <p className="text-sm text-gray-500 mt-1 truncate">
            {t.reviewerDashboard.subtitle.replace('{title}', queueTitle)}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4 mb-6">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        {(loading ? Array.from({ length: 4 }) : cards).map((stat, i) => {
          if (loading || !stat) {
            return (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-gray-100 mb-3" />
                <div className="h-6 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-50 rounded w-3/4" />
              </div>
            );
          }
          const s = stat as { label: string; sub: string; value: number; icon: typeof Inbox; color: string; bg: string };
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-3 ${s.bg}`}>
                <Icon size={14} className={s.color} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs font-medium text-gray-600 mt-0.5">{s.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          );
        })}
      </div>

      <Link
        to="/applications"
        className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
      >
        {t.reviewerDashboard.goToQueue} <ArrowRight size={14} />
      </Link>
    </div>
  );
}

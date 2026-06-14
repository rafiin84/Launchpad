import { useState, useEffect } from 'react';
import {
  Trophy, Users, TrendingUp, Filter,
  DollarSign, Building2, Inbox, PieChart, BookOpen, Briefcase,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postsService } from '../services/postsService';
import { investmentsService } from '../services/investmentsService';
import { applicationsService } from '../services/dealsService';
import type { Post, PostType, Investment, Application } from '../types';
import { FeedCard } from '../components/feed/FeedCard';
import { CreatePost } from '../components/feed/CreatePost';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { mockUsers, mockCompanies, mockMilestones } from '../data/mockData';
import { cn } from '../lib/cn';

// ─── Sidebar widgets (founder) ────────────────────────────────────────────────

function RecentWinsWidget() {
  const wins = mockMilestones.slice(0, 3);
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Trophy size={15} className="text-emerald-500" />
        Recent Wins
      </h3>
      <div className="space-y-3">
        {wins.map((m) => {
          const company = mockCompanies.find((c) => c.id === m.companyId);
          return (
            <div key={m.id} className="flex gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                {company && (
                  <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 leading-snug">{m.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{company?.name}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SuggestedConnectionsWidget() {
  const founders = mockUsers.filter((u) => u.role === 'founder').slice(0, 3);
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Users size={15} className="text-indigo-500" />
        Suggested Connections
      </h3>
      <div className="space-y-3">
        {founders.map((user) => (
          <div key={user.id} className="flex items-center gap-2.5">
            <Avatar src={user.avatar} name={user.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.company?.name}</p>
            </div>
            <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex-shrink-0">
              Connect
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TrendingWidget() {
  const topics = [
    { label: 'Enterprise Pricing', count: 12 },
    { label: 'AI Product Strategy', count: 9 },
    { label: 'Series A Fundraising', count: 8 },
    { label: 'PLG Strategies', count: 7 },
    { label: 'Hiring Eng Leaders', count: 5 },
  ];
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <TrendingUp size={15} className="text-amber-500" />
        Trending Topics
      </h3>
      <div className="space-y-2">
        {topics.map((t, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-xs text-gray-700">{t.label}</span>
            <span className="text-xs text-gray-400">{t.count} posts</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Investor analytics dashboard ─────────────────────────────────────────────

function InvestorHome() {
  const { currentUser } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [summary, setSummary] = useState({
    totalCompanies: 0,
    totalDeployed: 0,
    totalCurrentValue: 0,
    avgMoic: 0,
  });

  useEffect(() => {
    investmentsService.getAll().then(setInvestments);
    investmentsService.getPortfolioSummary().then(setSummary);
    applicationsService.getAll().then(setApplications);
    postsService.getFeed().then(setPosts);
  }, []);

  const pendingApps = applications.filter(
    (a) => a.stage === 'new' || a.stage === 'reviewing'
  ).length;

  const activeDeals = applications.filter((a) =>
    ['meeting-scheduled', 'due-diligence', 'investment-committee'].includes(a.stage)
  ).length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const deployedFormatted = summary.totalDeployed >= 1_000_000
    ? `$${(summary.totalDeployed / 1_000_000).toFixed(1)}M`
    : `$${(summary.totalDeployed / 1_000).toFixed(0)}K`;

  const stats = [
    {
      label: 'Total Deployed',
      value: deployedFormatted,
      sub: 'across all funds',
      icon: DollarSign,
      accent: true,
    },
    {
      label: 'Startups Invested',
      value: investments.length || summary.totalCompanies,
      sub: 'portfolio companies',
      icon: Building2,
      accent: false,
    },
    {
      label: 'Active Deals',
      value: activeDeals,
      sub: 'in pipeline',
      icon: Briefcase,
      accent: false,
    },
    {
      label: 'Portfolio ROI',
      value: `${summary.avgMoic}x`,
      sub: 'average MOIC',
      icon: TrendingUp,
      accent: false,
    },
    {
      label: 'Pending Applications',
      value: pendingApps,
      sub: 'need review',
      icon: Inbox,
      accent: false,
    },
  ];

  const pipelineStages = [
    { label: 'New', count: applications.filter((a) => a.stage === 'new').length },
    { label: 'Reviewing', count: applications.filter((a) => a.stage === 'reviewing').length },
    { label: 'Meeting', count: applications.filter((a) => a.stage === 'meeting-scheduled').length },
    { label: 'Due Diligence', count: applications.filter((a) => a.stage === 'due-diligence').length },
    { label: 'IC Review', count: applications.filter((a) => a.stage === 'investment-committee').length },
    { label: 'Approved', count: applications.filter((a) => a.stage === 'approved').length },
  ];

  const quickActions = [
    { label: 'Review Applications', path: '/applications', icon: Inbox },
    { label: 'Deal Flow', path: '/deals', icon: TrendingUp },
    { label: 'Portfolio Overview', path: '/portfolio', icon: PieChart },
    { label: 'Knowledge Hub', path: '/knowledge', icon: BookOpen },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Welcome */}
      <div className="mb-7">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {greeting}, {currentUser.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here's your portfolio at a glance ·{' '}
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                'rounded-2xl p-5',
                stat.accent
                  ? 'bg-black text-white'
                  : 'bg-white border border-gray-100'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center mb-3',
                  stat.accent ? 'bg-white/15' : 'bg-gray-50'
                )}
              >
                <Icon size={16} className={stat.accent ? 'text-white' : 'text-gray-500'} />
              </div>
              <p className={cn('text-2xl font-bold mb-0.5', stat.accent ? 'text-white' : 'text-gray-900')}>
                {stat.value}
              </p>
              <p className={cn('text-xs font-semibold', stat.accent ? 'text-gray-200' : 'text-gray-700')}>
                {stat.label}
              </p>
              <p className={cn('text-xs mt-0.5', stat.accent ? 'text-gray-400' : 'text-gray-400')}>
                {stat.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Main + sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Feed */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Portfolio Activity</h2>
          <div className="space-y-4">
            {posts.slice(0, 4).map((post) => (
              <FeedCard key={post.id} post={post} />
            ))}
            {posts.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
                <p className="text-sm text-gray-400">No portfolio activity yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="hidden lg:block w-64 flex-shrink-0 space-y-4">
          {/* Deal pipeline */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp size={15} className="text-indigo-500" />
              Deal Pipeline
            </h3>
            <div className="space-y-0.5">
              {pipelineStages.map((s) => (
                <div key={s.label} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-gray-600">{s.label}</span>
                  <span className="text-xs font-semibold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.path}
                    to={action.path}
                    className="flex items-center gap-2.5 py-2.5 border-b border-gray-50 last:border-0 hover:text-indigo-600 transition-colors group"
                  >
                    <Icon size={14} className="text-gray-400 group-hover:text-indigo-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 group-hover:text-indigo-600">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Founder feed ──────────────────────────────────────────────────────────────

function FounderHome() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<PostType | 'all'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    postsService.getFeed().then(setPosts);
  }, [refreshKey]);

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.type === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Main feed */}
        <div className="flex-1 min-w-0">
          {/* Hero */}
          <div className="mb-5">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Welcome back, {currentUser.name.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentUser.company
                ? `Building ${currentUser.company.name} · Share what's happening`
                : "Share what's happening with your startup"}
            </p>
          </div>

          {/* Hero actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {[
              { type: 'win' as PostType, label: 'Share a Win', emoji: '🚀', desc: 'Launch, revenue, team', bg: 'bg-emerald-50 hover:bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-100' },
              { type: 'advice' as PostType, label: 'Ask for Advice', emoji: '💡', desc: 'Pricing, strategy, product', bg: 'bg-indigo-50 hover:bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-100' },
              { type: 'introduction' as PostType, label: 'Request an Intro', emoji: '🤝', desc: 'Customers, partners, experts', bg: 'bg-amber-50 hover:bg-amber-100', text: 'text-amber-800', border: 'border-amber-100' },
            ].map((action) => (
              <button
                key={action.type}
                className={`flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0 p-4 rounded-2xl border transition-all text-left ${action.bg} ${action.border}`}
                onClick={() => {}}
              >
                <span className="text-2xl sm:mb-2 flex-shrink-0">{action.emoji}</span>
                <div>
                  <span className={`text-sm font-semibold ${action.text} block`}>{action.label}</span>
                  <span className={`text-xs mt-0.5 opacity-70 ${action.text} hidden sm:block`}>{action.desc}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Create post */}
          <div className="mb-5">
            <CreatePost onPost={() => setRefreshKey((k) => k + 1)} />
          </div>

          {/* Feed filter */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Filter size={13} className="text-gray-400 flex-shrink-0" />
            {(['all', 'win', 'advice', 'introduction', 'insight'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  filter === f ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
              </button>
            ))}
          </div>

          {/* Feed */}
          <div className="space-y-4">
            {filtered.map((post) => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        </div>

        {/* Right sidebar — hidden on mobile */}
        <div className="hidden lg:block w-72 flex-shrink-0 space-y-4">
          <RecentWinsWidget />
          <SuggestedConnectionsWidget />
          <TrendingWidget />
        </div>
      </div>
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function Home() {
  const { isInvestor } = useAuth();
  return isInvestor ? <InvestorHome /> : <FounderHome />;
}

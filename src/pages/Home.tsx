import { useState, useEffect } from 'react';
import {
  Trophy, Users, TrendingUp, Filter,
  DollarSign, Building2, Inbox, PieChart, BookOpen, Briefcase,
  ArrowUpRight, BarChart2, Layers, Target, Activity, Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postsService } from '../services/postsService';
import { investmentsService } from '../services/investmentsService';
import { applicationsService } from '../services/dealsService';
import type { Post, PostType, Investment, Application } from '../types';
import { CreatePost } from '../components/feed/CreatePost';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { FeedCard } from '../components/feed/FeedCard';
import { mockUsers, mockCompanies, mockMilestones, mockInvestments } from '../data/mockData';
import { cn } from '../lib/cn';

// ─── Portfolio growth chart ────────────────────────────────────────────────────

const PORTFOLIO_GROWTH = [
  { month: 'Jan', value: 5.2 },
  { month: 'Feb', value: 6.1 },
  { month: 'Mar', value: 6.8 },
  { month: 'Apr', value: 7.5 },
  { month: 'May', value: 7.9 },
  { month: 'Jun', value: 8.3 },
  { month: 'Jul', value: 9.1 },
  { month: 'Aug', value: 9.6 },
  { month: 'Sep', value: 10.2 },
  { month: 'Oct', value: 11.0 },
  { month: 'Nov', value: 11.5 },
  { month: 'Dec', value: 12.4 },
];

function PortfolioGrowthChart() {
  const W = 400, H = 100;
  const PX = 4, PY = 8;
  const minV = Math.min(...PORTFOLIO_GROWTH.map(d => d.value));
  const maxV = Math.max(...PORTFOLIO_GROWTH.map(d => d.value));
  const range = maxV - minV || 1;
  const xOf = (i: number) => PX + (i / (PORTFOLIO_GROWTH.length - 1)) * (W - PX * 2);
  const yOf = (v: number) => PY + (1 - (v - minV) / range) * (H - PY * 2);
  const linePoints = PORTFOLIO_GROWTH.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ');
  const areaPoints = [
    `${xOf(0)},${H}`,
    ...PORTFOLIO_GROWTH.map((d, i) => `${xOf(i)},${yOf(d.value)}`),
    `${xOf(PORTFOLIO_GROWTH.length - 1)},${H}`,
  ].join(' ');
  const lastX = xOf(PORTFOLIO_GROWTH.length - 1);
  const lastY = yOf(PORTFOLIO_GROWTH[PORTFOLIO_GROWTH.length - 1].value);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Activity size={15} className="text-indigo-500" />
          Portfolio Value Growth
        </h3>
        <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full">
          +138% YTD
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-3">Total portfolio value (USD M)</p>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[100px]">
        <defs>
          <linearGradient id="pg-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#pg-area-grad)" />
        <polyline points={linePoints} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r="3.5" fill="#6366f1" />
      </svg>
      <div className="flex justify-between mt-1.5">
        {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map(m => (
          <span key={m} className="text-xs text-gray-400">{m}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Sector breakdown chart ────────────────────────────────────────────────────

const SECTOR_DATA = [
  { label: 'AI / Enterprise SaaS', amount: 1.5, color: '#6366f1' },
  { label: 'HealthTech', amount: 3.0, color: '#10b981' },
  { label: 'Developer Tools', amount: 0.5, color: '#8b5cf6' },
  { label: 'LegalTech', amount: 2.0, color: '#0ea5e9' },
];

function SectorBreakdownChart() {
  const total = SECTOR_DATA.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <BarChart2 size={15} className="text-indigo-500" />
        Investment by Sector
      </h3>
      <p className="text-xs text-gray-400 mb-4">Portfolio allocation (USD M)</p>
      <div className="space-y-3">
        {SECTOR_DATA.map(s => (
          <div key={s.label}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-gray-700">{s.label}</span>
              <span className="text-xs font-semibold text-gray-900">${s.amount}M</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(s.amount / total) * 100}%`, backgroundColor: s.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {SECTOR_DATA.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-gray-500">{Math.round((s.amount / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Portfolio snapshot grid ───────────────────────────────────────────────────

const STAGE_STYLES: Record<string, string> = {
  'pre-seed':  'bg-gray-100 text-gray-600',
  'seed':      'bg-violet-50 text-violet-700',
  'series-a':  'bg-blue-50 text-blue-700',
  'series-b':  'bg-indigo-50 text-indigo-700',
  'series-c':  'bg-sky-50 text-sky-700',
  'growth':    'bg-emerald-50 text-emerald-700',
};

function PortfolioSnapshotGrid({ investments }: { investments: Investment[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Portfolio Snapshot</h2>
        <Link to="/portfolio" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
          View all <ArrowUpRight size={12} />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {investments.map(inv => {
          const latestMilestone = inv.company.publicMilestones?.[0];
          const moic = inv.moic ?? 1;
          return (
            <Link
              key={inv.id}
              to={`/companies/${inv.company.id}`}
              className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all group"
            >
              {/* Company header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50">
                  <img src={inv.company.logo} alt={inv.company.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                    {inv.company.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{inv.company.industry}</p>
                  <span className={cn('inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium', STAGE_STYLES[inv.company.stage] ?? 'bg-gray-100 text-gray-600')}>
                    {inv.round}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn('text-base font-bold', moic >= 1.5 ? 'text-emerald-600' : moic >= 1.2 ? 'text-gray-900' : 'text-gray-500')}>
                    {moic}x
                  </p>
                  <p className="text-xs text-gray-400">MOIC</p>
                </div>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-sm font-bold text-gray-900">${(inv.amount / 1_000_000).toFixed(1)}M</p>
                  <p className="text-xs text-gray-500 mt-0.5">Invested</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-sm font-bold text-gray-900">{inv.ownership}%</p>
                  <p className="text-xs text-gray-500 mt-0.5">Equity</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-sm font-bold text-gray-900">
                    ${((inv.currentValuation ?? inv.valuation) / 1_000_000).toFixed(0)}M
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Val.</p>
                </div>
              </div>

              {/* Latest milestone */}
              {latestMilestone ? (
                <div className="border-t border-gray-50 pt-3 flex items-start gap-2">
                  <span className="text-sm">🏆</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-0.5">Latest milestone</p>
                    <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-1">{latestMilestone.title}</p>
                  </div>
                </div>
              ) : (
                <div className="border-t border-gray-50 pt-3">
                  <p className="text-xs text-gray-400">No milestones yet</p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Active deals in progress ──────────────────────────────────────────────────

const DEAL_STAGE_CONFIG: Record<string, { label: string; style: string }> = {
  'meeting-scheduled':   { label: 'Meeting', style: 'bg-blue-50 text-blue-700' },
  'due-diligence':       { label: 'Due Diligence', style: 'bg-amber-50 text-amber-700' },
  'investment-committee':{ label: 'IC Review', style: 'bg-purple-50 text-purple-700' },
  'approved':            { label: 'Approved', style: 'bg-emerald-50 text-emerald-700' },
  'reviewing':           { label: 'Reviewing', style: 'bg-gray-100 text-gray-600' },
  'new':                 { label: 'New', style: 'bg-gray-100 text-gray-500' },
};

function ActiveDealsSection({ applications }: { applications: Application[] }) {
  const active = applications.filter(a =>
    ['meeting-scheduled', 'due-diligence', 'investment-committee', 'approved'].includes(a.stage)
  );

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Clock size={15} className="text-indigo-500" />
          Active Deals In Progress
        </h3>
        <Link to="/applications" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
          View all <ArrowUpRight size={12} />
        </Link>
      </div>

      {active.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No active deals in progress</p>
      ) : (
        <div className="space-y-0">
          {active.map((app, idx) => {
            const cfg = DEAL_STAGE_CONFIG[app.stage];
            return (
              <Link
                key={app.id}
                to="/applications"
                className={cn(
                  'flex items-center gap-3 py-3 hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors group',
                  idx < active.length - 1 ? 'border-b border-gray-50' : ''
                )}
              >
                {/* Company logo */}
                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50">
                  <img src={app.company.logo} alt={app.company.name} className="w-full h-full object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                      {app.company.name}
                    </p>
                    {cfg && (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', cfg.style)}>
                        {cfg.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Avatar src={app.founder.avatar} name={app.founder.name} size="sm" />
                    <p className="text-xs text-gray-500">{app.founder.name}</p>
                    <span className="text-gray-200">·</span>
                    <p className="text-xs text-gray-400">{app.company.industry}</p>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-gray-900">
                    ${(app.fundingRequested / 1_000_000).toFixed(1)}M
                  </p>
                  <p className="text-xs text-gray-400">asked</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
        {wins.map(m => {
          const company = mockCompanies.find(c => c.id === m.companyId);
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
  const founders = mockUsers.filter(u => u.role === 'founder').slice(0, 3);
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Users size={15} className="text-indigo-500" />
        Suggested Connections
      </h3>
      <div className="space-y-3">
        {founders.map(user => (
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
  }, []);

  const pendingApps = applications.filter(
    a => a.stage === 'new' || a.stage === 'reviewing'
  ).length;

  const activeDeals = applications.filter(a =>
    ['meeting-scheduled', 'due-diligence', 'investment-committee'].includes(a.stage)
  ).length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

  const unrealizedGain = summary.totalCurrentValue - summary.totalDeployed;
  const avgOwnership = investments.length > 0
    ? (investments.reduce((s, i) => s + i.ownership, 0) / investments.length).toFixed(1)
    : '0';

  const kpiCards = [
    { label: 'Total Deployed',  value: fmt(summary.totalDeployed),       sub: 'across all funds',    icon: DollarSign, accent: true,  path: '/investments' },
    { label: 'Portfolio Value', value: fmt(summary.totalCurrentValue),    sub: 'current valuation',   icon: TrendingUp, accent: false, path: '/portfolio' },
    { label: 'Unrealized Gain', value: unrealizedGain > 0 ? `+${fmt(unrealizedGain)}` : fmt(unrealizedGain), sub: 'total appreciation', icon: ArrowUpRight, accent: false, path: '/investments' },
    { label: 'Portfolio ROI',   value: `${summary.avgMoic}x`,            sub: 'average MOIC',        icon: BarChart2,  accent: false, path: '/investments' },
    { label: 'Companies',       value: investments.length || summary.totalCompanies, sub: 'portfolio companies', icon: Building2, accent: false, path: '/portfolio' },
    { label: 'Active Deals',    value: activeDeals,                      sub: 'in pipeline',         icon: Briefcase,  accent: false, path: '/deals' },
    { label: 'Applications',    value: pendingApps,                      sub: 'need review',         icon: Inbox,      accent: false, path: '/applications' },
    { label: 'Avg Ownership',   value: `${avgOwnership}%`,               sub: 'per company',         icon: Layers,     accent: false, path: '/portfolio' },
    { label: 'Active Funds',    value: 2,                                sub: 'fund vehicles',       icon: Target,     accent: false, path: '/funds' },
  ];

  const pipelineStages = [
    { label: 'New',           count: applications.filter(a => a.stage === 'new').length },
    { label: 'Reviewing',     count: applications.filter(a => a.stage === 'reviewing').length },
    { label: 'Meeting',       count: applications.filter(a => a.stage === 'meeting-scheduled').length },
    { label: 'Due Diligence', count: applications.filter(a => a.stage === 'due-diligence').length },
    { label: 'IC Review',     count: applications.filter(a => a.stage === 'investment-committee').length },
    { label: 'Approved',      count: applications.filter(a => a.stage === 'approved').length },
  ];

  const quickActions = [
    { label: 'Review Applications', path: '/applications', icon: Inbox },
    { label: 'Deal Flow',           path: '/deals',        icon: TrendingUp },
    { label: 'Portfolio Overview',  path: '/portfolio',    icon: PieChart },
    { label: 'Knowledge Hub',       path: '/knowledge',    icon: BookOpen },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {greeting}, {currentUser.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here's your portfolio at a glance ·{' '}
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI cards — full-width scrollable */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {kpiCards.map(card => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.path}
              className={cn(
                'flex-shrink-0 w-44 rounded-2xl p-5 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer',
                card.accent ? 'bg-black text-white' : 'bg-white border border-gray-100 hover:border-gray-200'
              )}
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', card.accent ? 'bg-white/15' : 'bg-gray-50')}>
                <Icon size={16} className={card.accent ? 'text-white' : 'text-gray-500'} />
              </div>
              <p className={cn('text-2xl font-bold mb-0.5', card.accent ? 'text-white' : 'text-gray-900')}>
                {card.value}
              </p>
              <p className={cn('text-xs font-semibold', card.accent ? 'text-gray-200' : 'text-gray-700')}>
                {card.label}
              </p>
              <p className={cn('text-xs mt-0.5', card.accent ? 'text-gray-400' : 'text-gray-400')}>
                {card.sub}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <PortfolioGrowthChart />
          <SectorBreakdownChart />
        </div>

        {/* Portfolio snapshot + Active deals + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-6">
            <PortfolioSnapshotGrid investments={mockInvestments} />
            <ActiveDealsSection applications={applications} />
          </div>

          {/* Right sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
            {/* Deal pipeline */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp size={15} className="text-indigo-500" />
                Deal Pipeline
              </h3>
              <div className="space-y-0.5">
                {pipelineStages.map(s => (
                  <div key={s.label} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-600">{s.label}</span>
                    <span className="text-xs font-semibold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
              <Link to="/applications" className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                View all deals <ArrowUpRight size={12} />
              </Link>
            </div>

            {/* Quick actions */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div>
                {quickActions.map(action => {
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

  const filtered = filter === 'all' ? posts : posts.filter(p => p.type === filter);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Main feed */}
        <div className="flex-1 min-w-0">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {[
              { type: 'win' as PostType, label: 'Share a Win', emoji: '🚀', desc: 'Launch, revenue, team', bg: 'bg-emerald-50 hover:bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-100' },
              { type: 'advice' as PostType, label: 'Ask for Advice', emoji: '💡', desc: 'Pricing, strategy, product', bg: 'bg-indigo-50 hover:bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-100' },
              { type: 'introduction' as PostType, label: 'Request an Intro', emoji: '🤝', desc: 'Customers, partners, experts', bg: 'bg-amber-50 hover:bg-amber-100', text: 'text-amber-800', border: 'border-amber-100' },
            ].map(action => (
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

          <div className="mb-5">
            <CreatePost onPost={() => setRefreshKey(k => k + 1)} />
          </div>

          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Filter size={13} className="text-gray-400 flex-shrink-0" />
            {(['all', 'win', 'advice', 'introduction', 'insight'] as const).map(f => (
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

          <div className="space-y-4">
            {filtered.map(post => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        </div>

        {/* Right sidebar */}
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

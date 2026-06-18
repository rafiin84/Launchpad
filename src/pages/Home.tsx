import { useState, useEffect } from 'react';
import {
  DollarSign, Building2, Inbox, Briefcase,
  ArrowUpRight, TrendingUp, AlertCircle, Plus, BarChart2,
  Percent, Layers, PieChart, Target, Award,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CompanyLogo } from '../components/ui/CompanyLogo';
import { fetchCRMPortfolio, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { fetchCRMDeals, type CRMDeal } from '../services/crmDeals';
import { fetchCRMApplications, type CRMApplication } from '../services/crmApplications';
import { loadToken } from '../services/oauth';
import { cn } from '../lib/cn';
import FounderDashboard from './FounderDashboard';

// ─── Chart constants ───────────────────────────────────────────────────────────

const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const GROWTH_VALUES = [7.0, 7.1, 7.35, 7.6, 7.85, 8.05, 8.25, 8.5, 8.7, 8.9, 9.1, 9.3];

const PIPELINE_STAGES_CONFIG: { id: string; label: string; color: string }[] = [
  { id: 'New',                  label: 'New',               color: '#6b7280' },
  { id: 'Under Review',         label: 'Under Review',      color: '#3b82f6' },
  { id: 'Meeting Scheduled',    label: 'Meeting Scheduled', color: '#8b5cf6' },
  { id: 'Due Diligence',        label: 'Due Diligence',     color: '#f59e0b' },
  { id: 'IC Review',            label: 'IC Review',         color: '#10b981' },
  { id: 'Rejected',             label: 'Rejected',          color: '#ef4444' },
];

// ─── Portfolio Growth Chart ────────────────────────────────────────────────────

function PortfolioGrowthChart() {
  const W = 460, H = 160;
  const pad = { top: 18, right: 12, bottom: 32, left: 44 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const minVal = 6.8, maxVal = 9.6;

  const xs = GROWTH_VALUES.map((_, i) => pad.left + (i / (GROWTH_VALUES.length - 1)) * chartW);
  const ys = GROWTH_VALUES.map(v => pad.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH);
  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(1)},${(pad.top + chartH).toFixed(1)} L${xs[0].toFixed(1)},${(pad.top + chartH).toFixed(1)} Z`;
  const yTicks = [7.0, 7.5, 8.0, 8.5, 9.0];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Portfolio Value Over Time</h3>
          <p className="text-xs text-gray-400 mt-0.5">Jul 2024 – Jun 2025</p>
        </div>
        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
          <ArrowUpRight size={12} />+32.9%
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {yTicks.map(v => {
          const y = pad.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
          return (
            <g key={v}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={pad.left - 5} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">${v}M</text>
            </g>
          );
        })}
        {MONTHS.map((m, i) => i % 2 === 0
          ? <text key={i} x={xs[i]} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#9ca3af">{m}</text>
          : null
        )}
        <path d={areaPath} fill="url(#pgGrad)" />
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3.5" fill="white" stroke="#6366f1" strokeWidth="2" />
      </svg>
    </div>
  );
}

// ─── MOIC Placeholder ─────────────────────────────────────────────────────────

function MoicChart() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[200px]">
      <BarChart2 size={28} className="text-gray-200" />
      <p className="text-sm font-medium text-gray-500">MOIC Chart</p>
      <p className="text-xs text-gray-400">Add portfolio companies with investment data to see MOIC analytics.</p>
    </div>
  );
}

// ─── Pipeline Funnel Chart ────────────────────────────────────────────────────

function PipelineFunnelChart({ apps }: { apps: CRMApplication[] }) {
  const counts = PIPELINE_STAGES_CONFIG.map(s => ({
    ...s,
    count: apps.filter(a => a.pipelineStage === s.id).length,
  }));
  const max = Math.max(...counts.map(c => c.count), 1);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Pipeline Funnel</h3>
        <p className="text-xs text-gray-400 mt-0.5">Applications per stage</p>
      </div>
      <div className="space-y-3">
        {counts.map(s => (
          <div key={s.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600 w-36 flex-shrink-0">{s.label}</span>
              <span className="text-xs font-bold text-gray-900">{s.count}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(s.count / max) * 100}%`, backgroundColor: s.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Funding Ask by Industry ──────────────────────────────────────────────────

function IndustryBreakdownChart({ apps }: { apps: CRMApplication[] }) {
  const byIndustry: Record<string, number> = {};
  apps.forEach(a => {
    const ind = a.industry || 'Unknown';
    byIndustry[ind] = (byIndustry[ind] ?? 0) + (parseFloat(a.fundingAsk) || 0);
  });
  const data = Object.entries(byIndustry).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = data[0]?.[1] ?? 1;
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ef4444'];
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Funding Ask by Industry</h3>
        <p className="text-xs text-gray-400 mt-0.5">Total requested per sector</p>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No data yet</p>
      ) : (
        <div className="space-y-3">
          {data.map(([industry, amount], i) => (
            <div key={industry}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 truncate w-40 flex-shrink-0">{industry}</span>
                <span className="text-xs font-bold text-gray-900">{fmt(amount)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(amount / max) * 100}%`, backgroundColor: colors[i] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const STAGE_STYLES: Record<string, string> = {
  'Pre-Seed': 'bg-gray-100 text-gray-600',
  'Seed':     'bg-violet-50 text-violet-700',
  'Series A': 'bg-blue-50 text-blue-700',
  'Series B': 'bg-indigo-50 text-indigo-700',
  'Series C': 'bg-sky-50 text-sky-700',
  'Growth':   'bg-emerald-50 text-emerald-700',
};

export default function Home() {
  const { currentUser, isFounder } = useAuth();

  // Founders get their own dedicated dashboard
  if (isFounder) return <FounderDashboard />;
  const isConnected = !!loadToken();

  const [portfolio, setPortfolio] = useState<CRMPortfolioRecord[]>([]);
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [applications, setApplications] = useState<CRMApplication[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  useEffect(() => {
    if (!isConnected) {
      setLoadingPortfolio(false);
      setLoadingDeals(false);
      setLoadingApps(false);
      return;
    }
    fetchCRMPortfolio()
      .then(setPortfolio)
      .catch(() => {})
      .finally(() => setLoadingPortfolio(false));
    fetchCRMDeals()
      .then(setDeals)
      .catch(() => {})
      .finally(() => setLoadingDeals(false));
    fetchCRMApplications()
      .then(setApplications)
      .catch(() => {})
      .finally(() => setLoadingApps(false));
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const activeDeals = deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').length;

  const recentPortfolio = portfolio.slice(0, 4);
  const recentDeals = deals.slice(0, 4);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Welcome */}
      <div className="flex items-center gap-3 mb-6">
        {currentUser.avatar ? (
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow flex-shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center ring-2 ring-white shadow flex-shrink-0">
            <span className="text-gray-600 font-bold text-sm">
              {currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {greeting}, {currentUser.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here's your portfolio at a glance ·{' '}
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        </div>
      </div>

      {/* Not-connected banner */}
      {!isConnected && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Connect Zoho CRM to see live data</p>
            <p className="text-xs text-amber-600 mt-0.5">Go to Login and sign in with Zoho CRM.</p>
          </div>
          <Link to="/login" className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">
            Connect
          </Link>
        </div>
      )}

      {/* Combined KPI chips row — top-4 summary cards merged with portfolio KPIs */}
      {(() => {
        const totalDeployed = portfolio.reduce((s, c) => s + (parseFloat(c.investmentAmount) || 0), 0);
        const totalPreMoney = portfolio.reduce((s, c) => s + (parseFloat(c.preMoneyValuation) || 0), 0);
        const avgOwnership = portfolio.length ? portfolio.reduce((s, c) => s + (parseFloat(c.ownershipPct) || 0), 0) / portfolio.length : 0;
        const activeCount = portfolio.filter(c => c.status === 'active').length;
        const seedCount = portfolio.filter(c => c.stage === 'seed').length;
        const seriesACount = portfolio.filter(c => c.stage === 'series-a').length;
        const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;

        // Chips that are also navigation links
        const linkedChips = [
          { label: 'Total Invested',      value: fmt(totalDeployed),                path: '/portfolio',   icon: <DollarSign size={16} />, accent: true,  loading: loadingPortfolio, sub: 'across portfolio' },
          { label: 'Portfolio Companies', value: String(portfolio.length),          path: '/portfolio',   icon: <Building2 size={16} />,  accent: false, loading: loadingPortfolio, sub: `${activeCount} active` },
          { label: 'Active Deals',        value: String(activeDeals),              path: '/deals',       icon: <Briefcase size={16} />,  accent: false, loading: loadingDeals,     sub: 'in pipeline' },
          { label: 'Applications',        value: String(applications.length),       path: '/applications',icon: <Inbox size={16} />,      accent: false, loading: loadingApps,      sub: 'submitted' },
        ];

        // Static portfolio metric chips (no link)
        const staticChips: { label: string; value: string; sub: string; icon: React.ReactElement; color?: string }[] = [
          { label: 'Total Deployed',   value: totalDeployed > 0 ? fmt(totalDeployed) : '—',                                           sub: 'capital invested',   icon: <DollarSign size={16} /> },
          { label: 'Avg Ownership',    value: avgOwnership > 0 ? `${avgOwnership.toFixed(1)}%` : '—',                                 sub: 'per company',        icon: <Percent size={16} /> },
          { label: 'Avg Deal Size',    value: portfolio.length > 0 && totalDeployed > 0 ? fmt(totalDeployed / portfolio.length) : '—', sub: 'per investment',     icon: <DollarSign size={16} /> },
          { label: 'Entry Valuations', value: totalPreMoney > 0 ? fmt(totalPreMoney) : '—',                                           sub: 'combined pre-money', icon: <TrendingUp size={16} />, color: 'text-emerald-600' },
          { label: 'Stage Mix',        value: `${seedCount}S / ${seriesACount}A`,                                                     sub: 'Seed / Series A',    icon: <Layers size={16} /> },
          { label: 'Portfolio Value',  value: totalDeployed > 0 ? fmt(totalDeployed) : '—',                                           sub: 'at cost basis',      icon: <BarChart2 size={16} />, color: 'text-indigo-600' },
          { label: 'Active',           value: String(activeCount),                                                                    sub: 'active investments',  icon: <Award size={16} />,    color: 'text-amber-600' },
          { label: 'Est. IRR',         value: '—',                                                                                    sub: 'add more data',      icon: <Target size={16} />,   color: 'text-emerald-600' },
          { label: 'MOIC',             value: '—',                                                                                    sub: 'mark to market',     icon: <PieChart size={16} /> },
        ];

        return (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {/* Linked navigation chips */}
            {linkedChips.map(chip => (
              <Link
                key={chip.label}
                to={chip.path}
                className={`flex-shrink-0 w-44 rounded-2xl p-5 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ${chip.accent ? 'bg-black' : 'bg-white border border-gray-100 hover:border-gray-200'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${chip.accent ? 'bg-white/15' : 'bg-gray-50'}`}>
                  <span className={chip.accent ? 'text-white' : 'text-gray-500'}>{chip.icon}</span>
                </div>
                {chip.loading ? (
                  <div className="h-7 bg-gray-200/40 rounded w-16 mb-1 animate-pulse" />
                ) : (
                  <p className={`text-2xl font-bold mb-0.5 ${chip.accent ? 'text-white' : 'text-gray-900'}`}>{chip.value}</p>
                )}
                <p className={`text-xs font-semibold ${chip.accent ? 'text-gray-200' : 'text-gray-700'}`}>{chip.label}</p>
                <p className={`text-xs mt-0.5 ${chip.accent ? 'text-gray-400' : 'text-gray-400'}`}>{chip.sub}</p>
              </Link>
            ))}
            {/* Divider */}
            <div className="flex-shrink-0 w-px bg-gray-200 self-stretch my-2" />
            {/* Static portfolio metric chips */}
            {staticChips.map(chip => (
              <div key={chip.label} className="flex-shrink-0 w-44 rounded-2xl p-5 bg-white border border-gray-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-gray-50">
                  <span className="text-gray-500">{chip.icon}</span>
                </div>
                <p className={`text-2xl font-bold mb-0.5 ${chip.color ?? 'text-gray-900'}`}>{chip.value}</p>
                <p className="text-xs font-semibold text-gray-700">{chip.label}</p>
                <p className="text-xs mt-0.5 text-gray-400">{chip.sub}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Analytics section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Performance Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <PortfolioGrowthChart />
          <MoicChart />
        </div>

        {/* Recent Portfolio Companies — between chart rows */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Portfolio Companies</h2>
            <Link to="/portfolio" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>

          {loadingPortfolio ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recentPortfolio.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-100 rounded-2xl p-8 text-center">
              <Building2 size={24} className="text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400 mb-3">No portfolio companies yet</p>
              <Link to="/portfolio/new" className="inline-flex items-center gap-1.5 text-xs font-medium bg-black text-white px-3 py-1.5 rounded-lg">
                <Plus size={12} /> Add Company
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentPortfolio.map(company => (
                <Link key={company.id} to={`/portfolio/${company.id}`} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all group">
                  <div className="flex items-start gap-3 mb-3">
                    <CompanyLogo name={company.companyName || '?'} website={company.website} size={10} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                        {company.companyName || '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{company.industry || '—'}</p>
                      {company.stage && (
                        <span className={cn('inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium', STAGE_STYLES[company.stage] ?? 'bg-gray-100 text-gray-600')}>
                          {company.stage}
                        </span>
                      )}
                    </div>
                    {company.investmentAmount && parseFloat(company.investmentAmount) > 0 && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(parseFloat(company.investmentAmount))}</p>
                        <p className="text-xs text-gray-400">invested</p>
                      </div>
                    )}
                  </div>
                  {company.shortDescription && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{company.shortDescription}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PipelineFunnelChart apps={applications} />
          <IndustryBreakdownChart apps={applications} />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* Recent Deals */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Deals</h2>
              <Link to="/deals" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                View all <ArrowUpRight size={12} />
              </Link>
            </div>

            {loadingDeals ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : recentDeals.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-100 rounded-2xl p-8 text-center">
                <TrendingUp size={24} className="text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400 mb-3">No deals yet</p>
                <Link to="/deals/new" className="inline-flex items-center gap-1.5 text-xs font-medium bg-black text-white px-3 py-1.5 rounded-lg">
                  <Plus size={12} /> Add Deal
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDeals.map(deal => (
                  <div key={deal.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      <TrendingUp size={14} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{deal.dealName || '—'}</p>
                      <p className="text-xs text-gray-500">{deal.stage || '—'}</p>
                    </div>
                    {deal.amount && parseFloat(deal.amount) > 0 && (
                      <p className="text-sm font-bold text-gray-900 flex-shrink-0">{formatCurrency(parseFloat(deal.amount))}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

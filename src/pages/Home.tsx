import { useState, useEffect } from 'react';
import {
  DollarSign, Building2, Inbox, Briefcase,
  ArrowUpRight, TrendingUp, AlertCircle, Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchCRMPortfolio, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { fetchCRMDeals, type CRMDeal } from '../services/crmDeals';
import { fetchCRMApplications, type CRMApplication } from '../services/crmApplications';
import { loadToken } from '../services/oauth';
import { cn } from '../lib/cn';

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
  const { currentUser } = useAuth();
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

  const totalInvested = portfolio.reduce((s, r) => s + (parseFloat(r.investmentAmount) || 0), 0);
  const activeDeals = deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').length;

  const kpiCards = [
    { label: 'Total Invested',      value: formatCurrency(totalInvested), sub: 'across portfolio', icon: DollarSign, accent: true,  path: '/investments', loading: loadingPortfolio },
    { label: 'Portfolio Companies', value: portfolio.length,              sub: 'active companies', icon: Building2,  accent: false, path: '/portfolio',   loading: loadingPortfolio },
    { label: 'Active Deals',        value: activeDeals,                  sub: 'in pipeline',      icon: Briefcase,  accent: false, path: '/deals',       loading: loadingDeals },
    { label: 'Applications',        value: applications.length,          sub: 'submitted',        icon: Inbox,      accent: false, path: '/applications',loading: loadingApps },
  ];

  const recentPortfolio = portfolio.slice(0, 4);
  const recentDeals = deals.slice(0, 4);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {greeting}, {currentUser.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here's your portfolio at a glance ·{' '}
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
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

      {/* KPI cards */}
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
              {card.loading ? (
                <div className="h-7 bg-gray-200/40 rounded w-16 mb-1 animate-pulse" />
              ) : (
                <p className={cn('text-2xl font-bold mb-0.5', card.accent ? 'text-white' : 'text-gray-900')}>
                  {card.value}
                </p>
              )}
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

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* Recent Portfolio */}
          <div>
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
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
                        <Building2 size={16} className="text-gray-400" />
                      </div>
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

        {/* Sidebar */}
        <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
          {/* Quick actions */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div>
              {[
                { label: 'Review Applications', path: '/applications', icon: Inbox },
                { label: 'Deal Flow',           path: '/deals',        icon: TrendingUp },
                { label: 'Portfolio Overview',  path: '/portfolio',    icon: Building2 },
                { label: 'Investments',         path: '/investments',  icon: DollarSign },
              ].map(action => {
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

          {/* Deal pipeline summary */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp size={15} className="text-indigo-500" />
              Deal Pipeline
            </h3>
            {loadingDeals ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex justify-between py-1">
                    <div className="h-3 bg-gray-100 rounded w-24" />
                    <div className="h-3 bg-gray-100 rounded w-6" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {['Qualification', 'Value Proposition', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won'].map(stage => (
                  <div key={stage} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-600 truncate mr-2">{stage}</span>
                    <span className="text-xs font-semibold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {deals.filter(d => d.stage === stage).length}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link to="/deals" className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              View all deals <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

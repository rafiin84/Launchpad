import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CompanyLogo } from '../components/ui/CompanyLogo';
import {
  TrendingUp,
  DollarSign,
  Building2,
  ArrowUpRight,
  Target,
  Award,
  BarChart2,
  Percent,
  Layers,
  PieChart,
  Plus,
  MapPin,
  Calendar,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { fetchCRMPortfolio, deleteCRMPortfolioRecord, setPortfolioModuleOverride, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { fetchZohoModules, type ZohoModule } from '../services/zohoApi';
import { loadToken } from '../services/oauth';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

// ─── Chart constants ───────────────────────────────────────────────────────────

const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const GROWTH_VALUES = [7.0, 7.1, 7.35, 7.6, 7.85, 8.05, 8.25, 8.5, 8.7, 8.9, 9.1, 9.3];


// ─── Portfolio Value Growth (area chart) ──────────────────────────────────────

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
          <ArrowUpRight size={12} />
          +32.9%
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {yTicks.map((v) => {
          const y = pad.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
          return (
            <g key={v}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={pad.left - 5} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">${v}M</text>
            </g>
          );
        })}
        {MONTHS.map((m, i) =>
          i % 2 === 0 ? (
            <text key={i} x={xs[i]} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#9ca3af">{m}</text>
          ) : null
        )}
        <path d={areaPath} fill="url(#pgGrad)" />
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3.5" fill="white" stroke="#6366f1" strokeWidth="2" />
      </svg>
    </div>
  );
}

// ─── KPI Chip row ─────────────────────────────────────────────────────────────

interface KpiChip {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
  accent?: boolean;
  onClick?: () => void;
}

function KpiChipRow({ chips }: { chips: KpiChip[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {chips.map((chip) => (
        <div
          key={chip.label}
          onClick={chip.onClick}
          className={`flex-shrink-0 w-44 rounded-2xl p-5 transition-all ${
            chip.accent ? 'bg-black' : 'bg-white border border-gray-100 hover:border-gray-200'
          } ${chip.onClick ? 'cursor-pointer hover:scale-[1.03] hover:shadow-md active:scale-[0.97]' : ''}`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${chip.accent ? 'bg-white/15' : 'bg-gray-50'}`}>
            <span className={chip.accent ? 'text-white' : 'text-gray-500'}>{chip.icon}</span>
          </div>
          <p className={`text-2xl font-bold mb-0.5 ${chip.accent ? 'text-white' : (chip.color ?? 'text-gray-900')}`}>
            {chip.value}
          </p>
          <p className={`text-xs font-semibold ${chip.accent ? 'text-gray-200' : 'text-gray-700'}`}>
            {chip.label}
          </p>
          {chip.sub && (
            <p className={`text-xs mt-0.5 ${chip.accent ? 'text-gray-400' : 'text-gray-400'}`}>
              {chip.sub}
            </p>
          )}
          {chip.onClick && (
            <p className="text-[10px] text-indigo-400 mt-1.5 font-medium">↓ View list</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── CRM Company Card ────────────────────────────────────────────────────────

function CRMCompanyCard({ c, onDelete }: { c: CRMPortfolioRecord; onDelete: (id: string) => void }) {
  const amount = parseFloat(c.investmentAmount) || 0;
  const statusColors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    exited: 'bg-indigo-50 text-indigo-700',
    'written-off': 'bg-red-50 text-red-600',
    'follow-on': 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <Link to={`/portfolio/${c.id}`} className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
          <CompanyLogo name={c.companyName || '?'} website={c.website} size={10} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{c.companyName}</p>
            <p className="text-xs text-gray-400 capitalize">{c.industry}{c.stage ? ` · ${c.stage}` : ''}</p>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {c.status && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
            </span>
          )}
          <Link
            to={`/portfolio/${c.id}/edit`}
            className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
            title="Edit"
          >
            <Pencil size={13} />
          </Link>
          <button
            onClick={() => onDelete(c.id)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <Link to={`/portfolio/${c.id}`} className="block cursor-pointer">
        {c.shortDescription && <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">{c.shortDescription}</p>}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
          <div>
            <p className="text-xs text-gray-400">Invested</p>
            <p className="text-sm font-bold text-gray-900">{amount >= 1000000 ? `$${(amount/1000000).toFixed(1)}M` : amount >= 1000 ? `$${(amount/1000).toFixed(0)}K` : `$${amount}`}</p>
          </div>
          {c.ownershipPct && (
            <div>
              <p className="text-xs text-gray-400">Ownership</p>
              <p className="text-sm font-bold text-gray-900">{c.ownershipPct}%</p>
            </div>
          )}
        </div>
        {(c.location || c.investmentDate) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            {c.location && <span className="flex items-center gap-1"><MapPin size={10} />{c.location}</span>}
            {c.investmentDate && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(c.investmentDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
          </div>
        )}
      </Link>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const [crmCompanies, setCrmCompanies] = useState<CRMPortfolioRecord[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmError, setCrmError] = useState('');
  const [availableModules, setAvailableModules] = useState<ZohoModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isConnected = !!loadToken();

  // Ref for the Portfolio Companies section
  const companiesSectionRef = useRef<HTMLDivElement>(null);

  // Parallax-style smooth scroll using easeInOutCubic easing
  // The scroll container is the <main> element in AppLayout (overflow-y-auto), not window
  const scrollToCompanies = useCallback(() => {
    const target = companiesSectionRef.current;
    if (!target) return;

    // Walk up the DOM to find the scrollable <main> container
    const scrollEl = target.closest('main') as HTMLElement | null;
    if (!scrollEl) return;

    const startY = scrollEl.scrollTop;
    // target's offset relative to scrollEl
    const targetY = target.offsetTop - 80;
    const distance = targetY - startY;
    const duration = Math.min(1200, Math.max(600, Math.abs(distance) * 0.6));
    let startTime: number | null = null;

    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      (scrollEl as HTMLElement).scrollTop = startY + distance * easeInOutCubic(progress);
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }, []);

  const loadCRMData = () => {
    if (!isConnected) { setCrmLoading(false); return; }
    setCrmLoading(true);
    setCrmError('');
    fetchCRMPortfolio()
      .then(data => { setCrmCompanies(data); setAvailableModules([]); })
      .catch(err => setCrmError(err instanceof Error ? err.message : 'Failed to load CRM data'))
      .finally(() => setCrmLoading(false));
  };

  const handleFetchModules = () => {
    setModulesLoading(true);
    fetchZohoModules()
      .then(setAvailableModules)
      .catch(err => setCrmError(err instanceof Error ? err.message : 'Could not load module list'))
      .finally(() => setModulesLoading(false));
  };

  const handleSelectModule = (apiName: string) => {
    setPortfolioModuleOverride(apiName);
    setAvailableModules([]);
    setCrmError('');
    loadCRMData();
  };

  useEffect(() => { loadCRMData(); }, []);

  const handleDeleteCRM = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await deleteCRMPortfolioRecord(pendingDeleteId);
      setCrmCompanies(prev => prev.filter(c => c.id !== pendingDeleteId));
    } catch (err) {
      setCrmError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  // KPIs derived from real CRM data
  const totalDeployed = crmCompanies.reduce((s, c) => s + (parseFloat(c.investmentAmount) || 0), 0);
  const totalPreMoney = crmCompanies.reduce((s, c) => s + (parseFloat(c.preMoneyValuation) || 0), 0);
  const avgOwnership = crmCompanies.length
    ? crmCompanies.reduce((s, c) => s + (parseFloat(c.ownershipPct) || 0), 0) / crmCompanies.length
    : 0;
  const activeCount = crmCompanies.filter(c => c.status === 'active').length;
  const seedCount = crmCompanies.filter(c => c.stage === 'seed').length;
  const seriesACount = crmCompanies.filter(c => c.stage === 'series-a').length;

  const kpiChips: KpiChip[] = [
    {
      label: 'Portfolio Companies',
      value: String(crmCompanies.length),
      sub: `${activeCount} Active`,
      icon: <Building2 size={16} />,
      onClick: scrollToCompanies,
    },
    {
      label: 'Total Deployed',
      value: totalDeployed > 0 ? formatCurrency(totalDeployed) : '—',
      sub: 'capital invested',
      icon: <DollarSign size={16} />,
      accent: true,
    },
    {
      label: 'Avg Ownership',
      value: avgOwnership > 0 ? `${avgOwnership.toFixed(1)}%` : '—',
      sub: 'per company',
      icon: <Percent size={16} />,
    },
    {
      label: 'Avg Deal Size',
      value: crmCompanies.length > 0 && totalDeployed > 0
        ? formatCurrency(totalDeployed / crmCompanies.length)
        : '—',
      sub: 'per investment',
      icon: <DollarSign size={16} />,
    },
    {
      label: 'Entry Valuations',
      value: totalPreMoney > 0 ? formatCurrency(totalPreMoney) : '—',
      sub: 'combined pre-money',
      icon: <TrendingUp size={16} />,
      color: 'text-emerald-600',
    },
    {
      label: 'Stage Mix',
      value: `${seedCount}S / ${seriesACount}A`,
      sub: 'Seed / Series A',
      icon: <Layers size={16} />,
    },
    {
      label: 'Portfolio Value',
      value: totalDeployed > 0 ? formatCurrency(totalDeployed) : '—',
      sub: 'at cost basis',
      icon: <BarChart2 size={16} />,
      color: 'text-indigo-600',
    },
    {
      label: 'Active',
      value: String(activeCount),
      sub: 'active investments',
      icon: <Award size={16} />,
      color: 'text-amber-600',
    },
    {
      label: 'Est. IRR',
      value: '—',
      sub: 'add more data',
      icon: <Target size={16} />,
      color: 'text-emerald-600',
    },
    {
      label: 'MOIC',
      value: '—',
      sub: 'mark to market',
      icon: <PieChart size={16} />,
    },
    {
      label: 'Unrealized Gain',
      value: '—',
      sub: 'needs current val.',
      icon: <TrendingUp size={16} />,
      color: 'text-emerald-600',
    },
    {
      label: 'Total Companies',
      value: String(crmCompanies.length),
      sub: 'in portfolio',
      icon: <Building2 size={16} />,
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {pendingDeleteId !== null && (
        <DeleteConfirmModal
          title="Delete Portfolio Company"
          message="Are you sure you want to delete this company record? This action cannot be undone."
          onConfirm={handleDeleteCRM}
          onCancel={() => setPendingDeleteId(null)}
          deleting={deleting}
        />
      )}
      {/* Constrained header */}
      <div className="w-full">
        <PageHeader
          title="Portfolio"
          description="Your invested companies and portfolio performance"
          action={
            <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
              <Plus size={15} /> Add Company
            </Link>
          }
        />
      </div>

      {/* Full-width scrollable KPI row */}
      <KpiChipRow chips={kpiChips} />

      {/* Everything else constrained to max-w-5xl */}
      <div className="w-full">
        {/* Analytics charts — static growth chart only */}
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Performance Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <PortfolioGrowthChart />
          <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-2">
            <BarChart2 size={28} className="text-gray-200" />
            <p className="text-sm font-medium text-gray-500">MOIC chart</p>
            <p className="text-xs text-gray-400">Add portfolio companies with investment data to see MOIC analytics.</p>
          </div>
        </div>

        {/* Portfolio companies */}
        <div ref={companiesSectionRef} className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Portfolio Companies</h2>
          {isConnected && (
            <button
              onClick={loadCRMData}
              disabled={crmLoading}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              <RefreshCw size={12} className={crmLoading ? 'animate-spin' : ''} />
              {crmLoading ? 'Loading…' : 'Refresh'}
            </button>
          )}
        </div>

        {/* Not connected notice */}
        {!isConnected && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-4">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">Connect Zoho CRM to see live portfolio data</p>
              <p className="text-xs text-amber-600 mt-0.5">Go to Login page and click "Sign in with Zoho CRM".</p>
            </div>
            <Link to="/login" className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
              Connect
            </Link>
          </div>
        )}

        {/* CRM error + module picker */}
        {crmError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 mb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-red-700">{crmError}</p>
              </div>
              {availableModules.length === 0 && (
                <button
                  onClick={handleFetchModules}
                  disabled={modulesLoading}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {modulesLoading
                    ? <><Loader2 size={12} className="animate-spin" /> Loading…</>
                    : <><RefreshCw size={12} /> Show my modules</>}
                </button>
              )}
            </div>

            {availableModules.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-3">
                  Click the correct module below to connect it as your Portfolio module:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {availableModules.map(m => (
                    <button
                      key={m.api_name}
                      onClick={() => handleSelectModule(m.api_name)}
                      className="text-left bg-white border border-red-100 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl px-3 py-2.5 transition-all group"
                    >
                      <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-indigo-700">
                        {m.plural_label || m.module_name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">{m.api_name}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-red-400 mt-3">
                  This saves your selection. The app will retry immediately.
                </p>
              </div>
            )}
          </div>
        )}

        {/* CRM loading skeleton */}
        {crmLoading && crmCompanies.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-2.5 bg-gray-100 rounded w-full mb-2" />
                <div className="h-2.5 bg-gray-100 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {crmCompanies.map(c => (
            <CRMCompanyCard key={c.id} c={c} onDelete={setPendingDeleteId} />
          ))}
        </div>

        {isConnected && !crmLoading && crmCompanies.length === 0 && !crmError && (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center mt-4">
            <Building2 size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 mb-1">No records in Zoho CRM yet</p>
            <p className="text-xs text-gray-400 mb-4">Add your first portfolio company to sync it to your CRM.</p>
            <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
              <Plus size={14} /> Add Company
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPortfolioCompanies, type StoredPortfolioCompany } from '../services/store';
import { companiesService } from '../services/companiesService';
import { investmentsService } from '../services/investmentsService';
import { mockInvestments } from '../data/mockData';
import type { Company, Investment } from '../types';
import { StageBadge } from '../components/ui/Badge';
import { PageHeader } from '../components/layout/PageHeader';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

// ─── Chart constants ───────────────────────────────────────────────────────────

const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const GROWTH_VALUES = [7.0, 7.1, 7.35, 7.6, 7.85, 8.05, 8.25, 8.5, 8.7, 8.9, 9.1, 9.3];

const COMPANY_COLORS: Record<string, string> = {
  'c-1': '#6366f1',
  'c-2': '#10b981',
  'c-4': '#8b5cf6',
  'c-6': '#0ea5e9',
};

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

// ─── MOIC comparison (horizontal bars) ────────────────────────────────────────

function MoicComparisonChart({ investments }: { investments: Investment[] }) {
  const sorted = [...investments].sort((a, b) => (b.moic ?? 1) - (a.moic ?? 1));
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">MOIC by Company</h3>
        <p className="text-xs text-gray-400 mt-0.5">Multiple on invested capital</p>
      </div>
      <div className="space-y-4">
        {sorted.map((inv) => {
          const moic = inv.moic ?? 1;
          const pct = (moic / 2.0) * 100;
          const color = COMPANY_COLORS[inv.company.id] ?? '#6366f1';
          return (
            <div key={inv.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={inv.company.logo} alt={inv.company.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{inv.company.name}</span>
                </div>
                <span className="text-xs font-bold" style={{ color }}>{moic.toFixed(1)}x</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
        <div className="flex justify-between pt-0.5">
          {['0x', '0.5x', '1.0x', '1.5x', '2.0x'].map(v => (
            <span key={v} className="text-xs text-gray-300">{v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Capital by Stage (SVG donut) ─────────────────────────────────────────────

function StageAllocationChart({ investments }: { investments: Investment[] }) {
  const stages: Record<string, { count: number; amount: number; color: string }> = {};
  investments.forEach(inv => {
    if (!stages[inv.round]) {
      stages[inv.round] = { count: 0, amount: 0, color: inv.round === 'Seed' ? '#6366f1' : '#10b981' };
    }
    stages[inv.round].count++;
    stages[inv.round].amount += inv.amount;
  });

  const data = Object.entries(stages).map(([label, v]) => ({ label, ...v }));
  const totalAmt = data.reduce((s, d) => s + d.amount, 0);

  const R = 36, CX = 50, CY = 50;
  const C = 2 * Math.PI * R;
  let accumulated = 0;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Capital by Stage</h3>
        <p className="text-xs text-gray-400 mt-0.5">Deployment breakdown</p>
      </div>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 100 100" className="w-[104px] h-[104px] flex-shrink-0 -rotate-90">
          {data.map((d, i) => {
            const pct = d.amount / totalAmt;
            const arc = pct * C;
            const offset = accumulated * C;
            accumulated += pct;
            return (
              <circle
                key={i}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={d.color}
                strokeWidth="22"
                strokeDasharray={`${arc} ${C}`}
                strokeDashoffset={-offset}
              />
            );
          })}
          <circle cx={CX} cy={CY} r="22" fill="white" />
        </svg>
        <div className="flex-1 space-y-3">
          {data.map((d) => (
            <div key={d.label}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs font-medium text-gray-700">{d.label}</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">
                  {((d.amount / totalAmt) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-gray-400 pl-4">{d.count} co · {formatCurrency(d.amount)}</p>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400">Total deployed</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(totalAmt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invested vs Current Value (paired bars) ───────────────────────────────────

function InvestedVsCurrentChart({ investments }: { investments: Investment[] }) {
  const maxVal = 4500000;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Invested vs Current Value</h3>
        <p className="text-xs text-gray-400 mt-0.5">Capital deployed per company</p>
      </div>
      <div className="space-y-4">
        {investments.map((inv) => {
          const invested = inv.amount;
          const current = inv.amount * (inv.moic ?? 1);
          const investedPct = Math.min((invested / maxVal) * 100, 100);
          const currentPct = Math.min((current / maxVal) * 100, 100);
          const color = COMPANY_COLORS[inv.company.id] ?? '#6366f1';
          const gain = current - invested;

          return (
            <div key={inv.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-700">{inv.company.name}</span>
                <span className={`text-xs font-semibold ${gain > 0 ? 'text-emerald-600' : gain < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {gain > 0 ? '+' : ''}{formatCurrency(gain)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-10 flex-shrink-0">In</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gray-300" style={{ width: `${investedPct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right flex-shrink-0">{formatCurrency(invested)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-10 flex-shrink-0">Now</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${currentPct}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-xs font-semibold w-12 text-right flex-shrink-0" style={{ color }}>
                    {formatCurrency(current)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-5 mt-4 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 bg-gray-300 rounded-full" />
          <span className="text-xs text-gray-400">Invested</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-xs text-gray-400">Current value</span>
        </div>
      </div>
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
}

function KpiChipRow({ chips }: { chips: KpiChip[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className={`flex-shrink-0 w-44 rounded-2xl p-5 ${
            chip.accent ? 'bg-black' : 'bg-white border border-gray-100 hover:border-gray-200'
          }`}
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
        </div>
      ))}
    </div>
  );
}

// ─── Portfolio Company Card ────────────────────────────────────────────────────

function PortfolioCompanyCard({ company, investment }: { company: Company; investment?: Investment }) {
  const moic = investment?.moic ?? 1;
  const gain = investment ? investment.amount * (moic - 1) : 0;

  return (
    <Link to={`/companies/${company.id}`}>
      <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all group">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
            <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {company.name}
            </h3>
            <p className="text-xs text-gray-500">{company.industry} · {company.location}</p>
          </div>
          <StageBadge stage={company.stage} />
        </div>

        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-3">
          {company.shortDescription}
        </p>

        {/* Tags */}
        {company.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {company.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Investment data */}
        {investment && (
          <div className="pt-3 border-t border-gray-50">
            <div className="grid grid-cols-4 gap-2 mb-2.5">
              <div>
                <p className="text-xs text-gray-400">Invested</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(investment.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Round</p>
                <p className="text-sm font-semibold text-gray-900">{investment.round}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Ownership</p>
                <p className="text-sm font-semibold text-gray-900">{investment.ownership}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">MOIC</p>
                <p className={`text-sm font-bold ${moic >= 1.5 ? 'text-emerald-600' : moic >= 1.2 ? 'text-indigo-600' : 'text-gray-600'}`}>
                  {moic.toFixed(1)}x
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Unrealized {gain >= 0 ? 'gain' : 'loss'}</span>
              <span className={`text-xs font-semibold ${gain > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {gain > 0 ? '+' : ''}{formatCurrency(gain)}
              </span>
            </div>
          </div>
        )}

        {/* Latest milestone */}
        {company.publicMilestones.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400 mb-1">Latest milestone</p>
            <p className="text-xs font-medium text-gray-700">{company.publicMilestones[0].title}</p>
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Stored Company Card ──────────────────────────────────────────────────────

function StoredCompanyCard({ c }: { c: StoredPortfolioCompany }) {
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
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          {c.logo
            ? <img src={c.logo} alt={c.companyName} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Building2 size={18} className="text-gray-400" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{c.companyName}</p>
          <p className="text-xs text-gray-400 capitalize">{c.industry} · {c.stage}</p>
        </div>
        {c.status && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
          </span>
        )}
      </div>
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
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [storedCompanies, setStoredCompanies] = useState<StoredPortfolioCompany[]>([]);

  useEffect(() => {
    companiesService.getAll().then(setCompanies);
    investmentsService.getAll().then(setInvestments);
    setStoredCompanies(getPortfolioCompanies());
  }, []);

  const getInvestment = (companyId: string) => investments.find((i) => i.company.id === companyId);
  const investedIds = new Set(mockInvestments.map(i => i.company.id));
  const investedCompanies = companies.filter(c => investedIds.has(c.id));

  // Pre-computed from mockInvestments (synchronous, no loading flash)
  const totalDeployed = mockInvestments.reduce((s, i) => s + i.amount, 0);
  const totalCurrentValue = mockInvestments.reduce((s, i) => s + i.amount * (i.moic ?? 1), 0);
  const unrealizedGain = totalCurrentValue - totalDeployed;
  const avgMoic = mockInvestments.reduce((s, i) => s + (i.moic ?? 1), 0) / mockInvestments.length;
  const bestInv = [...mockInvestments].sort((a, b) => (b.moic ?? 1) - (a.moic ?? 1))[0];
  const avgOwnership = mockInvestments.reduce((s, i) => s + i.ownership, 0) / mockInvestments.length;
  const seedCount = mockInvestments.filter(i => i.round === 'Seed').length;
  const seriesACount = mockInvestments.filter(i => i.round === 'Series A').length;
  const totalEntryVal = mockInvestments.reduce((s, i) => s + i.valuation, 0);
  const returnPct = parseFloat(((unrealizedGain / totalDeployed) * 100).toFixed(1));

  const kpiChips: KpiChip[] = [
    {
      label: 'Portfolio Companies',
      value: String(mockInvestments.length),
      sub: 'active investments',
      icon: <Building2 size={16} />,
    },
    {
      label: 'Total Deployed',
      value: formatCurrency(totalDeployed),
      sub: 'capital invested',
      icon: <DollarSign size={16} />,
    },
    {
      label: 'Current Value',
      value: formatCurrency(totalCurrentValue),
      sub: `+${returnPct}% total return`,
      icon: <TrendingUp size={16} />,
      accent: true,
    },
    {
      label: 'Avg MOIC',
      value: `${avgMoic.toFixed(2)}x`,
      sub: 'avg multiple',
      icon: <PieChart size={16} />,
    },
    {
      label: 'Unrealized Gain',
      value: `+${formatCurrency(unrealizedGain)}`,
      sub: 'since first investment',
      icon: <TrendingUp size={16} />,
      color: 'text-emerald-600',
    },
    {
      label: 'Portfolio Return',
      value: `+${returnPct}%`,
      sub: 'on invested capital',
      icon: <BarChart2 size={16} />,
      color: 'text-indigo-600',
    },
    {
      label: 'Best MOIC',
      value: `${(bestInv.moic ?? 1).toFixed(1)}x`,
      sub: bestInv.company.name,
      icon: <Award size={16} />,
      color: 'text-amber-600',
    },
    {
      label: 'Avg Ownership',
      value: `${avgOwnership.toFixed(1)}%`,
      sub: 'per company',
      icon: <Percent size={16} />,
    },
    {
      label: 'Est. IRR',
      value: '22%',
      sub: 'per annum',
      icon: <Target size={16} />,
      color: 'text-emerald-600',
    },
    {
      label: 'Avg Deal Size',
      value: formatCurrency(totalDeployed / mockInvestments.length),
      sub: 'per investment',
      icon: <DollarSign size={16} />,
    },
    {
      label: 'Stage Mix',
      value: `${seedCount}S / ${seriesACount}A`,
      sub: 'Seed / Series A',
      icon: <Layers size={16} />,
    },
    {
      label: 'Entry Valuations',
      value: formatCurrency(totalEntryVal),
      sub: 'portfolio at entry',
      icon: <Building2 size={16} />,
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Constrained header */}
      <div className="max-w-5xl">
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
      <div className="max-w-5xl">
        {/* Analytics charts — 2-col grid */}
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Performance Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <PortfolioGrowthChart />
          <MoicComparisonChart investments={mockInvestments} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <StageAllocationChart investments={mockInvestments} />
          <InvestedVsCurrentChart investments={mockInvestments} />
        </div>

        {/* Portfolio companies */}
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Portfolio Companies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {storedCompanies.map((c) => (
            <StoredCompanyCard key={c.id} c={c} />
          ))}
          {investedCompanies.map((company) => (
            <PortfolioCompanyCard
              key={company.id}
              company={company}
              investment={getInvestment(company.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

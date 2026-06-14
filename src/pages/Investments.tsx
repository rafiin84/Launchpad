import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { investmentsService } from '../services/investmentsService';
import type { Investment } from '../types';
import { StageBadge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

function InvestmentRow({ investment }: { investment: Investment }) {
  const currentValue = (investment.currentValuation || investment.valuation) * (investment.ownership / 100);
  const isUp = currentValue > investment.amount;

  return (
    <Link to={`/companies/${investment.company.id}`}>
      <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-all group">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
            <img src={investment.company.logo} alt={investment.company.name} className="w-full h-full object-cover" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {investment.company.name}
              </p>
              <span className="text-xs text-gray-500">{investment.round}</span>
            </div>
            <p className="text-xs text-gray-500">{investment.company.industry}</p>
          </div>

          {/* Investment details */}
          <div className="grid grid-cols-4 gap-8 text-right hidden md:grid">
            <div>
              <p className="text-xs text-gray-400">Invested</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(investment.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Ownership</p>
              <p className="text-sm font-semibold text-gray-900">{investment.ownership}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Current Value</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(currentValue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">MOIC</p>
              <div className="flex items-center justify-end gap-1">
                {isUp ? (
                  <TrendingUp size={13} className="text-emerald-500" />
                ) : (
                  <TrendingDown size={13} className="text-red-500" />
                )}
                <p className={cn('text-sm font-bold', isUp ? 'text-emerald-600' : 'text-red-600')}>
                  {investment.moic?.toFixed(2)}x
                </p>
              </div>
            </div>
          </div>

          {/* Mobile summary */}
          <div className="md:hidden text-right">
            <p className="text-sm font-semibold text-gray-900">{formatCurrency(investment.amount)}</p>
            <p className={cn('text-xs font-medium', isUp ? 'text-emerald-600' : 'text-red-600')}>
              {investment.moic?.toFixed(2)}x
            </p>
          </div>
        </div>

        {investment.notes && (
          <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-50 italic line-clamp-1">
            {investment.notes}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function Investments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [summary, setSummary] = useState({ totalCompanies: 0, totalDeployed: 0, totalCurrentValue: 0, avgMoic: 0 });

  useEffect(() => {
    investmentsService.getAll().then(setInvestments);
    investmentsService.getPortfolioSummary().then(setSummary);
  }, []);

  const totalUnrealized = summary.totalCurrentValue - summary.totalDeployed;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Investments"
        description="Track your investment positions and portfolio performance"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Invested" value={formatCurrency(summary.totalDeployed)} />
        <StatCard
          label="Current Value"
          value={formatCurrency(summary.totalCurrentValue)}
          change={12}
          changeLabel="est."
          accent
        />
        <StatCard
          label="Unrealized Gain"
          value={formatCurrency(Math.max(0, totalUnrealized))}
          change={totalUnrealized > 0 ? 15 : -5}
        />
        <StatCard label="Avg MOIC" value={`${summary.avgMoic}x`} />
      </div>

      {/* Investment table header */}
      <div className="hidden md:grid grid-cols-[1fr_auto] gap-4 px-5 py-2 mb-2">
        <span className="text-xs font-medium text-gray-500">Company</span>
        <div className="grid grid-cols-4 gap-8 text-right">
          {['Invested', 'Ownership', 'Current Value', 'MOIC'].map((h) => (
            <span key={h} className="text-xs font-medium text-gray-500">{h}</span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {investments.map((inv) => (
          <InvestmentRow key={inv.id} investment={inv} />
        ))}
      </div>
    </div>
  );
}

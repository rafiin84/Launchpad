import { useState, useEffect } from 'react';
import { fundsService, investmentsService } from '../services/investmentsService';
import type { Fund } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/layout/PageHeader';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(0)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

function FundCard({ fund }: { fund: Fund & { deploymentPct: number; remaining: number } }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">{fund.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">Vintage {fund.vintage}</p>
        </div>
        <div className="bg-black text-white px-3 py-1.5 rounded-xl text-xs font-semibold">
          Fund {fund.vintage}
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-5 leading-relaxed">{fund.description}</p>

      {/* Capital deployment bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Capital Deployed</span>
          <span className="text-xs font-semibold text-gray-900">{fund.deploymentPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-black rounded-full transition-all"
            style={{ width: `${fund.deploymentPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-500">{formatCurrency(fund.deployedCapital)} deployed</span>
          <span className="text-xs text-gray-500">{formatCurrency(fund.remaining)} remaining</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-50">
        <div>
          <p className="text-xs text-gray-400">Fund Size</p>
          <p className="text-sm font-bold text-gray-900">{formatCurrency(fund.totalCapital)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Companies</p>
          <p className="text-sm font-bold text-gray-900">{fund.investments.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Target</p>
          <p className="text-sm font-bold text-gray-900">{fund.targetReturn || '—'}</p>
        </div>
      </div>

      {/* Focus areas */}
      {fund.focus && fund.focus.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-50">
          <p className="text-xs text-gray-400 mb-2">Focus Areas</p>
          <div className="flex flex-wrap gap-1.5">
            {fund.focus.map((f) => (
              <span key={f} className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio companies */}
      {fund.investments.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-50">
          <p className="text-xs text-gray-400 mb-2">Portfolio</p>
          <div className="flex -space-x-2">
            {fund.investments.slice(0, 6).map((inv) => (
              <div key={inv.id} className="w-8 h-8 rounded-full overflow-hidden border-2 border-white flex-shrink-0">
                <img src={inv.company.logo} alt={inv.company.name} className="w-full h-full object-cover" />
              </div>
            ))}
            {fund.investments.length > 6 && (
              <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                <span className="text-xs text-gray-600 font-medium">+{fund.investments.length - 6}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Funds() {
  const [funds, setFunds] = useState<(Fund & { deploymentPct: number; remaining: number })[]>([]);
  const [summary, setSummary] = useState({ totalCompanies: 0, totalDeployed: 0, totalCurrentValue: 0, avgMoic: 0 });

  useEffect(() => {
    fundsService.getSummary().then(setFunds as never);
    investmentsService.getPortfolioSummary().then(setSummary);
  }, []);

  const totalAUM = funds.reduce((sum, f) => sum + f.totalCapital, 0);
  const totalDeployed = funds.reduce((sum, f) => sum + f.deployedCapital, 0);
  const totalRemaining = funds.reduce((sum, f) => sum + f.remaining, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Funds"
        description="Manage your fund vehicles and capital deployment"
      />

      {/* AUM overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total AUM" value={formatCurrency(totalAUM)} accent />
        <StatCard label="Total Deployed" value={formatCurrency(totalDeployed)} />
        <StatCard label="Dry Powder" value={formatCurrency(totalRemaining)} />
        <StatCard label="Portfolio Companies" value={summary.totalCompanies} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {funds.map((fund) => (
          <FundCard key={fund.id} fund={fund} />
        ))}
      </div>
    </div>
  );
}

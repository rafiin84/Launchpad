import React, { useState, useEffect } from 'react';
import { PieChart, TrendingUp, DollarSign, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { companiesService } from '../services/companiesService';
import { investmentsService } from '../services/investmentsService';
import type { Company, Investment } from '../types';
import { StageBadge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/layout/PageHeader';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

function PortfolioCompanyCard({ company, investment }: { company: Company; investment?: Investment }) {
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
            <p className="text-xs text-gray-500">{company.industry}</p>
          </div>
          <StageBadge stage={company.stage} />
        </div>

        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-3">
          {company.shortDescription}
        </p>

        {/* Investment data (private) */}
        {investment && (
          <div className="pt-3 border-t border-gray-50 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-400">Invested</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(investment.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Ownership</p>
              <p className="text-sm font-semibold text-gray-900">{investment.ownership}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">MOIC</p>
              <p className="text-sm font-semibold text-emerald-600">{investment.moic}x</p>
            </div>
          </div>
        )}

        {/* Public milestones */}
        {company.publicMilestones.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400 mb-1.5">Latest milestone</p>
            <p className="text-xs font-medium text-gray-700">{company.publicMilestones[0].title}</p>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Portfolio() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [summary, setSummary] = useState({ totalCompanies: 0, totalDeployed: 0, totalCurrentValue: 0, avgMoic: 0 });

  useEffect(() => {
    companiesService.getAll().then(setCompanies);
    investmentsService.getAll().then(setInvestments);
    investmentsService.getPortfolioSummary().then(setSummary);
  }, []);

  const getInvestment = (companyId: string) => investments.find((i) => i.company.id === companyId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Portfolio"
        description="Your invested companies and portfolio performance"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Portfolio Companies"
          value={summary.totalCompanies}
          icon={<Building2 size={18} className="text-gray-400" />}
        />
        <StatCard
          label="Total Deployed"
          value={formatCurrency(summary.totalDeployed)}
          icon={<DollarSign size={18} className="text-gray-400" />}
        />
        <StatCard
          label="Current Value"
          value={formatCurrency(summary.totalCurrentValue)}
          change={12}
          changeLabel="est."
          accent
        />
        <StatCard
          label="Avg MOIC"
          value={`${summary.avgMoic}x`}
          icon={<TrendingUp size={18} className="text-gray-400" />}
        />
      </div>

      {/* Companies grid */}
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Portfolio Companies</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((company) => (
          <PortfolioCompanyCard
            key={company.id}
            company={company}
            investment={getInvestment(company.id)}
          />
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { TrendingUp, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dealsService } from '../services/dealsService';
import type { Deal, DealStage } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { StageBadge } from '../components/ui/Badge';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';
import { TimeAgo } from '../components/ui/TimeAgo';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

const priorityConfig = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-600',
  low: 'bg-gray-50 text-gray-500',
};

function DealCard({ deal }: { deal: Deal }) {
  return (
    <Link to={`/deals/${deal.id}`}>
      <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all group">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
            <img src={deal.company.logo} alt={deal.company.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {deal.company.name}
              </h3>
              <StageBadge stage={deal.stage} />
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', priorityConfig[deal.priority])}>
                {deal.priority}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-2">{deal.industry}</p>

            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-800">{formatCurrency(deal.fundingRequested)}</span>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Avatar src={deal.founder.avatar} name={deal.founder.name} size="xs" />
                {deal.founder.name}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-gray-400">Updated</p>
            <TimeAgo date={deal.updatedAt} className="text-xs text-gray-600 font-medium" />
          </div>
        </div>

        {deal.notes && (
          <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-50 line-clamp-2 italic">
            "{deal.notes}"
          </p>
        )}
      </div>
    </Link>
  );
}

const PIPELINE_STAGES: DealStage[] = [
  'new',
  'reviewing',
  'meeting-scheduled',
  'due-diligence',
  'investment-committee',
  'approved',
  'invested',
];

export default function DealFlow() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dealsService.getAll().then((data) => {
      setDeals(data);
      setLoading(false);
    });
  }, []);

  const activeDeals = deals.filter((d) => d.stage !== 'rejected');
  const totalRequested = deals.reduce((sum, d) => sum + d.fundingRequested, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Deal Flow"
        description="Active deals in your investment pipeline"
      />

      {/* Pipeline overview */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const count = deals.filter((d) => d.stage === stage).length;
            return (
              <React.Fragment key={stage}>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold',
                      count > 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                    )}
                  >
                    {count}
                  </div>
                  <span className="text-xs text-gray-500 capitalize whitespace-nowrap">
                    {stage.replace(/-/g, ' ').replace('investment committee', 'IC')}
                  </span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex gap-6 pt-3 border-t border-gray-50">
          <div>
            <p className="text-xs text-gray-500">Active Deals</p>
            <p className="text-lg font-bold text-gray-900">{activeDeals.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Requested</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRequested)}</p>
          </div>
        </div>
      </div>

      {/* Deals list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
          {deals.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
              <TrendingUp size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No deals yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

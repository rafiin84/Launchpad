import React, { useState, useEffect } from 'react';
import { TrendingUp, ArrowRight, Plus, AlertCircle, RefreshCw, DollarSign, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchCRMDeals, deleteCRMDeal, CRM_DEAL_STAGES, type CRMDeal } from '../services/crmDeals';
import { loadToken } from '../services/oauth';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Qualification':       { bg: 'bg-gray-100',    text: 'text-gray-700',    dot: '#6b7280' },
  'Value Proposition':   { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: '#3b82f6' },
  'Id. Decision Makers': { bg: 'bg-indigo-50',   text: 'text-indigo-700',  dot: '#6366f1' },
  'Perception Analysis': { bg: 'bg-violet-50',   text: 'text-violet-700',  dot: '#7c3aed' },
  'Proposal/Price Quote':{ bg: 'bg-amber-50',    text: 'text-amber-700',   dot: '#f59e0b' },
  'Negotiation/Review':  { bg: 'bg-orange-50',   text: 'text-orange-700',  dot: '#f97316' },
  'Closed Won':          { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: '#10b981' },
  'Closed Lost':         { bg: 'bg-red-50',      text: 'text-red-600',     dot: '#ef4444' },
};

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_COLORS[stage];
  if (!cfg) return <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{stage || '—'}</span>;
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
      {stage}
    </span>
  );
}

function DealCard({ deal, onDelete }: { deal: CRMDeal; onDelete: (id: string) => void }) {
  const amount = parseFloat(deal.amount) || 0;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
          <TrendingUp size={16} className="text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-gray-900">{deal.dealName || '—'}</h3>
            <StageBadge stage={deal.stage} />
          </div>
          {deal.accountName && (
            <p className="text-xs text-gray-500 mb-1">{deal.accountName}</p>
          )}
          <div className="flex items-center gap-4 mt-1">
            {amount > 0 && (
              <span className="text-sm font-semibold text-gray-800">{formatCurrency(amount)}</span>
            )}
            {deal.closingDate && (
              <span className="text-xs text-gray-400">Closing: {deal.closingDate}</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          <button
            onClick={() => onDelete(deal.id)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {deal.description && (
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-50 line-clamp-2 italic">
          "{deal.description}"
        </p>
      )}

      {deal.nextStep && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Next:</span>
          <span className="text-xs text-gray-700">{deal.nextStep}</span>
        </div>
      )}
    </div>
  );
}

export default function DealFlow() {
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isConnected = !!loadToken();

  const load = () => {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true);
    setError('');
    fetchCRMDeals()
      .then(setDeals)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteCRMDeal(id);
      setDeals(prev => prev.filter(d => d.id !== id));
    } catch {
      // swallow
    }
  };

  const activeDeals = deals.filter(d => d.stage !== 'Closed Lost');
  const totalAmount = deals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

  return (
    <div className="max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Deal Flow"
        description="Active deals in your investment pipeline"
        action={
          <Link to="/deals/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
            <Plus size={15} /> Add Deal
          </Link>
        }
      />

      {/* Not-connected banner */}
      {!isConnected && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Connect Zoho CRM to see live data</p>
            <p className="text-xs text-amber-600 mt-0.5">Go to Login and sign in with Zoho CRM.</p>
          </div>
          <Link to="/login" className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">Connect</Link>
        </div>
      )}

      {/* Pipeline overview */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-1">
          {CRM_DEAL_STAGES.map((stage, i) => {
            const count = deals.filter(d => d.stage === stage).length;
            const cfg = STAGE_COLORS[stage];
            return (
              <React.Fragment key={stage}>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold',
                      count > 0 ? 'text-white' : 'bg-gray-100 text-gray-400'
                    )}
                    style={count > 0 && cfg ? { backgroundColor: cfg.dot } : undefined}
                  >
                    {count}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap max-w-[70px] text-center leading-tight">
                    {stage}
                  </span>
                </div>
                {i < CRM_DEAL_STAGES.length - 1 && (
                  <ArrowRight size={12} className="text-gray-300 flex-shrink-0 mt-[-12px]" />
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
            <p className="text-xs text-gray-500">Total Amount</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Deals</p>
            <p className="text-lg font-bold text-gray-900">{deals.length}</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && deals.length === 0 && isConnected && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
          <TrendingUp size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No deals yet</p>
          <p className="text-xs text-gray-400 mb-4">Add your first deal to get started.</p>
          <Link to="/deals/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Plus size={14} /> Add Deal
          </Link>
        </div>
      )}

      {/* Deals list */}
      {!loading && !error && deals.length > 0 && (
        <div className="space-y-3">
          {deals.map(deal => <DealCard key={deal.id} deal={deal} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  );
}

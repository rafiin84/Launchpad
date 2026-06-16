import React, { useState, useEffect } from 'react';
import { DollarSign, Percent, AlertCircle, RefreshCw, Plus, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchCRMPortfolio, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { loadToken } from '../services/oauth';
import { PageHeader } from '../components/layout/PageHeader';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

const STATUS_STYLES: Record<string, string> = {
  'Active':     'bg-emerald-50 text-emerald-700',
  'Exited':     'bg-blue-50 text-blue-700',
  'Written Off':'bg-red-50 text-red-600',
  'Watch':      'bg-amber-50 text-amber-700',
};

function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>{status}</span>
  );
}

function InvestmentRow({ record }: { record: CRMPortfolioRecord }) {
  const amount = parseFloat(record.investmentAmount) || 0;
  const ownership = parseFloat(record.ownershipPct) || 0;
  const valuation = parseFloat(record.preMoneyValuation) || 0;

  return (
    <Link to={`/portfolio/${record.id}`}>
      <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-all group">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
            <Building2 size={16} className="text-gray-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {record.companyName || '—'}
              </p>
              {record.stage && <span className="text-xs text-gray-500">{record.stage}</span>}
            </div>
            <p className="text-xs text-gray-500">{record.industry || '—'}</p>
          </div>

          {/* Investment details */}
          <div className="grid grid-cols-4 gap-8 text-right hidden md:grid">
            <div>
              <p className="text-xs text-gray-400">Invested</p>
              <p className="text-sm font-semibold text-gray-900">{amount > 0 ? formatCurrency(amount) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Ownership</p>
              <p className="text-sm font-semibold text-gray-900">{ownership > 0 ? `${ownership}%` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Pre-Money Val.</p>
              <p className="text-sm font-semibold text-gray-900">{valuation > 0 ? formatCurrency(valuation) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Status</p>
              <StatusBadge status={record.status} />
            </div>
          </div>

          {/* Mobile summary */}
          <div className="md:hidden text-right">
            <p className="text-sm font-semibold text-gray-900">{amount > 0 ? formatCurrency(amount) : '—'}</p>
            {ownership > 0 && <p className="text-xs text-gray-500">{ownership}%</p>}
          </div>
        </div>

        {record.notes && (
          <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-50 italic line-clamp-1">
            {record.notes}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function Investments() {
  const [records, setRecords] = useState<CRMPortfolioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isConnected = !!loadToken();

  const load = () => {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true);
    setError('');
    fetchCRMPortfolio()
      .then(setRecords)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalInvested = records.reduce((s, r) => s + (parseFloat(r.investmentAmount) || 0), 0);
  const avgOwnership = records.length > 0
    ? (records.reduce((s, r) => s + (parseFloat(r.ownershipPct) || 0), 0) / records.length).toFixed(1)
    : '0';

  const summaryCards = [
    { label: 'Total Invested', value: formatCurrency(totalInvested), icon: DollarSign, accent: true },
    { label: 'Portfolio Companies', value: records.length, icon: Building2, accent: false },
    { label: 'Avg Ownership', value: `${avgOwnership}%`, icon: Percent, accent: false },
  ];

  return (
    <div className="max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Investments"
        description="Track your investment positions and portfolio performance"
        action={
          <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
            <Plus size={15} /> Add Investment
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-2xl p-5 ${card.accent ? 'bg-black' : 'bg-white border border-gray-100'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${card.accent ? 'bg-white/15' : 'bg-gray-50'}`}>
                <Icon size={16} className={card.accent ? 'text-white' : 'text-gray-500'} />
              </div>
              <p className={`text-2xl font-bold mb-0.5 ${card.accent ? 'text-white' : 'text-gray-900'}`}>{card.value}</p>
              <p className={`text-xs font-semibold ${card.accent ? 'text-gray-300' : 'text-gray-600'}`}>{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Table header */}
      <div className="hidden md:grid grid-cols-[1fr_auto] gap-4 px-5 py-2 mb-2">
        <span className="text-xs font-medium text-gray-500">Company</span>
        <div className="grid grid-cols-4 gap-8 text-right">
          {['Invested', 'Ownership', 'Pre-Money Val.', 'Status'].map(h => (
            <span key={h} className="text-xs font-medium text-gray-500">{h}</span>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
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

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {!loading && !error && records.length === 0 && isConnected && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
          <DollarSign size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No investments yet</p>
          <p className="text-xs text-gray-400 mb-4">Add a portfolio company with investment details to get started.</p>
          <Link to="/portfolio/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Plus size={14} /> Add Investment
          </Link>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div className="space-y-3">
          {records.map(r => <InvestmentRow key={r.id} record={r} />)}
        </div>
      )}
    </div>
  );
}

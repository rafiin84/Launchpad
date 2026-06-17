import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, Building2, DollarSign, Calendar,
  BarChart2, Zap, FileText, Globe, Edit2, Trash2, CheckCircle,
} from 'lucide-react';
import { getCRMDeal, deleteCRMDeal, CRM_DEAL_STAGES, type CRMDeal } from '../services/crmDeals';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { cn } from '../lib/cn';

function formatCurrency(val: string) {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const STAGE_COLORS: Record<string, string> = {
  'Qualification':        '#6b7280',
  'Value Proposition':    '#3b82f6',
  'Id. Decision Makers':  '#6366f1',
  'Perception Analysis':  '#7c3aed',
  'Proposal/Price Quote': '#f59e0b',
  'Negotiation/Review':   '#f97316',
  'Closed Won':           '#10b981',
  'Closed Lost':          '#ef4444',
};

const ACTIVE_STAGES = CRM_DEAL_STAGES.filter(s => s !== 'Closed Lost');

function StageTimeline({ current }: { current: string }) {
  const isLost = current === 'Closed Lost';
  const currentIdx = ACTIVE_STAGES.indexOf(current as typeof ACTIVE_STAGES[number]);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Deal Progress</h3>
      <div className="flex items-center">
        {ACTIVE_STAGES.map((stage, i) => {
          const isPast   = currentIdx > i;
          const isActive = currentIdx === i;
          const color    = STAGE_COLORS[stage] ?? '#6b7280';
          return (
            <div key={stage} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 flex-shrink-0"
                  style={{
                    backgroundColor: isPast || isActive ? color : '#f3f4f6',
                    color: isPast || isActive ? 'white' : '#9ca3af',
                    boxShadow: isActive ? `0 0 0 3px ${color}33` : undefined,
                  }}
                >
                  {isPast ? <CheckCircle size={13} /> : i + 1}
                </div>
                <span className="text-center text-[9px] leading-tight text-gray-400 max-w-[54px] hidden sm:block truncate">
                  {stage}
                </span>
              </div>
              {i < ACTIVE_STAGES.length - 1 && (
                <div className="h-0.5 flex-none w-3 mb-5 rounded-full"
                  style={{ backgroundColor: isPast ? color : '#e5e7eb' }} />
              )}
            </div>
          );
        })}
      </div>
      {isLost && (
        <div className="mt-3 px-3 py-2 bg-red-50 rounded-xl text-xs font-medium text-red-600 text-center">
          This deal was marked as Closed Lost
        </div>
      )}
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-300 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deal, setDeal]         = useState<CRMDeal | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCRMDeal(id)
      .then(d => { setDeal(d); setLoading(false); })
      .catch(err => { setError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false); });
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteCRMDeal(id);
      navigate('/deals');
    } catch (err) {
      setDeleting(false);
      setShowDelete(false);
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl animate-pulse space-y-4">
      <div className="h-4 bg-gray-100 rounded w-24" />
      <div className="h-36 bg-gray-100 rounded-2xl" />
      <div className="h-16 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-40 bg-gray-100 rounded-2xl" />
        <div className="h-40 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );

  if (error || !deal) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl">
      <Link to="/deals" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 mb-6">
        <ArrowLeft size={15} /> Deal Flow
      </Link>
      <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
        <TrendingUp size={28} className="text-red-300 mx-auto mb-3" />
        <p className="text-sm text-red-600">{error || 'Deal not found'}</p>
      </div>
    </div>
  );

  const stageColor = STAGE_COLORS[deal.stage] ?? '#6b7280';
  const amount = formatCurrency(deal.amount);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">
      {showDelete && (
        <DeleteConfirmModal
          title="Delete Deal"
          message={`Are you sure you want to delete "${deal.dealName}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          deleting={deleting}
        />
      )}

      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/deals" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft size={15} /> Deal Flow
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/deals/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Edit2 size={14} /> Edit
          </Link>
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{deal.dealName}</h1>
                {deal.accountName && (
                  <p className="text-sm text-gray-500 mt-0.5">{deal.accountName}</p>
                )}
              </div>
              <span
                className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ color: stageColor, backgroundColor: `${stageColor}18` }}
              >
                {deal.stage || 'No Stage'}
              </span>
            </div>
            {deal.description && (
              <p className="text-sm text-gray-600 leading-relaxed mt-3">{deal.description}</p>
            )}
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-50">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Amount</p>
            <p className="text-lg font-bold text-gray-900">{amount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Probability</p>
            <p className="text-lg font-bold text-gray-900">{deal.probability ? `${deal.probability}%` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Closing Date</p>
            <p className="text-lg font-bold text-gray-900">
              {deal.closingDate
                ? new Date(deal.closingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Lead Source</p>
            <p className="text-lg font-bold text-gray-900">{deal.leadSource || '—'}</p>
          </div>
        </div>
      </div>

      {/* Stage timeline */}
      <StageTimeline current={deal.stage} />

      {/* Detail grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Deal info */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-indigo-500" /> Deal Information
          </h3>
          <div className="space-y-3">
            <Field icon={<Building2 size={14} />}  label="Account / Company" value={deal.accountName} />
            <Field icon={<DollarSign size={14} />} label="Deal Amount"        value={amount !== '—' ? amount : undefined} />
            <Field icon={<BarChart2 size={14} />}  label="Probability"        value={deal.probability ? `${deal.probability}%` : undefined} />
            <Field icon={<Calendar size={14} />}   label="Closing Date"       value={deal.closingDate
              ? new Date(deal.closingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : undefined} />
            <Field icon={<Globe size={14} />}      label="Lead Source"        value={deal.leadSource} />
          </div>
        </div>

        {/* Next steps & notes */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap size={14} className="text-amber-500" /> Next Steps & Notes
          </h3>
          <div className="space-y-4">
            {deal.nextStep && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Next Step</p>
                <div className={cn('flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2.5')}>
                  <Zap size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 font-medium leading-snug">{deal.nextStep}</p>
                </div>
              </div>
            )}
            {deal.description && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">{deal.description}</p>
              </div>
            )}
            {!deal.nextStep && !deal.description && (
              <p className="text-xs text-gray-400 italic">No notes added yet.</p>
            )}
          </div>
        </div>

        {/* Stage summary */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText size={14} className="text-violet-500" /> Stage Summary
          </h3>
          <div className="flex flex-wrap gap-2">
            {CRM_DEAL_STAGES.map(stage => {
              const color = STAGE_COLORS[stage] ?? '#6b7280';
              const isCurrentStage = deal.stage === stage;
              return (
                <span
                  key={stage}
                  className={cn('text-xs font-medium px-3 py-1.5 rounded-full transition-all', isCurrentStage ? 'ring-2' : 'opacity-40')}
                  style={{
                    color,
                    backgroundColor: `${color}18`,
                    ...(isCurrentStage ? { '--tw-ring-color': color } as React.CSSProperties : {}),
                  }}
                >
                  {stage}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

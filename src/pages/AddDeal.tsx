import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, DollarSign, Calendar, Building2,
  FileText, BarChart2, Zap, ChevronDown, Loader2,
} from 'lucide-react';
import { createCRMDeal, CRM_DEAL_STAGES, type CRMDealFields } from '../services/crmDeals';

const LEAD_SOURCES = [
  'None',
  'Cold Call',
  'Existing Customer',
  'Self Generated',
  'Employee',
  'Partner',
  'Public Relations',
  'Direct Mail',
  'Conference',
  'Trade Show',
  'Web Site',
  'Word of mouth',
  'Other',
] as const;

const EMPTY: CRMDealFields = {
  dealName:    '',
  stage:       '',
  amount:      '',
  closingDate: '',
  accountName: '',
  probability: '',
  leadSource:  '',
  nextStep:    '',
  description: '',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-red-400 normal-case">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow';

const iconInputCls =
  'w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow';

export default function AddDeal() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CRMDealFields>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof CRMDealFields, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dealName.trim()) { setError('Deal name is required.'); return; }
    if (!form.stage) { setError('Please select a stage.'); return; }
    setError('');
    setSaving(true);
    try {
      await createCRMDeal(form);
      navigate('/deals');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deal. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto">
      {/* Back */}
      <Link
        to="/deals"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft size={15} /> Deal Flow
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center flex-shrink-0">
          <TrendingUp size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add New Deal</h1>
          <p className="text-sm text-gray-400 mt-0.5">Fill in the deal details to track it in your pipeline</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Core Info ─────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp size={15} className="text-indigo-500" /> Deal Information
          </h2>

          <Field label="Deal Name" required>
            <input
              type="text"
              value={form.dealName}
              onChange={e => set('dealName', e.target.value)}
              placeholder="e.g. Acme Corp – Series A"
              className={inputCls}
            />
          </Field>

          <Field label="Account / Company Name">
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={form.accountName}
                onChange={e => set('accountName', e.target.value)}
                placeholder="Company associated with the deal"
                className={iconInputCls}
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Stage" required>
              <div className="relative">
                <select
                  value={form.stage}
                  onChange={e => set('stage', e.target.value)}
                  className={inputCls + ' appearance-none pr-8'}
                >
                  <option value="">Select a stage</option>
                  {CRM_DEAL_STAGES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </Field>

            <Field label="Probability (%)">
              <div className="relative">
                <BarChart2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.probability}
                  onChange={e => set('probability', e.target.value)}
                  placeholder="0 – 100"
                  className={iconInputCls}
                />
              </div>
            </Field>
          </div>
        </div>

        {/* ── Financial ─────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign size={15} className="text-emerald-500" /> Financials & Timeline
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Deal Amount ($)">
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  placeholder="0"
                  className={iconInputCls}
                />
              </div>
            </Field>

            <Field label="Expected Close Date">
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={form.closingDate}
                  onChange={e => set('closingDate', e.target.value)}
                  className={iconInputCls}
                />
              </div>
            </Field>
          </div>

          <Field label="Lead Source">
            <div className="relative">
              <select
                value={form.leadSource}
                onChange={e => set('leadSource', e.target.value)}
                className={inputCls + ' appearance-none pr-8'}
              >
                {LEAD_SOURCES.map(s => (
                  <option key={s} value={s === 'None' ? '' : s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </Field>
        </div>

        {/* ── Notes ─────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileText size={15} className="text-violet-500" /> Notes & Next Steps
          </h2>

          <Field label="Next Step">
            <div className="relative">
              <Zap size={14} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={form.nextStep}
                onChange={e => set('nextStep', e.target.value)}
                placeholder="e.g. Schedule a follow-up call"
                className={iconInputCls}
              />
            </div>
          </Field>

          <Field label="Description / Notes">
            <textarea
              rows={4}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Any additional context about this deal…"
              className={inputCls + ' resize-none'}
            />
          </Field>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <Link
            to="/deals"
            className="flex-1 text-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : (
              <><TrendingUp size={14} /> Add Deal</>
            )}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

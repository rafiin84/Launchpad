import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getCRMDeal, updateCRMDeal, CRM_DEAL_STAGES, type CRMDealFields } from '../services/crmDeals';

const LEAD_SOURCES = [
  'Advertisement', 'Cold Call', 'Employee Referral', 'External Referral',
  'Online Store', 'Partner', 'Public Relations', 'Sales Email Alias',
  'Seminar Partner', 'Internal Seminar', 'Trade Show', 'Web Download',
  'Web Research', 'Chat',
];

type FormState = CRMDealFields;

const EMPTY: FormState = {
  dealName: '', stage: 'Qualification', amount: '', closingDate: '',
  description: '', accountName: '', nextStep: '', probability: '', leadSource: '',
};

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5 normal-case"> *</span>}
      </label>
      {children}
    </div>
  );
}

export default function EditDeal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [form, setForm]       = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!id) return;
    getCRMDeal(id)
      .then(deal => {
        if (!deal) { setError('Deal not found'); setLoading(false); return; }
        setForm({
          dealName:    deal.dealName,
          stage:       deal.stage,
          amount:      deal.amount,
          closingDate: deal.closingDate,
          description: deal.description,
          accountName: deal.accountName,
          nextStep:    deal.nextStep,
          probability: deal.probability,
          leadSource:  deal.leadSource,
        });
        setLoading(false);
      })
      .catch(err => { setError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false); });
  }, [id]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dealName.trim()) { setError('Deal name is required.'); return; }
    if (!form.stage) { setError('Stage is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await updateCRMDeal(id!, form);
      navigate(`/deals/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-4 bg-gray-100 rounded w-32" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
      <Link
        to={`/deals/${id}`}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft size={15} /> Back to Deal
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Edit Deal</h1>
        <p className="text-sm text-gray-400 mt-0.5">Update the deal details below</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Deal Information */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Deal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Deal Name" required>
              <input type="text" value={form.dealName} onChange={set('dealName')}
                placeholder="e.g. Acme Corp — Series A" className={inputCls} />
            </Field>
            <Field label="Account / Company">
              <input type="text" value={form.accountName} onChange={set('accountName')}
                placeholder="e.g. Acme Corp" className={inputCls} />
            </Field>
            <Field label="Stage" required>
              <select value={form.stage} onChange={set('stage')} className={inputCls + ' appearance-none'}>
                {CRM_DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Lead Source">
              <select value={form.leadSource} onChange={set('leadSource')} className={inputCls + ' appearance-none'}>
                <option value="">Select source</option>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Financials & Timeline */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Financials & Timeline</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Amount ($)">
              <input type="number" value={form.amount} onChange={set('amount')}
                placeholder="500000" className={inputCls} />
            </Field>
            <Field label="Probability (%)">
              <input type="number" min="0" max="100" value={form.probability} onChange={set('probability')}
                placeholder="60" className={inputCls} />
            </Field>
            <Field label="Closing Date">
              <input type="date" value={form.closingDate} onChange={set('closingDate')} className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Notes & Next Steps */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Notes & Next Steps</h2>
          <Field label="Next Step">
            <input type="text" value={form.nextStep} onChange={set('nextStep')}
              placeholder="e.g. Send term sheet by Friday" className={inputCls} />
          </Field>
          <Field label="Description">
            <textarea rows={4} value={form.description} onChange={set('description')}
              placeholder="Additional notes about the deal…" className={inputCls + ' resize-none'} />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <Link
            to={`/deals/${id}`}
            className="flex-1 text-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-60"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

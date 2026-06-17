import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Input, Textarea, Select } from '../components/ui/Input';
import { getCRMApplication, updateCRMApplication, type CRMApplicationFields } from '../services/crmApplications';

const INDUSTRY_OPTIONS = [
  { value: 'FinTech',                    label: 'FinTech' },
  { value: 'HealthTech',                 label: 'HealthTech' },
  { value: 'SaaS',                       label: 'SaaS' },
  { value: 'EdTech',                     label: 'EdTech' },
  { value: 'CleanTech',                  label: 'CleanTech' },
  { value: 'AI/ML',                      label: 'AI / ML' },
  { value: 'E-Commerce',                 label: 'E-Commerce' },
  { value: 'Cybersecurity',              label: 'Cybersecurity' },
  { value: 'AgriTech',                   label: 'AgriTech' },
  { value: 'Data & Analytics',           label: 'Data & Analytics' },
  { value: 'Mental Health Tech',         label: 'Mental Health Tech' },
  { value: 'BioTech / Pharma',           label: 'BioTech / Pharma' },
  { value: 'Construction Tech',          label: 'Construction Tech' },
  { value: 'Logistics & Supply Chain',   label: 'Logistics & Supply Chain' },
  { value: 'Developer Tools',            label: 'Developer Tools' },
  { value: 'Retail Tech',                label: 'Retail Tech' },
  { value: 'Artificial Intelligence',    label: 'Artificial Intelligence' },
  { value: 'Other',                      label: 'Other' },
];

const STAGE_OPTIONS = [
  { value: 'New',               label: 'New' },
  { value: 'Under Review',      label: 'Under Review' },
  { value: 'Meeting Scheduled', label: 'Meeting Scheduled' },
  { value: 'Due Diligence',     label: 'Due Diligence' },
  { value: 'IC Review',         label: 'IC Review' },
  { value: 'Rejected',          label: 'Rejected' },
];

type FormState = CRMApplicationFields;

const EMPTY: FormState = {
  companyName: '', industry: '', website: '', fundingAsk: '',
  useOfFunds: '', previousFunding: '', companyDescription: '',
  founderName: '', founderEmail: '', founderPhone: '', founderLinkedin: '',
  pipelineStage: 'New', location: '', teamSize: '', foundedYear: '',
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

export default function EditApplication() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [form, setForm]       = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!id) return;
    getCRMApplication(id)
      .then(app => {
        if (!app) { setError('Application not found'); setLoading(false); return; }
        setForm({
          companyName:        app.companyName,
          industry:           app.industry,
          website:            app.website,
          fundingAsk:         app.fundingAsk,
          useOfFunds:         app.useOfFunds,
          previousFunding:    app.previousFunding,
          companyDescription: app.companyDescription,
          founderName:        app.founderName,
          founderEmail:       app.founderEmail,
          founderPhone:       app.founderPhone,
          founderLinkedin:    app.founderLinkedin,
          pipelineStage:      app.pipelineStage,
          location:           app.location,
          teamSize:           app.teamSize,
          foundedYear:        app.foundedYear,
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
    if (!form.companyName.trim()) { setError('Company name is required.'); return; }
    if (!form.founderName.trim()) { setError('Founder name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await updateCRMApplication(id!, form);
      navigate(`/applications/${id}`);
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
      {/* Back */}
      <Link
        to={`/applications/${id}`}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft size={15} /> Back to Application
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Edit Application</h1>
        <p className="text-sm text-gray-400 mt-0.5">Update the application details below</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Company Info ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Company Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" required>
              <input type="text" value={form.companyName} onChange={set('companyName')}
                placeholder="Acme Inc." className={inputCls} />
            </Field>
            <Field label="Website">
              <input type="url" value={form.website} onChange={set('website')}
                placeholder="https://acme.com" className={inputCls} />
            </Field>
            <Field label="Location">
              <input type="text" value={form.location} onChange={set('location')}
                placeholder="San Francisco, CA" className={inputCls} />
            </Field>
            <Field label="Industry">
              <select value={form.industry} onChange={set('industry')} className={inputCls + ' appearance-none'}>
                <option value="">Select industry</option>
                {INDUSTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Founded Year">
              <input type="number" value={form.foundedYear} onChange={set('foundedYear')}
                placeholder="2021" className={inputCls} />
            </Field>
            <Field label="Team Size">
              <input type="number" value={form.teamSize} onChange={set('teamSize')}
                placeholder="10" className={inputCls} />
            </Field>
          </div>
          <Field label="Company Description">
            <textarea rows={4} value={form.companyDescription} onChange={set('companyDescription')}
              placeholder="Describe the company, mission, and market…" className={inputCls + ' resize-none'} />
          </Field>
        </div>

        {/* ── Funding ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Funding Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Funding Ask ($)">
              <input type="number" value={form.fundingAsk} onChange={set('fundingAsk')}
                placeholder="500000" className={inputCls} />
            </Field>
            <Field label="Previous Funding ($)">
              <input type="number" value={form.previousFunding} onChange={set('previousFunding')}
                placeholder="0" className={inputCls} />
            </Field>
          </div>
          <Field label="Use of Funds">
            <textarea rows={3} value={form.useOfFunds} onChange={set('useOfFunds')}
              placeholder="How will the funding be used?" className={inputCls + ' resize-none'} />
          </Field>
        </div>

        {/* ── Pipeline Stage ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Pipeline Stage</h2>
          <Field label="Current Stage">
            <select value={form.pipelineStage} onChange={set('pipelineStage')} className={inputCls + ' appearance-none'}>
              {STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        {/* ── Founder ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Founder Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Founder Name" required>
              <input type="text" value={form.founderName} onChange={set('founderName')}
                placeholder="Jane Doe" className={inputCls} />
            </Field>
            <Field label="Founder Email">
              <input type="email" value={form.founderEmail} onChange={set('founderEmail')}
                placeholder="jane@acme.com" className={inputCls} />
            </Field>
            <Field label="Founder Phone">
              <input type="tel" value={form.founderPhone} onChange={set('founderPhone')}
                placeholder="+1 555 000 0000" className={inputCls} />
            </Field>
            <Field label="Founder LinkedIn">
              <input type="url" value={form.founderLinkedin} onChange={set('founderLinkedin')}
                placeholder="https://linkedin.com/in/..." className={inputCls} />
            </Field>
          </div>
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
            to={`/applications/${id}`}
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

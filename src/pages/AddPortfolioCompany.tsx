import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, AlertCircle } from 'lucide-react';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';
import { savePortfolioCompany } from '../services/store';
import { createCRMPortfolioRecord } from '../services/crmPortfolio';
import { loadToken } from '../services/oauth';
import { useLanguage } from '../context/LanguageContext';

// ---------------------------------------------------------------------------
// LogoUpload
// ---------------------------------------------------------------------------
interface LogoUploadProps {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
}

function LogoUpload({ label, value, onChange }: LogoUploadProps) {
  const ref = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 mb-1.5">{label}</p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          'w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center',
          'hover:border-gray-400 hover:bg-gray-50 transition-all overflow-hidden',
          value ? 'border-solid border-gray-200 p-0' : 'gap-1'
        )}
      >
        {value ? (
          <img src={value} alt="Logo preview" className="w-full h-full object-cover" />
        ) : (
          <>
            <Upload className="w-5 h-5 text-gray-400" />
            <span className="text-xs text-gray-400 text-center leading-tight px-1">{label}</span>
          </>
        )}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
const industryOptions = [
  { value: 'fintech', label: 'FinTech' },
  { value: 'healthtech', label: 'HealthTech' },
  { value: 'saas', label: 'SaaS' },
  { value: 'edtech', label: 'EdTech' },
  { value: 'cleantech', label: 'CleanTech' },
  { value: 'ai-ml', label: 'AI/ML' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'other', label: 'Other' },
];

const stageOptions = [
  { value: 'pre-seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B' },
  { value: 'series-c', label: 'Series C' },
  { value: 'growth', label: 'Growth' },
  { value: 'pre-ipo', label: 'Pre-IPO' },
];

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
interface FormState {
  logo: string;
  companyName: string;
  website: string;
  location: string;
  industry: string;
  stage: string;
  foundedYear: string;
  teamSize: string;
  shortDescription: string;
  fullDescription: string;
  tags: string;
  investmentAmount: string;
  investmentDate: string;
  preMoneyValuation: string;
  ownershipPct: string;
  status: string;
  notes: string;
  founderName: string;
  founderEmail: string;
  founderLinkedin: string;
  founderPhone: string;
}

const empty: FormState = {
  logo: '', companyName: '', website: '', location: '', industry: '', stage: '',
  foundedYear: '', teamSize: '', shortDescription: '', fullDescription: '', tags: '',
  investmentAmount: '', investmentDate: '', preMoneyValuation: '', ownershipPct: '',
  status: '', notes: '', founderName: '', founderEmail: '', founderLinkedin: '', founderPhone: '',
};

function validate(f: FormState, t: any): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.companyName.trim()) e.companyName = t.addPortfolio.nameRequired;
  if (!f.industry) e.industry = t.addPortfolio.industryRequired;
  if (!f.stage) e.stage = t.addPortfolio.stageRequired;
  if (!f.shortDescription.trim()) e.shortDescription = t.addPortfolio.descriptionRequired;
  if (!f.investmentAmount.trim()) e.investmentAmount = t.addPortfolio.amountRequired;
  if (!f.investmentDate) e.investmentDate = t.addPortfolio.dateRequired;
  if (!f.status) e.status = t.addPortfolio.statusRequired;
  return e;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AddPortfolioCompany() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const isConnected = !!loadToken();

  const statusOptions = [
    { value: 'active', label: t.addPortfolio.statusActive },
    { value: 'exited', label: t.addPortfolio.statusExited },
    { value: 'written-off', label: t.addPortfolio.statusWrittenOff },
    { value: 'follow-on', label: t.addPortfolio.statusFollowOn },
  ];

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form, t);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    setApiError('');

    try {
      if (isConnected) {
        await createCRMPortfolioRecord(form);
      } else {
        savePortfolioCompany(form);
      }
      navigate('/portfolio');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        {/* Back nav */}
        <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t.addPortfolio.backToPortfolio}
        </Link>

        <PageHeader title={t.addPortfolio.addPortfolioCompany} description={t.addPortfolio.addDescription} />

        {/* CRM connection status */}
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-xs font-medium ${isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          {isConnected
            ? t.addPortfolio.crmConnected
            : t.addPortfolio.crmNotConnected}
        </div>

        {apiError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600">{apiError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Company Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">{t.addPortfolio.companyInfo}</p>
            <div className="mb-4">
              <LogoUpload label={t.addPortfolio.uploadLogo} value={form.logo} onChange={(v) => setForm((p) => ({ ...p, logo: v }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={`${t.addPortfolio.companyName} *`} value={form.companyName} onChange={set('companyName')} error={errors.companyName} placeholder="Acme Inc." />
              <Input label={t.addPortfolio.website} type="url" value={form.website} onChange={set('website')} placeholder="https://acme.com" />
              <Input label={t.addPortfolio.location} value={form.location} onChange={set('location')} placeholder="San Francisco, CA" />
              <Select label={`${t.addPortfolio.industry} *`} value={form.industry} onChange={set('industry')} options={industryOptions} placeholder={t.addPortfolio.industry} error={errors.industry} />
              <Select label={`${t.addPortfolio.companyStage} *`} value={form.stage} onChange={set('stage')} options={stageOptions} placeholder={t.addPortfolio.companyStage} error={errors.stage} />
              <Input label={t.addPortfolio.foundedYear} type="number" value={form.foundedYear} onChange={set('foundedYear')} placeholder="2020" />
              <Input label={t.addPortfolio.teamSize} type="number" value={form.teamSize} onChange={set('teamSize')} placeholder="25" />
              <Input label={`${t.addPortfolio.shortDescription} *`} value={form.shortDescription} onChange={set('shortDescription')} error={errors.shortDescription} placeholder="" className="sm:col-span-2" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <Textarea label={t.addPortfolio.fullDescription} value={form.fullDescription} onChange={set('fullDescription')} placeholder="" rows={4} />
              <Input label={t.addPortfolio.tags} value={form.tags} onChange={set('tags')} placeholder="" />
            </div>
          </div>

          {/* Investment Details */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">{t.addPortfolio.investmentDetails}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={`${t.addPortfolio.investmentAmount} *`} type="number" value={form.investmentAmount} onChange={set('investmentAmount')} error={errors.investmentAmount} placeholder="500000" />
              <Input label={`${t.addPortfolio.investmentDate} *`} type="date" value={form.investmentDate} onChange={set('investmentDate')} error={errors.investmentDate} />
              <Input label={t.addPortfolio.preMoneyValuation} type="number" value={form.preMoneyValuation} onChange={set('preMoneyValuation')} placeholder="5000000" />
              <Input label={t.addPortfolio.ownershipPct} type="number" value={form.ownershipPct} onChange={set('ownershipPct')} placeholder="10.00" step="0.01" />
              <Select label={`${t.addPortfolio.status} *`} value={form.status} onChange={set('status')} options={statusOptions} placeholder={t.addPortfolio.status} error={errors.status} className="sm:col-span-2" />
            </div>
            <div className="mt-4">
              <Textarea label={t.addPortfolio.notes} value={form.notes} onChange={set('notes')} placeholder="" rows={3} />
            </div>
          </div>

          {/* Founder Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">{t.addPortfolio.founderInfo}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={t.addPortfolio.founderName} value={form.founderName} onChange={set('founderName')} placeholder="Jane Doe" />
              <Input label={t.addPortfolio.founderEmail} type="email" value={form.founderEmail} onChange={set('founderEmail')} placeholder="jane@acme.com" />
              <Input label={t.addPortfolio.founderLinkedIn} value={form.founderLinkedin} onChange={set('founderLinkedin')} placeholder="https://linkedin.com/in/..." />
              <Input label={t.addPortfolio.founderPhone} type="tel" value={form.founderPhone} onChange={set('founderPhone')} placeholder="+1 555 000 0000" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 pb-8">
            <Link to="/portfolio">
              <Button type="button" variant="outline" disabled={submitting}>{t.common.cancel}</Button>
            </Link>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {t.addPortfolio.savingToCRM}
                </span>
              ) : t.addPortfolio.addToPortfolio}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

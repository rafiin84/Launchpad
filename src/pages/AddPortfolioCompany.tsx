import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';

// ---------------------------------------------------------------------------
// LogoUpload
// ---------------------------------------------------------------------------
interface LogoUploadProps {
  label?: string;
  value: string;
  onChange: (dataUrl: string) => void;
}

function LogoUpload({ label = 'Company Logo', value, onChange }: LogoUploadProps) {
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
            <span className="text-xs text-gray-400 text-center leading-tight px-1">Upload logo</span>
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

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'exited', label: 'Exited' },
  { value: 'written-off', label: 'Written Off' },
  { value: 'follow-on', label: 'Follow-On' },
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

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.companyName.trim()) e.companyName = 'Company name is required';
  if (!f.industry) e.industry = 'Industry is required';
  if (!f.stage) e.stage = 'Stage is required';
  if (!f.shortDescription.trim()) e.shortDescription = 'Short description is required';
  if (!f.investmentAmount.trim()) e.investmentAmount = 'Investment amount is required';
  if (!f.investmentDate) e.investmentDate = 'Investment date is required';
  if (!f.status) e.status = 'Status is required';
  return e;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AddPortfolioCompany() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    console.log('AddPortfolioCompany submit:', form);
    navigate('/portfolio');
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        {/* Back nav */}
        <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Portfolio
        </Link>

        <PageHeader title="Add Portfolio Company" description="Record a new investment in your portfolio." />

        <form onSubmit={handleSubmit} noValidate>
          {/* Company Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Company Info</p>
            <div className="mb-4">
              <LogoUpload value={form.logo} onChange={(v) => setForm((p) => ({ ...p, logo: v }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Company Name *" value={form.companyName} onChange={set('companyName')} error={errors.companyName} placeholder="Acme Inc." />
              <Input label="Website" type="url" value={form.website} onChange={set('website')} placeholder="https://acme.com" />
              <Input label="Location" value={form.location} onChange={set('location')} placeholder="San Francisco, CA" />
              <Select label="Industry *" value={form.industry} onChange={set('industry')} options={industryOptions} placeholder="Select industry" error={errors.industry} />
              <Select label="Company Stage *" value={form.stage} onChange={set('stage')} options={stageOptions} placeholder="Select stage" error={errors.stage} />
              <Input label="Founded Year" type="number" value={form.foundedYear} onChange={set('foundedYear')} placeholder="2020" />
              <Input label="Team Size" type="number" value={form.teamSize} onChange={set('teamSize')} placeholder="25" />
              <Input label="Short Description *" value={form.shortDescription} onChange={set('shortDescription')} error={errors.shortDescription} placeholder="One-line pitch" className="sm:col-span-2" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <Textarea label="Full Description" value={form.fullDescription} onChange={set('fullDescription')} placeholder="Describe the company, its mission, and market opportunity..." rows={4} />
              <Input label="Tags" value={form.tags} onChange={set('tags')} placeholder="e.g. fintech, b2b, saas — comma separated" />
            </div>
          </div>

          {/* Investment Details */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Investment Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Investment Amount *" type="number" value={form.investmentAmount} onChange={set('investmentAmount')} error={errors.investmentAmount} placeholder="500000" />
              <Input label="Investment Date *" type="date" value={form.investmentDate} onChange={set('investmentDate')} error={errors.investmentDate} />
              <Input label="Pre-Money Valuation" type="number" value={form.preMoneyValuation} onChange={set('preMoneyValuation')} placeholder="5000000" />
              <Input label="Ownership %" type="number" value={form.ownershipPct} onChange={set('ownershipPct')} placeholder="10.00" step="0.01" />
              <Select label="Status *" value={form.status} onChange={set('status')} options={statusOptions} placeholder="Select status" error={errors.status} className="sm:col-span-2" />
            </div>
            <div className="mt-4">
              <Textarea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Any notes about this investment..." rows={3} />
            </div>
          </div>

          {/* Founder Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Founder Info</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Founder Name" value={form.founderName} onChange={set('founderName')} placeholder="Jane Doe" />
              <Input label="Founder Email" type="email" value={form.founderEmail} onChange={set('founderEmail')} placeholder="jane@acme.com" />
              <Input label="Founder LinkedIn" value={form.founderLinkedin} onChange={set('founderLinkedin')} placeholder="https://linkedin.com/in/..." />
              <Input label="Founder Phone" type="tel" value={form.founderPhone} onChange={set('founderPhone')} placeholder="+1 555 000 0000" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 pb-8">
            <Link to="/portfolio">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" variant="primary">Add to Portfolio</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

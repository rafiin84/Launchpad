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
];

const fundingStatusOptions = [
  { value: 'bootstrapped', label: 'Bootstrapped' },
  { value: 'pre-revenue', label: 'Pre-Revenue' },
  { value: 'fundraising', label: 'Currently Fundraising' },
  { value: 'funded', label: 'Funded' },
];

const roundOptions = [
  { value: 'not-raising', label: 'Not Raising' },
  { value: 'pre-seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B' },
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
  oneLinePitch: string;
  fullDescription: string;
  tags: string;
  fundingStatus: string;
  totalRaised: string;
  currentRound: string;
  linkedin: string;
  twitter: string;
  crunchbase: string;
}

const empty: FormState = {
  logo: '', companyName: '', website: '', location: '', industry: '', stage: '',
  foundedYear: '', teamSize: '', oneLinePitch: '', fullDescription: '', tags: '',
  fundingStatus: '', totalRaised: '', currentRound: '',
  linkedin: '', twitter: '', crunchbase: '',
};

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.companyName.trim()) e.companyName = 'Company name is required';
  if (!f.website.trim()) e.website = 'Website is required';
  if (!f.industry) e.industry = 'Industry is required';
  if (!f.stage) e.stage = 'Stage is required';
  if (!f.foundedYear.trim()) e.foundedYear = 'Founded year is required';
  if (!f.oneLinePitch.trim()) e.oneLinePitch = 'One-line pitch is required';
  return e;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AddCompany() {
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
    console.log('AddCompany submit:', form);
    navigate('/companies');
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/companies" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Companies
        </Link>

        <PageHeader title="Add Company" description="List your startup in the Launchpad network." />

        <form onSubmit={handleSubmit} noValidate>
          {/* Basic Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Basic Info</p>
            <div className="mb-4">
              <LogoUpload value={form.logo} onChange={(v) => setForm((p) => ({ ...p, logo: v }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Company Name *" value={form.companyName} onChange={set('companyName')} error={errors.companyName} placeholder="Acme Inc." />
              <Input label="Website *" type="url" value={form.website} onChange={set('website')} error={errors.website} placeholder="https://acme.com" />
              <Input label="Location" value={form.location} onChange={set('location')} placeholder="San Francisco, CA" />
              <Select label="Industry *" value={form.industry} onChange={set('industry')} options={industryOptions} placeholder="Select industry" error={errors.industry} />
              <Select label="Stage *" value={form.stage} onChange={set('stage')} options={stageOptions} placeholder="Select stage" error={errors.stage} />
              <Input label="Founded Year *" type="number" value={form.foundedYear} onChange={set('foundedYear')} error={errors.foundedYear} placeholder="2021" />
              <Input label="Team Size" type="number" value={form.teamSize} onChange={set('teamSize')} placeholder="12" />
            </div>
          </div>

          {/* Your Story */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Your Story</p>
            <div className="grid grid-cols-1 gap-4">
              <Input
                label="One-Line Pitch *"
                value={form.oneLinePitch}
                onChange={set('oneLinePitch')}
                error={errors.oneLinePitch}
                placeholder="e.g. Stripe for Africa"
                maxLength={120}
              />
              <Textarea label="Full Description" value={form.fullDescription} onChange={set('fullDescription')} placeholder="Tell us your story — what problem are you solving, who for, and why now?" rows={5} />
              <Input label="Tags" value={form.tags} onChange={set('tags')} placeholder="fintech, b2b, saas" />
            </div>
          </div>

          {/* Funding */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Funding</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Funding Status" value={form.fundingStatus} onChange={set('fundingStatus')} options={fundingStatusOptions} placeholder="Select status" />
              <Input label="Total Raised" type="number" value={form.totalRaised} onChange={set('totalRaised')} placeholder="0 if bootstrapped" />
              <Select label="Current Round" value={form.currentRound} onChange={set('currentRound')} options={roundOptions} placeholder="Select round" className="sm:col-span-2" />
            </div>
          </div>

          {/* Social & Links */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Social & Links</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="LinkedIn URL" value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/company/..." />
              <Input label="Twitter / X" value={form.twitter} onChange={set('twitter')} placeholder="@handle" />
              <Input label="Crunchbase" value={form.crunchbase} onChange={set('crunchbase')} placeholder="https://crunchbase.com/organization/..." className="sm:col-span-2" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 pb-8">
            <Link to="/companies">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" variant="primary">Add Company</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

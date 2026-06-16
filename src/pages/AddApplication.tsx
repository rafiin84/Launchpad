import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText } from 'lucide-react';
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
  amountRequested: string;
  useOfFunds: string;
  previousFunding: string;
  pitchDeckName: string;
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderLinkedin: string;
  founderBio: string;
}

const empty: FormState = {
  logo: '', companyName: '', website: '', location: '', industry: '', stage: '',
  foundedYear: '', teamSize: '', shortDescription: '', fullDescription: '',
  amountRequested: '', useOfFunds: '', previousFunding: '', pitchDeckName: '',
  founderName: '', founderEmail: '', founderPhone: '', founderLinkedin: '', founderBio: '',
};

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.companyName.trim()) e.companyName = 'Company name is required';
  if (!f.website.trim()) e.website = 'Website is required';
  if (!f.industry) e.industry = 'Industry is required';
  if (!f.stage) e.stage = 'Stage is required';
  if (!f.shortDescription.trim()) e.shortDescription = 'Short description is required';
  if (!f.amountRequested.trim()) e.amountRequested = 'Amount requested is required';
  if (!f.useOfFunds.trim()) e.useOfFunds = 'Use of funds is required';
  if (!f.founderName.trim()) e.founderName = 'Founder name is required';
  if (!f.founderEmail.trim()) e.founderEmail = 'Founder email is required';
  return e;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AddApplication() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pitchDeckRef = useRef<HTMLInputElement>(null);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function handlePitchDeck(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setForm((prev) => ({ ...prev, pitchDeckName: file.name }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    console.log('AddApplication submit:', form);
    navigate('/applications');
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/applications" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Link>

        <PageHeader title="Submit Application" description="Apply for funding consideration." />

        <form onSubmit={handleSubmit} noValidate>
          {/* Company Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Company Info</p>
            <div className="mb-4">
              <LogoUpload value={form.logo} onChange={(v) => setForm((p) => ({ ...p, logo: v }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Company Name *" value={form.companyName} onChange={set('companyName')} error={errors.companyName} placeholder="Acme Inc." />
              <Input label="Website *" type="url" value={form.website} onChange={set('website')} error={errors.website} placeholder="https://acme.com" />
              <Input label="Location" value={form.location} onChange={set('location')} placeholder="San Francisco, CA" />
              <Select label="Industry *" value={form.industry} onChange={set('industry')} options={industryOptions} placeholder="Select industry" error={errors.industry} />
              <Select label="Company Stage *" value={form.stage} onChange={set('stage')} options={stageOptions} placeholder="Select stage" error={errors.stage} />
              <Input label="Founded Year" type="number" value={form.foundedYear} onChange={set('foundedYear')} placeholder="2021" />
              <Input label="Team Size" type="number" value={form.teamSize} onChange={set('teamSize')} placeholder="10" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <Input
                label="Short Description *"
                value={form.shortDescription}
                onChange={set('shortDescription')}
                error={errors.shortDescription}
                placeholder="One sentence: what they build and for whom"
                maxLength={160}
              />
              <Textarea label="Full Description" value={form.fullDescription} onChange={set('fullDescription')} placeholder="Tell us more about your company, mission, and market..." rows={4} />
            </div>
          </div>

          {/* Funding Request */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Funding Request</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Amount Requested *" type="number" value={form.amountRequested} onChange={set('amountRequested')} error={errors.amountRequested} placeholder="500000" />
              <Input label="Previous Funding" type="number" value={form.previousFunding} onChange={set('previousFunding')} placeholder="0 if none" />
            </div>
            <div className="mt-4">
              <Textarea label="Use of Funds *" value={form.useOfFunds} onChange={set('useOfFunds')} error={errors.useOfFunds} placeholder="How will the funding be used?" rows={3} />
            </div>

            {/* Pitch Deck Upload */}
            <div className="mt-4">
              <p className="block text-sm font-medium text-gray-700 mb-1.5">Pitch Deck (PDF)</p>
              <button
                type="button"
                onClick={() => pitchDeckRef.current?.click()}
                className={cn(
                  'w-full border-2 border-dashed border-gray-200 rounded-xl px-4 py-5 flex flex-col items-center gap-2',
                  'hover:border-gray-400 hover:bg-gray-50 transition-all'
                )}
              >
                <FileText className="w-7 h-7 text-gray-400" />
                {form.pitchDeckName ? (
                  <span className="text-sm text-gray-700 font-medium">{form.pitchDeckName}</span>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-700">Click to upload PDF</span>
                    <span className="text-xs text-gray-400">PDF up to 50MB</span>
                  </>
                )}
              </button>
              <input ref={pitchDeckRef} type="file" accept=".pdf" className="hidden" onChange={handlePitchDeck} />
            </div>
          </div>

          {/* Founder Details */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Founder Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Founder Name *" value={form.founderName} onChange={set('founderName')} error={errors.founderName} placeholder="Jane Doe" />
              <Input label="Founder Email *" type="email" value={form.founderEmail} onChange={set('founderEmail')} error={errors.founderEmail} placeholder="jane@acme.com" />
              <Input label="Founder Phone" type="tel" value={form.founderPhone} onChange={set('founderPhone')} placeholder="+1 555 000 0000" />
              <Input label="Founder LinkedIn" value={form.founderLinkedin} onChange={set('founderLinkedin')} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="mt-4">
              <Textarea label="Founder Bio" value={form.founderBio} onChange={set('founderBio')} placeholder="Brief background on the founder(s)..." rows={4} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 pb-8">
            <Link to="/applications">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" variant="primary">Submit Application</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

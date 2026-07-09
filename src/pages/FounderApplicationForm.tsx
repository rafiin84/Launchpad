import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  User,
  Briefcase,
  DollarSign,
  TrendingUp,
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Save,
  Send,
  Upload,
  X,
  Pencil,
  Check,
  Globe,
  Video,
  File,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  createApplication,
  getApplicationById,
  getApplications,
  canApplyAgain,
  updateApplication,
  type InvestmentApplicationFields,
} from '../services/investmentApplications';
import { fetchCompanyProfile, EMPTY, type CompanyData } from '../services/companyProfile';
import { addNotification } from '../services/notifications';
import { cn } from '../lib/cn';

// ─── Constants ──────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  'SaaS',
  'Fintech',
  'Healthtech',
  'Edtech',
  'E-commerce',
  'Marketplace',
  'AI/ML',
  'Hardware',
  'Deep Tech',
  'Consumer',
  'Enterprise',
  'Other',
];

const STAGE_OPTIONS = [
  'Idea',
  'Pre-Seed',
  'Seed',
  'Series A',
  'Series B',
  'Series C',
  'Growth',
];

const ROLE_OPTIONS = ['CEO', 'CTO', 'COO', 'CFO', 'CPO', 'Other'];

const STEPS = [
  { label: 'Company Info', icon: Building2 },
  { label: 'Founder Details', icon: User },
  { label: 'Business Overview', icon: Briefcase },
  { label: 'Funding & Financials', icon: DollarSign },
  { label: 'Traction & Metrics', icon: TrendingUp },
  { label: 'Pitch Materials', icon: FileText },
  { label: 'Review & Submit', icon: CheckCircle2 },
];

// ─── Form data shape ────────────────────────────────────────────────────────

interface FormData {
  // Step 1 — Company Information
  companyName: string;
  companyWebsite: string;
  companyIndustry: string;
  companyStage: string;
  companyLocation: string;
  foundedYear: string;
  companyDescription: string;

  // Step 2 — Founder Details
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderLinkedin: string;
  founderRole: string;
  coFounders: string;

  // Step 3 — Business Overview
  problemStatement: string;
  solution: string;
  targetMarket: string;
  businessModel: string;
  competitiveAdvantage: string;

  // Step 4 — Funding & Financials
  fundingAsk: string;
  useOfFunds: string;
  previousFunding: string;
  currentValuation: string;
  equityOffered: string;
  currentRevenue: string;
  mrr: string;
  arr: string;
  monthlyBurn: string;
  runway: string;

  // Step 5 — Traction & Metrics
  activeUsers: string;
  momGrowth: string;
  churnRate: string;
  nps: string;
  keyMetric: string;
  keyMetricLabel: string;

  // Step 6 — Pitch Materials
  pitchDeckUrl: string;
  pitchDeckName: string;
  demoVideoUrl: string;
  supportingDocs: { name: string; url: string }[];
}

const EMPTY_FORM: FormData = {
  companyName: '',
  companyWebsite: '',
  companyIndustry: '',
  companyStage: '',
  companyLocation: '',
  foundedYear: '',
  companyDescription: '',
  founderName: '',
  founderEmail: '',
  founderPhone: '',
  founderLinkedin: '',
  founderRole: '',
  coFounders: '',
  problemStatement: '',
  solution: '',
  targetMarket: '',
  businessModel: '',
  competitiveAdvantage: '',
  fundingAsk: '',
  useOfFunds: '',
  previousFunding: '',
  currentValuation: '',
  equityOffered: '',
  currentRevenue: '',
  mrr: '',
  arr: '',
  monthlyBurn: '',
  runway: '',
  activeUsers: '',
  momGrowth: '',
  churnRate: '',
  nps: '',
  keyMetric: '',
  keyMetricLabel: '',
  pitchDeckUrl: '',
  pitchDeckName: '',
  demoVideoUrl: '',
  supportingDocs: [],
};

// ─── Styling helpers ────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black';
const labelClass = 'block text-xs text-gray-500 mb-1';
const headingClass = 'text-sm font-semibold text-gray-900';

// ─── Small reusable components ──────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, required && !value.trim() && 'border-red-200')}
      />
    </Field>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, required && !value && 'border-red-200')}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

function TextareaInput({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(`${inputClass} resize-none`, required && !value.trim() && 'border-red-200')}
      />
    </Field>
  );
}

// ─── Progress Stepper ───────────────────────────────────────────────────────

function ProgressStepper({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.label}>
            <button
              type="button"
              onClick={() => onStepClick(idx)}
              className="flex flex-col items-center gap-1.5 min-w-[72px] group"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isCompleted
                    ? 'bg-black text-white'
                    : isCurrent
                    ? 'bg-black text-white ring-2 ring-offset-2 ring-black'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-[11px] leading-tight text-center ${
                  isCurrent ? 'text-gray-900 font-semibold' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-1 ${
                  idx < currentStep ? 'bg-black' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function FounderApplicationForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, isInvestor } = useAuth();

  const editId = searchParams.get('edit');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');

  // Check if user already has an active application (not editing a draft)
  useEffect(() => {
    if (editId || isInvestor) return;
    const email = currentUser?.email;
    if (!email) return;
    getApplications(false, email).then(apps => {
      if (!canApplyAgain(apps)) {
        setBlocked(true);
      }
    }).catch(() => {});
  }, [editId, isInvestor, currentUser?.email]);

  // Refs for file inputs
  const pitchDeckRef = useRef<HTMLInputElement>(null);
  const supportingDocRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // ── Load existing draft if editing ──────────────────────────────────────

  useEffect(() => {
    if (editId) {
      (async () => {
        const existing = await getApplicationById(editId, isInvestor);
        if (existing) {
          let docs: { name: string; url: string }[] = [];
          try {
            docs = JSON.parse(existing.supportingDocs || '[]');
          } catch {
            docs = [];
          }
          setOriginalStatus(existing.status);
          setForm({
            companyName: existing.companyName,
            companyWebsite: existing.companyWebsite,
            companyIndustry: existing.companyIndustry,
            companyStage: existing.companyStage,
            companyLocation: existing.companyLocation,
            foundedYear: existing.foundedYear,
            companyDescription: existing.companyDescription,
            founderName: existing.founderName,
            founderEmail: existing.founderEmail,
            founderPhone: existing.founderPhone,
            founderLinkedin: existing.founderLinkedin,
            founderRole: existing.founderRole,
            coFounders: existing.coFounders,
            problemStatement: existing.problemStatement,
            solution: existing.solution,
            targetMarket: existing.targetMarket,
            businessModel: existing.businessModel,
            competitiveAdvantage: existing.competitiveAdvantage,
            fundingAsk: existing.fundingAsk,
            useOfFunds: existing.useOfFunds,
            previousFunding: existing.previousFunding,
            currentValuation: existing.currentValuation,
            equityOffered: existing.equityOffered,
            currentRevenue: existing.currentRevenue,
            mrr: existing.mrr,
            arr: existing.arr,
            monthlyBurn: existing.monthlyBurn,
            runway: existing.runway,
            activeUsers: existing.activeUsers,
            momGrowth: existing.momGrowth,
            churnRate: existing.churnRate,
            nps: existing.nps,
            keyMetric: existing.keyMetric,
            keyMetricLabel: existing.keyMetricLabel,
            pitchDeckUrl: existing.pitchDeckUrl,
            pitchDeckName: existing.pitchDeckName,
            demoVideoUrl: existing.demoVideoUrl,
            supportingDocs: docs,
          });
        }
      })();
    }
  }, [editId, isInvestor]);

  // ── Auto-populate founder info from auth ────────────────────────────────

  useEffect(() => {
    if (!editId && currentUser) {
      setForm((prev) => ({
        ...prev,
        founderName: prev.founderName || currentUser.name || '',
        founderEmail: prev.founderEmail || currentUser.email || '',
      }));
    }
  }, [currentUser, editId]);

  // ── Auto-fill from company profile ─────────────────────────────────────

  useEffect(() => {
    if (editId) return;
    const email = currentUser?.email;
    if (!email) return;
    fetchCompanyProfile(email).then((result) => {
      const profile = result.data;
      if (!profile || profile === EMPTY) return;
      setForm((prev) => ({
        ...prev,
        companyName: prev.companyName || profile.name || '',
        companyWebsite: prev.companyWebsite || profile.website || '',
        companyIndustry: prev.companyIndustry || profile.industry || '',
        companyStage: prev.companyStage || profile.stage || '',
        companyLocation: prev.companyLocation || profile.location || '',
        foundedYear: prev.foundedYear || profile.foundedYear || '',
        companyDescription: prev.companyDescription || profile.description || '',
        founderName: prev.founderName || profile.founderNames || currentUser?.name || '',
        targetMarket: prev.targetMarket || profile.targetMarket || '',
        businessModel: prev.businessModel || profile.revenueModel || '',
        competitiveAdvantage: prev.competitiveAdvantage || profile.differentiator || '',
        fundingAsk: prev.fundingAsk || profile.currentAsk || '',
        useOfFunds: prev.useOfFunds || profile.useOfFunds || '',
        previousFunding: prev.previousFunding || profile.totalRaised || '',
        currentValuation: prev.currentValuation || profile.preMoneyValuation || '',
        currentRevenue: prev.currentRevenue || profile.arr || '',
        mrr: prev.mrr || profile.mrr || '',
        arr: prev.arr || profile.arr || '',
        monthlyBurn: prev.monthlyBurn || profile.monthlyBurn || '',
        runway: prev.runway || profile.runway || '',
        activeUsers: prev.activeUsers || profile.activeCustomers || '',
        momGrowth: prev.momGrowth || profile.momGrowth || '',
        churnRate: prev.churnRate || profile.churnRate || '',
        nps: prev.nps || profile.nps || '',
      }));
    }).catch(() => {});
  }, [currentUser?.email, editId]);

  // ── Field updater ───────────────────────────────────────────────────────

  const set = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setValidationError('');
    },
    [],
  );

  // ── File handling ───────────────────────────────────────────────────────

  function handlePitchDeckUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((prev) => ({
        ...prev,
        pitchDeckUrl: ev.target?.result as string,
        pitchDeckName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleSupportingDocUpload(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((prev) => {
        const docs = [...prev.supportingDocs];
        docs[index] = { name: file.name, url: ev.target?.result as string };
        return { ...prev, supportingDocs: docs };
      });
    };
    reader.readAsDataURL(file);
  }

  function removeSupportingDoc(index: number) {
    setForm((prev) => {
      const docs = prev.supportingDocs.filter((_, i) => i !== index);
      return { ...prev, supportingDocs: docs };
    });
  }

  // ── Build fields payload ────────────────────────────────────────────────

  function buildFields(status: 'draft' | 'submitted'): InvestmentApplicationFields {
    return {
      status,
      companyName: form.companyName,
      companyWebsite: form.companyWebsite,
      companyIndustry: form.companyIndustry,
      companyStage: form.companyStage,
      companyLocation: form.companyLocation,
      foundedYear: form.foundedYear,
      companyDescription: form.companyDescription,
      founderName: form.founderName,
      founderEmail: form.founderEmail,
      founderPhone: form.founderPhone,
      founderLinkedin: form.founderLinkedin,
      founderRole: form.founderRole,
      coFounders: form.coFounders,
      problemStatement: form.problemStatement,
      solution: form.solution,
      targetMarket: form.targetMarket,
      businessModel: form.businessModel,
      competitiveAdvantage: form.competitiveAdvantage,
      fundingAsk: form.fundingAsk,
      useOfFunds: form.useOfFunds,
      previousFunding: form.previousFunding,
      currentValuation: form.currentValuation,
      equityOffered: form.equityOffered,
      currentRevenue: form.currentRevenue,
      mrr: form.mrr,
      arr: form.arr,
      monthlyBurn: form.monthlyBurn,
      runway: form.runway,
      activeUsers: form.activeUsers,
      momGrowth: form.momGrowth,
      churnRate: form.churnRate,
      nps: form.nps,
      keyMetric: form.keyMetric,
      keyMetricLabel: form.keyMetricLabel,
      pitchDeckUrl: form.pitchDeckUrl,
      pitchDeckName: form.pitchDeckName,
      demoVideoUrl: form.demoVideoUrl,
      supportingDocs: JSON.stringify(form.supportingDocs),
      submittedBy: currentUser?.name || '',
      submittedByEmail: currentUser?.email || '',
      submittedByRole: 'founder',
      investorNotes: '',
      reviewedBy: '',
      reviewedAt: '',
      requestedDocuments: '',
      meetingDate: '',
      meetingLocation: '',
      meetingLink: '',
      meetingAgenda: '',
    };
  }

  // ── Save draft ──────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    setSaving(true);
    try {
      const fields = buildFields('draft');
      if (editId) {
        await updateApplication(editId, fields, isInvestor);
      } else {
        await createApplication(fields, isInvestor);
      }
    } finally {
      setSaving(false);
    }
    navigate('/applications');
  }

  // ── Submit ──────────────────────────────────────────────────────────────

  const REQUIRED_FIELDS: { key: keyof typeof form; label: string; step: number }[] = [
    { key: 'companyName',        label: 'Company Name',        step: 0 },
    { key: 'companyIndustry',    label: 'Industry',            step: 0 },
    { key: 'companyStage',       label: 'Company Stage',       step: 0 },
    { key: 'companyDescription', label: 'Company Description', step: 0 },
    { key: 'founderName',        label: 'Founder Name',        step: 1 },
    { key: 'founderEmail',       label: 'Founder Email',       step: 1 },
    { key: 'problemStatement',   label: 'Problem Statement',   step: 2 },
    { key: 'solution',           label: 'Solution',            step: 2 },
    { key: 'fundingAsk',         label: 'Funding Ask',         step: 3 },
    { key: 'equityOffered',      label: 'Equity Offered',      step: 3 },
  ];

  function validateStep(s: number): string | null {
    const missing = REQUIRED_FIELDS.filter(f => f.step === s).filter(f => {
      const val = form[f.key];
      return typeof val === 'string' ? !val.trim() : !val;
    });
    if (missing.length === 0) return null;
    return `Please fill in: ${missing.map(f => f.label).join(', ')}`;
  }

  function validateForm(): string | null {
    const missing = REQUIRED_FIELDS.filter(f => {
      const val = form[f.key];
      return typeof val === 'string' ? !val.trim() : !val;
    });
    if (missing.length === 0) return null;
    const first = missing[0];
    setStep(first.step);
    return `Please fill in: ${missing.map(f => f.label).join(', ')}`;
  }

  function handleNext() {
    setValidationError('');
    const error = validateStep(step);
    if (error) {
      setValidationError(error);
      return;
    }
    setStep(step + 1);
  }

  async function handleSubmit() {
    setValidationError('');
    const error = validateForm();
    if (error) {
      setValidationError(error);
      return;
    }
    setSubmitting(true);
    try {
      const fields = buildFields('submitted');
      if (editId && originalStatus && originalStatus !== 'draft') {
        const { status: _drop, ...fieldsWithoutStatus } = fields;
        await updateApplication(editId, fieldsWithoutStatus, isInvestor);
        addNotification({
          type: 'company_update',
          title: 'Application Updated',
          message: `${form.companyName || 'A company'} updated their investment application.`,
          actor: form.founderName || currentUser?.name || 'Founder',
          actorRole: 'founder',
          targetRole: 'investor',
          link: '/applications',
        });
      } else if (editId) {
        await updateApplication(editId, fields, isInvestor);
        addNotification({
          type: 'company_update',
          title: 'Application Submitted',
          message: `${form.companyName || 'A company'} submitted an investment application.`,
          actor: form.founderName || currentUser?.name || 'Founder',
          actorRole: 'founder',
          targetRole: 'investor',
          link: '/applications',
        });
      } else {
        await createApplication(fields, isInvestor);
        addNotification({
          type: 'company_update',
          title: 'Application Submitted',
          message: `${form.companyName || 'A company'} submitted an investment application.`,
          actor: form.founderName || currentUser?.name || 'Founder',
          actorRole: 'founder',
          targetRole: 'investor',
          link: '/applications',
        });
      }

      window.dispatchEvent(new Event('notifications-updated'));
      navigate('/applications');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step renderers ────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>Company Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label="Company Name" value={form.companyName} onChange={(v) => set('companyName', v)} placeholder="Acme Inc." required />
          <TextInput label="Company Website" value={form.companyWebsite} onChange={(v) => set('companyWebsite', v)} placeholder="https://example.com" />
          <SelectInput label="Industry" value={form.companyIndustry} onChange={(v) => set('companyIndustry', v)} options={INDUSTRY_OPTIONS} required />
          <SelectInput label="Company Stage" value={form.companyStage} onChange={(v) => set('companyStage', v)} options={STAGE_OPTIONS} required />
          <TextInput label="Location" value={form.companyLocation} onChange={(v) => set('companyLocation', v)} placeholder="San Francisco, CA" />
          <TextInput label="Founded Year" value={form.foundedYear} onChange={(v) => set('foundedYear', v)} placeholder="2023" />
        </div>
        <TextareaInput label="Company Description" value={form.companyDescription} onChange={(v) => set('companyDescription', v)} placeholder="Brief description of your company..." rows={4} required />
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>Founder Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label="Full Name" value={form.founderName} onChange={(v) => set('founderName', v)} placeholder="Jane Doe" required />
          <TextInput label="Email" value={form.founderEmail} onChange={(v) => set('founderEmail', v)} placeholder="jane@company.com" type="email" required />
          <TextInput label="Phone" value={form.founderPhone} onChange={(v) => set('founderPhone', v)} placeholder="+1 (555) 000-0000" />
          <TextInput label="LinkedIn Profile" value={form.founderLinkedin} onChange={(v) => set('founderLinkedin', v)} placeholder="https://linkedin.com/in/janedoe" />
          <SelectInput label="Role" value={form.founderRole} onChange={(v) => set('founderRole', v)} options={ROLE_OPTIONS} />
        </div>
        <TextareaInput label="Co-Founders (comma separated)" value={form.coFounders} onChange={(v) => set('coFounders', v)} placeholder="John Smith (CTO), Alice Lee (COO)" rows={2} />
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>Business Overview</h3>
        <TextareaInput label="Problem Statement" value={form.problemStatement} onChange={(v) => set('problemStatement', v)} placeholder="What problem are you solving?" rows={3} required />
        <TextareaInput label="Solution" value={form.solution} onChange={(v) => set('solution', v)} placeholder="How does your product solve this problem?" rows={3} required />
        <TextareaInput label="Target Market" value={form.targetMarket} onChange={(v) => set('targetMarket', v)} placeholder="Who are your target customers? TAM/SAM/SOM?" rows={3} />
        <TextareaInput label="Business Model" value={form.businessModel} onChange={(v) => set('businessModel', v)} placeholder="How do you make money?" rows={3} />
        <TextareaInput label="Competitive Advantage" value={form.competitiveAdvantage} onChange={(v) => set('competitiveAdvantage', v)} placeholder="What sets you apart from competitors?" rows={3} />
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>Funding & Financials</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label="Funding Ask" value={form.fundingAsk} onChange={(v) => set('fundingAsk', v)} placeholder="$500,000" required />
          <TextInput label="Previous Funding" value={form.previousFunding} onChange={(v) => set('previousFunding', v)} placeholder="$100,000 (friends & family)" />
          <TextInput label="Current Valuation" value={form.currentValuation} onChange={(v) => set('currentValuation', v)} placeholder="$5,000,000" />
          <TextInput label="Equity Offered (%)" value={form.equityOffered} onChange={(v) => set('equityOffered', v)} placeholder="10%" required />
          <TextInput label="Current Revenue" value={form.currentRevenue} onChange={(v) => set('currentRevenue', v)} placeholder="$50,000" />
          <TextInput label="MRR" value={form.mrr} onChange={(v) => set('mrr', v)} placeholder="$8,000" />
          <TextInput label="ARR" value={form.arr} onChange={(v) => set('arr', v)} placeholder="$96,000" />
          <TextInput label="Monthly Burn" value={form.monthlyBurn} onChange={(v) => set('monthlyBurn', v)} placeholder="$15,000" />
          <TextInput label="Runway (months)" value={form.runway} onChange={(v) => set('runway', v)} placeholder="18" />
        </div>
        <TextareaInput label="Use of Funds" value={form.useOfFunds} onChange={(v) => set('useOfFunds', v)} placeholder="How will the investment be allocated?" rows={3} />
      </div>
    );
  }

  function renderStep5() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>Traction & Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label="Active Users" value={form.activeUsers} onChange={(v) => set('activeUsers', v)} placeholder="1,200" />
          <TextInput label="Month-over-Month Growth (%)" value={form.momGrowth} onChange={(v) => set('momGrowth', v)} placeholder="15%" />
          <TextInput label="Churn Rate (%)" value={form.churnRate} onChange={(v) => set('churnRate', v)} placeholder="3%" />
          <TextInput label="NPS Score" value={form.nps} onChange={(v) => set('nps', v)} placeholder="72" />
          <TextInput label="Key Metric Label" value={form.keyMetricLabel} onChange={(v) => set('keyMetricLabel', v)} placeholder="e.g. GMV, DAU, Transactions" />
          <TextInput label="Key Metric Value" value={form.keyMetric} onChange={(v) => set('keyMetric', v)} placeholder="$120,000" />
        </div>
      </div>
    );
  }

  function renderStep6() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>Pitch Materials</h3>

        {/* Pitch Deck Upload */}
        <div>
          <label className={labelClass}>Pitch Deck</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => pitchDeckRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {form.pitchDeckName ? 'Replace file' : 'Upload file'}
            </button>
            {form.pitchDeckName && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <File className="w-4 h-4 text-gray-400" />
                <span>{form.pitchDeckName}</span>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, pitchDeckUrl: '', pitchDeckName: '' }))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <input ref={pitchDeckRef} type="file" accept=".pdf,.pptx,.ppt,.key" className="hidden" onChange={handlePitchDeckUpload} />
        </div>

        {/* Demo Video URL */}
        <div>
          <label className={labelClass}>Demo Video URL</label>
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              value={form.demoVideoUrl}
              onChange={(e) => set('demoVideoUrl', e.target.value)}
              placeholder="YouTube, Vimeo, or Loom link"
              className={inputClass}
            />
          </div>
        </div>

        {/* Supporting Documents */}
        <div>
          <label className={labelClass}>Supporting Documents (up to 3)</label>
          <div className="space-y-2">
            {[0, 1, 2].map((idx) => {
              const doc = form.supportingDocs[idx];
              return (
                <div key={idx} className="flex items-center gap-3">
                  {doc ? (
                    <div className="flex items-center gap-2 text-sm text-gray-700 flex-1 border border-gray-200 rounded-xl px-3 py-2.5">
                      <File className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{doc.name}</span>
                      <button type="button" onClick={() => removeSupportingDoc(idx)} className="ml-auto text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => supportingDocRefs[idx]?.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload document {idx + 1}
                    </button>
                  )}
                  <input
                    ref={supportingDocRefs[idx]}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleSupportingDocUpload(idx, e)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Review step ─────────────────────────────────────────────────────────

  function ReviewSection({
    title,
    stepIndex,
    children,
  }: {
    title: string;
    stepIndex: number;
    children: React.ReactNode;
  }) {
    return (
      <div className="border border-gray-100 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className={headingClass}>{title}</h4>
          <button
            type="button"
            onClick={() => setStep(stepIndex)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">{children}</div>
      </div>
    );
  }

  function ReviewField({ label, value }: { label: string; value: string }) {
    if (!value) return null;
    return (
      <div>
        <span className="text-xs text-gray-400">{label}</span>
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{value}</p>
      </div>
    );
  }

  function renderStep7() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>Review & Submit</h3>
        <p className="text-xs text-gray-500">Review your application before submitting. Click "Edit" on any section to make changes.</p>

        <ReviewSection title="Company Information" stepIndex={0}>
          <ReviewField label="Company Name" value={form.companyName} />
          <ReviewField label="Website" value={form.companyWebsite} />
          <ReviewField label="Industry" value={form.companyIndustry} />
          <ReviewField label="Stage" value={form.companyStage} />
          <ReviewField label="Location" value={form.companyLocation} />
          <ReviewField label="Founded" value={form.foundedYear} />
          <div className="sm:col-span-2">
            <ReviewField label="Description" value={form.companyDescription} />
          </div>
        </ReviewSection>

        <ReviewSection title="Founder Details" stepIndex={1}>
          <ReviewField label="Name" value={form.founderName} />
          <ReviewField label="Email" value={form.founderEmail} />
          <ReviewField label="Phone" value={form.founderPhone} />
          <ReviewField label="LinkedIn" value={form.founderLinkedin} />
          <ReviewField label="Role" value={form.founderRole} />
          <div className="sm:col-span-2">
            <ReviewField label="Co-Founders" value={form.coFounders} />
          </div>
        </ReviewSection>

        <ReviewSection title="Business Overview" stepIndex={2}>
          <div className="sm:col-span-2 space-y-2">
            <ReviewField label="Problem Statement" value={form.problemStatement} />
            <ReviewField label="Solution" value={form.solution} />
            <ReviewField label="Target Market" value={form.targetMarket} />
            <ReviewField label="Business Model" value={form.businessModel} />
            <ReviewField label="Competitive Advantage" value={form.competitiveAdvantage} />
          </div>
        </ReviewSection>

        <ReviewSection title="Funding & Financials" stepIndex={3}>
          <ReviewField label="Funding Ask" value={form.fundingAsk} />
          <ReviewField label="Previous Funding" value={form.previousFunding} />
          <ReviewField label="Current Valuation" value={form.currentValuation} />
          <ReviewField label="Equity Offered" value={form.equityOffered} />
          <ReviewField label="Current Revenue" value={form.currentRevenue} />
          <ReviewField label="MRR" value={form.mrr} />
          <ReviewField label="ARR" value={form.arr} />
          <ReviewField label="Monthly Burn" value={form.monthlyBurn} />
          <ReviewField label="Runway" value={form.runway} />
          <div className="sm:col-span-2">
            <ReviewField label="Use of Funds" value={form.useOfFunds} />
          </div>
        </ReviewSection>

        <ReviewSection title="Traction & Metrics" stepIndex={4}>
          <ReviewField label="Active Users" value={form.activeUsers} />
          <ReviewField label="MoM Growth" value={form.momGrowth} />
          <ReviewField label="Churn Rate" value={form.churnRate} />
          <ReviewField label="NPS" value={form.nps} />
          <ReviewField label={form.keyMetricLabel || 'Key Metric'} value={form.keyMetric} />
        </ReviewSection>

        <ReviewSection title="Pitch Materials" stepIndex={5}>
          <ReviewField label="Pitch Deck" value={form.pitchDeckName} />
          <ReviewField label="Demo Video" value={form.demoVideoUrl} />
          {form.supportingDocs.length > 0 && (
            <div className="sm:col-span-2">
              <span className="text-xs text-gray-400">Supporting Documents</span>
              <ul className="text-sm text-gray-900">
                {form.supportingDocs.map((d, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <File className="w-3.5 h-3.5 text-gray-400" />
                    {d.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ReviewSection>
      </div>
    );
  }

  // ── Step renderer dispatch ──────────────────────────────────────────────

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7];

  // ── Render ──────────────────────────────────────────────────────────────

  const isLastStep = step === STEPS.length - 1;

  if (blocked) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Application Already Submitted</h2>
        <p className="text-sm text-gray-500 mb-6">
          You already have an active application. Only one application can be active at a time.
          You can track its progress on the Applications page.
        </p>
        <button
          onClick={() => navigate('/applications')}
          className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
        >
          View My Application
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">
          {editId ? 'Edit Application' : 'Investment Application'}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Complete all sections to submit your investment proposal.
        </p>
      </div>

      {/* Progress Stepper */}
      <ProgressStepper currentStep={step} onStepClick={(s) => setStep(s)} />

      {/* Form Card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        {stepRenderers[step]()}

        {/* Validation Error */}
        {validationError && (
          <div className="flex items-center gap-2 mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {validationError}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!(editId && originalStatus && originalStatus !== 'draft') && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
            )}

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : editId && originalStatus && originalStatus !== 'draft' ? 'Save Changes' : 'Submit Application'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

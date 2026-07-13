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
import { useLanguage } from '../context/LanguageContext';
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
  stepLabels,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
  stepLabels: string[];
}) {
  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;
        const Icon = step.icon;

        return (
          <React.Fragment key={idx}>
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
                {stepLabels[idx]}
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
  const { t } = useLanguage();

  const editId = searchParams.get('edit');

  const stepLabels = [
    t.applicationForm.companyInfo,
    t.applicationForm.founderDetails,
    t.applicationForm.businessOverview,
    t.applicationForm.fundingFinancials,
    t.applicationForm.tractionMetrics,
    t.applicationForm.pitchMaterials,
    t.applicationForm.reviewSubmit,
  ];

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
    return `${t.applicationForm.pleaseFillIn}: ${missing.map(f => f.label).join(', ')}`;
  }

  function validateForm(): string | null {
    const missing = REQUIRED_FIELDS.filter(f => {
      const val = form[f.key];
      return typeof val === 'string' ? !val.trim() : !val;
    });
    if (missing.length === 0) return null;
    const first = missing[0];
    setStep(first.step);
    return `${t.applicationForm.pleaseFillIn}: ${missing.map(f => f.label).join(', ')}`;
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
        <h3 className={headingClass}>{t.applicationForm.companyInformation}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label={t.applicationForm.companyName} value={form.companyName} onChange={(v) => set('companyName', v)} placeholder="Acme Inc." required />
          <TextInput label={t.applicationForm.companyWebsite} value={form.companyWebsite} onChange={(v) => set('companyWebsite', v)} placeholder="https://example.com" />
          <SelectInput label={t.applicationForm.industry} value={form.companyIndustry} onChange={(v) => set('companyIndustry', v)} options={INDUSTRY_OPTIONS} required />
          <SelectInput label={t.applicationForm.companyStage} value={form.companyStage} onChange={(v) => set('companyStage', v)} options={STAGE_OPTIONS} required />
          <TextInput label={t.applicationForm.location} value={form.companyLocation} onChange={(v) => set('companyLocation', v)} placeholder="San Francisco, CA" />
          <TextInput label={t.applicationForm.foundedYear} value={form.foundedYear} onChange={(v) => set('foundedYear', v)} placeholder="2023" />
        </div>
        <TextareaInput label={t.applicationForm.companyDescription} value={form.companyDescription} onChange={(v) => set('companyDescription', v)} placeholder="Brief description of your company..." rows={4} required />
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>{t.applicationForm.founderDetails}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label={t.applicationForm.fullName} value={form.founderName} onChange={(v) => set('founderName', v)} placeholder="Jane Doe" required />
          <TextInput label={t.applicationForm.email} value={form.founderEmail} onChange={(v) => set('founderEmail', v)} placeholder="jane@company.com" type="email" required />
          <TextInput label={t.applicationForm.phone} value={form.founderPhone} onChange={(v) => set('founderPhone', v)} placeholder="+1 (555) 000-0000" />
          <TextInput label={t.applicationForm.linkedInProfile} value={form.founderLinkedin} onChange={(v) => set('founderLinkedin', v)} placeholder="https://linkedin.com/in/janedoe" />
          <SelectInput label={t.applicationForm.role} value={form.founderRole} onChange={(v) => set('founderRole', v)} options={ROLE_OPTIONS} />
        </div>
        <TextareaInput label={t.applicationForm.coFounders} value={form.coFounders} onChange={(v) => set('coFounders', v)} placeholder="John Smith (CTO), Alice Lee (COO)" rows={2} />
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>{t.applicationForm.businessOverview}</h3>
        <TextareaInput label={t.applicationForm.problemStatement} value={form.problemStatement} onChange={(v) => set('problemStatement', v)} placeholder="What problem are you solving?" rows={3} required />
        <TextareaInput label={t.applicationForm.solution} value={form.solution} onChange={(v) => set('solution', v)} placeholder="How does your product solve this problem?" rows={3} required />
        <TextareaInput label={t.applicationForm.targetMarket} value={form.targetMarket} onChange={(v) => set('targetMarket', v)} placeholder="Who are your target customers? TAM/SAM/SOM?" rows={3} />
        <TextareaInput label={t.applicationForm.businessModel} value={form.businessModel} onChange={(v) => set('businessModel', v)} placeholder="How do you make money?" rows={3} />
        <TextareaInput label={t.applicationForm.competitiveAdvantage} value={form.competitiveAdvantage} onChange={(v) => set('competitiveAdvantage', v)} placeholder="What sets you apart from competitors?" rows={3} />
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>{t.applicationForm.fundingFinancials}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label={t.applicationForm.fundingAsk} value={form.fundingAsk} onChange={(v) => set('fundingAsk', v)} placeholder="$500,000" required />
          <TextInput label={t.applicationForm.previousFunding} value={form.previousFunding} onChange={(v) => set('previousFunding', v)} placeholder="$100,000 (friends & family)" />
          <TextInput label={t.applicationForm.currentValuation} value={form.currentValuation} onChange={(v) => set('currentValuation', v)} placeholder="$5,000,000" />
          <TextInput label={t.applicationForm.equityOffered} value={form.equityOffered} onChange={(v) => set('equityOffered', v)} placeholder="10%" required />
          <TextInput label={t.applicationForm.currentRevenue} value={form.currentRevenue} onChange={(v) => set('currentRevenue', v)} placeholder="$50,000" />
          <TextInput label={t.applicationForm.mrr} value={form.mrr} onChange={(v) => set('mrr', v)} placeholder="$8,000" />
          <TextInput label={t.applicationForm.arr} value={form.arr} onChange={(v) => set('arr', v)} placeholder="$96,000" />
          <TextInput label={t.applicationForm.monthlyBurn} value={form.monthlyBurn} onChange={(v) => set('monthlyBurn', v)} placeholder="$15,000" />
          <TextInput label={t.applicationForm.runway} value={form.runway} onChange={(v) => set('runway', v)} placeholder="18" />
        </div>
        <TextareaInput label={t.applicationForm.useOfFunds} value={form.useOfFunds} onChange={(v) => set('useOfFunds', v)} placeholder="How will the investment be allocated?" rows={3} />
      </div>
    );
  }

  function renderStep5() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>{t.applicationForm.tractionMetrics}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label={t.applicationForm.activeUsers} value={form.activeUsers} onChange={(v) => set('activeUsers', v)} placeholder="1,200" />
          <TextInput label={t.applicationForm.momGrowth} value={form.momGrowth} onChange={(v) => set('momGrowth', v)} placeholder="15%" />
          <TextInput label={t.applicationForm.churnRate} value={form.churnRate} onChange={(v) => set('churnRate', v)} placeholder="3%" />
          <TextInput label={t.applicationForm.npsScore} value={form.nps} onChange={(v) => set('nps', v)} placeholder="72" />
          <TextInput label={t.applicationForm.keyMetricLabel} value={form.keyMetricLabel} onChange={(v) => set('keyMetricLabel', v)} placeholder="e.g. GMV, DAU, Transactions" />
          <TextInput label={t.applicationForm.keyMetricValue} value={form.keyMetric} onChange={(v) => set('keyMetric', v)} placeholder="$120,000" />
        </div>
      </div>
    );
  }

  function renderStep6() {
    return (
      <div className="space-y-5">
        <h3 className={headingClass}>{t.applicationForm.pitchMaterials}</h3>

        {/* Pitch Deck Upload */}
        <div>
          <label className={labelClass}>{t.applicationForm.pitchDeck}</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => pitchDeckRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {form.pitchDeckName ? t.applicationForm.replaceFile : t.applicationForm.uploadFile}
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
          <label className={labelClass}>{t.applicationForm.demoVideoUrl}</label>
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
          <label className={labelClass}>{t.applicationForm.supportingDocuments}</label>
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
                      {t.applicationForm.uploadDocument} {idx + 1}
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
            {t.common.edit}
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
        <h3 className={headingClass}>{t.applicationForm.reviewSubmit}</h3>
        <p className="text-xs text-gray-500">{t.applicationForm.reviewDescription}</p>

        <ReviewSection title={t.applicationForm.companyInformation} stepIndex={0}>
          <ReviewField label={t.applicationForm.companyName} value={form.companyName} />
          <ReviewField label={t.applicationForm.companyWebsite} value={form.companyWebsite} />
          <ReviewField label={t.applicationForm.industry} value={form.companyIndustry} />
          <ReviewField label={t.applicationForm.companyStage} value={form.companyStage} />
          <ReviewField label={t.applicationForm.location} value={form.companyLocation} />
          <ReviewField label={t.applicationForm.foundedYear} value={form.foundedYear} />
          <div className="sm:col-span-2">
            <ReviewField label={t.applicationForm.companyDescription} value={form.companyDescription} />
          </div>
        </ReviewSection>

        <ReviewSection title={t.applicationForm.founderDetails} stepIndex={1}>
          <ReviewField label={t.applicationForm.fullName} value={form.founderName} />
          <ReviewField label={t.applicationForm.email} value={form.founderEmail} />
          <ReviewField label={t.applicationForm.phone} value={form.founderPhone} />
          <ReviewField label={t.applicationForm.linkedInProfile} value={form.founderLinkedin} />
          <ReviewField label={t.applicationForm.role} value={form.founderRole} />
          <div className="sm:col-span-2">
            <ReviewField label={t.applicationForm.coFounders} value={form.coFounders} />
          </div>
        </ReviewSection>

        <ReviewSection title={t.applicationForm.businessOverview} stepIndex={2}>
          <div className="sm:col-span-2 space-y-2">
            <ReviewField label={t.applicationForm.problemStatement} value={form.problemStatement} />
            <ReviewField label={t.applicationForm.solution} value={form.solution} />
            <ReviewField label={t.applicationForm.targetMarket} value={form.targetMarket} />
            <ReviewField label={t.applicationForm.businessModel} value={form.businessModel} />
            <ReviewField label={t.applicationForm.competitiveAdvantage} value={form.competitiveAdvantage} />
          </div>
        </ReviewSection>

        <ReviewSection title={t.applicationForm.fundingFinancials} stepIndex={3}>
          <ReviewField label={t.applicationForm.fundingAsk} value={form.fundingAsk} />
          <ReviewField label={t.applicationForm.previousFunding} value={form.previousFunding} />
          <ReviewField label={t.applicationForm.currentValuation} value={form.currentValuation} />
          <ReviewField label={t.applicationForm.equityOffered} value={form.equityOffered} />
          <ReviewField label={t.applicationForm.currentRevenue} value={form.currentRevenue} />
          <ReviewField label={t.applicationForm.mrr} value={form.mrr} />
          <ReviewField label={t.applicationForm.arr} value={form.arr} />
          <ReviewField label={t.applicationForm.monthlyBurn} value={form.monthlyBurn} />
          <ReviewField label={t.applicationForm.runway} value={form.runway} />
          <div className="sm:col-span-2">
            <ReviewField label={t.applicationForm.useOfFunds} value={form.useOfFunds} />
          </div>
        </ReviewSection>

        <ReviewSection title={t.applicationForm.tractionMetrics} stepIndex={4}>
          <ReviewField label={t.applicationForm.activeUsers} value={form.activeUsers} />
          <ReviewField label={t.applicationForm.momGrowth} value={form.momGrowth} />
          <ReviewField label={t.applicationForm.churnRate} value={form.churnRate} />
          <ReviewField label={t.applicationForm.npsScore} value={form.nps} />
          <ReviewField label={form.keyMetricLabel || 'Key Metric'} value={form.keyMetric} />
        </ReviewSection>

        <ReviewSection title={t.applicationForm.pitchMaterials} stepIndex={5}>
          <ReviewField label={t.applicationForm.pitchDeck} value={form.pitchDeckName} />
          <ReviewField label={t.applicationForm.demoVideoUrl} value={form.demoVideoUrl} />
          {form.supportingDocs.length > 0 && (
            <div className="sm:col-span-2">
              <span className="text-xs text-gray-400">{t.applicationForm.supportingDocuments}</span>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t.applicationForm.alreadySubmitted}</h2>
        <p className="text-sm text-gray-500 mb-6">
          {t.applicationForm.alreadySubmittedDesc}
        </p>
        <button
          onClick={() => navigate('/applications')}
          className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
        >
          {t.applicationForm.viewMyApplication}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">
          {editId ? t.applicationForm.editApplication : t.applicationForm.investmentApplication}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          {t.applicationForm.formDescription}
        </p>
      </div>

      {/* Progress Stepper */}
      <ProgressStepper currentStep={step} onStepClick={(s) => setStep(s)} stepLabels={stepLabels} />

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
                {t.applicationForm.previous}
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
                {saving ? t.applicationForm.savingDraft : t.applicationForm.saveAsDraft}
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
                {submitting ? t.applicationForm.submitting : editId && originalStatus && originalStatus !== 'draft' ? t.applicationForm.saveChanges : t.applicationForm.submitApplication}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                {t.common.next}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

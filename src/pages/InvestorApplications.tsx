import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Inbox, Search, Building2, Star,
  XCircle, ExternalLink,
  BarChart3, CheckCircle2,
  UserPlus, X, ChevronDown, RefreshCw, AlertCircle, LayoutGrid, List,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getApplications,
  type InvestmentApplication,
  type ApplicationStatus,
} from '../services/investmentApplications';
import {
  createCRMFounder, findContactByEmail, sendInviteEmail,
  type CRMFounderFields,
} from '../services/crmFounders';
import { cn } from '../lib/cn';
import { usePageTitle } from '../context/PageTitleContext';

import { LEAD_SOURCE_OPTIONS, SALUTATION_OPTIONS } from '../services/crmFounders';

// ─── Invite Applicant Modal ───────────────────────────────────────────────────

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent";
const selectCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent appearance-none bg-white";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

function InviteApplicantModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<CRMFounderFields>({
    salutation: '', firstName: '', lastName: '', email: '',
    secondaryEmail: '', phone: '', mobile: '', title: '',
    department: '', company: '', leadSource: '',
    mailingCity: '', mailingState: '', mailingCountry: '',
    mailingStreet: '', mailingZip: '', description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');

  const set = (key: keyof CRMFounderFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const canSave = form.lastName.trim();

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true); setError(''); setInviteStatus('');
    try {
      const displayName = [form.firstName, form.lastName].filter(Boolean).join(' ') || 'User';
      let id: string | null = null;
      setInviteStatus(t.founders.creatingContact);
      try {
        id = await createCRMFounder(form);
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        if (form.email) {
          setInviteStatus(t.founders.contactMayExist);
          id = await findContactByEmail(form.email);
        }
        if (!id) { setError(`Failed to create contact: ${msg}`); setSaving(false); return; }
      }
      let inviteFailed = false;
      if (form.email) {
        setInviteStatus(t.founders.sendingInvitation);
        try {
          const result = await sendInviteEmail(id!, form.email, displayName);
          setInviteStatus(result.message);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Contact created but invitation failed: ${msg}`);
          setInviteStatus('');
          inviteFailed = true;
        }
      }
      if (!inviteFailed) {
        await new Promise(r => setTimeout(r, 1000));
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.founders.failedToAddFounder);
      setInviteStatus('');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <UserPlus size={16} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">{t.founders.inviteApplicant}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t.founders.basicInformation}</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t.founders.salutation}>
              <div className="relative">
                <select value={form.salutation} onChange={set('salutation')} className={selectCls}>
                  <option value="">—</option>
                  {SALUTATION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </Field>
            <Field label={t.founders.firstName}>
              <input type="text" value={form.firstName} onChange={set('firstName')} placeholder="John" className={inputCls} autoFocus />
            </Field>
            <Field label={t.founders.lastName} required>
              <input type="text" value={form.lastName} onChange={set('lastName')} placeholder="Doe" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.profile.email}>
              <input type="email" value={form.email} onChange={set('email')} placeholder="john@company.com" className={inputCls} />
            </Field>
            <Field label={t.founders.secondaryEmail}>
              <input type="email" value={form.secondaryEmail} onChange={set('secondaryEmail')} placeholder="john.personal@email.com" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.profile.phone}>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98400 00000" className={inputCls} />
            </Field>
            <Field label={t.founders.mobile}>
              <input type="tel" value={form.mobile} onChange={set('mobile')} placeholder="+91 98400 00000" className={inputCls} />
            </Field>
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">{t.founders.companyDetails}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.founders.company}>
              <input type="text" value={form.company} onChange={set('company')} placeholder="Startup Inc." className={inputCls} />
            </Field>
            <Field label={t.founders.titleDesignation}>
              <input type="text" value={form.title} onChange={set('title')} placeholder="CEO & Co-founder" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.founders.leadSource}>
              <div className="relative">
                <select value={form.leadSource} onChange={set('leadSource')} className={selectCls}>
                  <option value="">{t.common.select}</option>
                  {LEAD_SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </Field>
          </div>
        </div>
        {inviteStatus && !error && (
          <div className="flex items-center gap-2 mt-3 text-sm text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2">
            <RefreshCw size={14} className={saving ? 'animate-spin' : ''} /> {inviteStatus}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
            {t.common.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <UserPlus size={14} /> {saving ? t.founders.adding : t.founders.inviteApplicant}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function createRelativeTime(t: { activities: { justNow: string; minutesAgo: string; hoursAgo: string; yesterday: string; daysAgo: string } }, language: string) {
  return function relativeTime(iso: string): string {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return t.activities.justNow;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t.activities.minutesAgo.replace('{n}', String(minutes));
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t.activities.hoursAgo.replace('{n}', String(hours));
    const days = Math.floor(hours / 24);
    if (days === 1) return t.activities.yesterday;
    if (days < 7) return t.activities.daysAgo.replace('{n}', String(days));
    return new Date(iso).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' });
  };
}

// ─── Status & stage styling ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
  draft:                { label: 'Draft',              color: 'text-gray-600',    bg: 'bg-gray-100' },
  submitted:            { label: 'Submitted',          color: 'text-blue-600',    bg: 'bg-blue-50' },
  under_review:         { label: 'Under Review',       color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  interested:           { label: 'Interested',         color: 'text-emerald-600', bg: 'bg-emerald-50' },
  more_info_requested:  { label: 'More Info',          color: 'text-amber-600',   bg: 'bg-amber-50' },
  documents_requested:  { label: 'Docs Requested',     color: 'text-yellow-600',  bg: 'bg-yellow-50' },
  shortlisted:          { label: 'Shortlisted',        color: 'text-purple-600',  bg: 'bg-purple-50' },
  meeting_scheduled:    { label: 'Meeting',            color: 'text-violet-600',  bg: 'bg-violet-50' },
  due_diligence:        { label: 'Due Diligence',      color: 'text-orange-600',  bg: 'bg-orange-50' },
  on_hold:              { label: 'On Hold',            color: 'text-slate-600',   bg: 'bg-slate-100' },
  approved:             { label: 'Approved',           color: 'text-green-600',   bg: 'bg-green-50' },
  invested:             { label: 'Invested',           color: 'text-green-700',   bg: 'bg-green-100' },
  rejected:             { label: 'Rejected',           color: 'text-red-600',     bg: 'bg-red-50' },
};

const STAGE_COLORS: Record<string, { color: string; bg: string }> = {
  Idea:        { color: 'text-gray-600',    bg: 'bg-gray-100' },
  'Pre-Seed':  { color: 'text-sky-600',     bg: 'bg-sky-50' },
  Seed:        { color: 'text-blue-600',    bg: 'bg-blue-50' },
  'Series A':  { color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  'Series B':  { color: 'text-violet-600',  bg: 'bg-violet-50' },
  'Series C':  { color: 'text-purple-600',  bg: 'bg-purple-50' },
  Growth:      { color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { t } = useLanguage();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  const statusLabels: Record<string, string> = {
    draft: t.applicationTracker.statusDraft,
    submitted: t.applicationTracker.statusSubmitted,
    under_review: t.applicationTracker.statusUnderReview,
    interested: t.applicationTracker.statusInterested,
    more_info_requested: t.applicationTracker.statusMoreInfo,
    documents_requested: t.applicationTracker.statusDocsRequested,
    shortlisted: t.applicationTracker.statusShortlisted,
    meeting_scheduled: t.applicationTracker.statusMeeting,
    due_diligence: t.applicationTracker.statusDueDiligence,
    on_hold: t.applicationTracker.statusOnHold,
    approved: t.applicationTracker.statusApproved,
    invested: t.applicationTracker.statusInvested,
    rejected: t.applicationTracker.statusRejected,
  };
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      {statusLabels[status] || cfg.label}
    </span>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_COLORS[stage] ?? { color: 'text-gray-600', bg: 'bg-gray-100' };
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      {stage || 'Unknown'}
    </span>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | ApplicationStatus;

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',               label: 'All' },
  { id: 'submitted',         label: 'Submitted' },
  { id: 'under_review',      label: 'Under Review' },
  { id: 'shortlisted',       label: 'Shortlisted' },
  { id: 'meeting_scheduled', label: 'Meeting' },
  { id: 'on_hold',           label: 'On Hold' },
  { id: 'approved',          label: 'Approved' },
  { id: 'rejected',          label: 'Rejected' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvestorApplications() {
  const { isInvestor } = useAuth();
  const { t, language } = useLanguage();
  const { setPageTitle } = usePageTitle();
  const relativeTime = createRelativeTime(t, language);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get('view') as 'grid' | 'list') || 'list';
  const setView = (v: 'grid' | 'list') =>
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('view', v); return p; });
  const [applications, setApplications] = useState<InvestmentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showInvite, setShowInvite] = useState(false);

  const filterLabels: Record<string, string> = {
    all: t.investorApplications.all,
    submitted: t.investorApplications.submitted,
    under_review: t.investorApplications.underReview,
    shortlisted: t.investorApplications.shortlisted,
    meeting_scheduled: t.investorApplications.meeting,
    on_hold: t.investorApplications.onHold,
    approved: t.investorApplications.approved,
    rejected: t.investorApplications.rejected,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getApplications(isInvestor);
      setApplications(all.filter(a => a.status !== 'draft'));
    } catch { /* ignore */ }
    setLoading(false);
  }, [isInvestor]);

  useEffect(() => { setPageTitle(t.nav.applications, t.applications.title); return () => setPageTitle(null); }, [t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => setShowInvite(true);
    window.addEventListener('open-invite-applicant', handler);
    return () => window.removeEventListener('open-invite-applicant', handler);
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = applications.filter(app => {
    // Status filter
    if (activeTab !== 'all' && app.status !== activeTab) return false;
    // Search filter
    if (query) {
      const q = query.toLowerCase();
      return (
        app.companyName.toLowerCase().includes(q) ||
        app.companyIndustry.toLowerCase().includes(q) ||
        app.founderName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = [
    { label: t.investorApplications.total,       value: applications.length,                                                                                             icon: BarChart3,    color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: t.investorApplications.shortlisted, value: applications.filter(a => a.status === 'shortlisted').length,                                                     icon: Star,         color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: t.investorApplications.approved,    value: applications.filter(a => a.status === 'approved' || a.status === 'invested').length,                              icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50' },
    { label: t.investorApplications.rejected,    value: applications.filter(a => a.status === 'rejected').length,                                                        icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50' },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {showInvite && <InviteApplicantModal onClose={() => setShowInvite(false)} />}
      {/* Search + Filter Tabs */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t.investorApplications.searchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {filterLabels[tab.id] || tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', stat.bg)}>
                  <Icon size={14} className={stat.color} />
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">
          {t.nav.applications}
          <span className="ml-2 text-xs font-medium text-gray-400">{filtered.length}</span>
        </h2>
        <div className="hidden sm:flex items-center border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => setView('grid')} className={`p-2 transition-colors ${view === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`} title="Grid view">
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setView('list')} className={`p-2 transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`} title="List view">
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
          <Inbox size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">{t.common.noResults}</p>
          <p className="text-xs text-gray-400">{t.applications.title}</p>
        </div>
      )}

      {/* Application Cards */}
      {!loading && filtered.length > 0 && (
        view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(app => (
              <div
                key={app.id}
                className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-all cursor-pointer flex flex-col gap-3"
                onClick={() => navigate(`/applications/${app.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    <Building2 size={15} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{app.companyName || t.investorApplications.untitled}</p>
                    <p className="text-xs text-gray-500 truncate">{app.companyIndustry || t.investorApplications.noIndustry}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StageBadge stage={app.companyStage} />
                  <StatusBadge status={app.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{app.founderName || '—'}</span>
                  {app.fundingAsk && (
                    <span className="font-semibold text-gray-700">{formatCurrency(parseFloat(app.fundingAsk))}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(app => (
              <div
                key={app.id}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-all cursor-pointer"
                onClick={() => navigate(`/applications/${app.id}`)}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    <Building2 size={16} className="text-gray-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{app.companyName || t.investorApplications.untitled}</p>
                      <StageBadge stage={app.companyStage} />
                      <StatusBadge status={app.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{app.companyIndustry || t.investorApplications.noIndustry}</span>
                      {app.companyLocation && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>{app.companyLocation}</span>
                        </>
                      )}
                      {app.founderName && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>{app.founderName}</span>
                        </>
                      )}
                      {app.founderEmail && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="truncate">{app.founderEmail}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    {app.fundingAsk && (
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(parseFloat(app.fundingAsk))}
                      </span>
                    )}
                    {app.submittedAt && (
                      <span className="text-xs text-gray-400 hidden sm:inline">{relativeTime(app.submittedAt)}</span>
                    )}
                    <ExternalLink size={14} className="text-gray-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

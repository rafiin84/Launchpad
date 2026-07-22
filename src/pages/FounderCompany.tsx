import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, Globe, MapPin, Users, DollarSign, TrendingUp,
  Lightbulb, Target, Edit3, Check, X, ExternalLink,
  Calendar, Shield, Loader2, CheckCircle, AlertCircle, Camera,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { addNotification } from '../services/notifications';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageTitle } from '../context/PageTitleContext';
import {
  type CompanyData, EMPTY,
  fetchCompanyProfile, fetchAllCompanyProfiles, saveCompanyProfile,
  uploadCompanyLogo,
} from '../services/companyProfile';

const STAGES = ['Idea', 'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth', 'Profitable'];
const INDUSTRIES = ['SaaS', 'Fintech', 'Healthtech', 'Edtech', 'E-commerce', 'Marketplace', 'AI/ML', 'Hardware', 'Deep Tech', 'Consumer', 'Enterprise', 'Other'];

// ─── Field components ─────────────────────────────────────────────────────────

function DisplayField({ label, value, href }: { label: string; value: string; href?: string }) {
  const { t } = useLanguage();
  if (!value) return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-300 italic">{t.common.notSet}</p>
    </div>
  );
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          {value} <ExternalLink size={11} />
        </a>
      ) : (
        <p className="text-sm text-gray-900 leading-relaxed">{value}</p>
      )}
    </div>
  );
}

function EditField({ label, field, value, onChange, type = 'text', options, placeholder, multiline }: {
  label: string; field: string; value: string;
  onChange: (field: string, val: string) => void;
  type?: string; options?: string[]; placeholder?: string; multiline?: boolean;
}) {
  if (options) return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(field, e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      >
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  if (multiline) return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(field, e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
      />
    </div>
  );
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, editing, accent, iconColor = 'text-indigo-500', iconBg = 'bg-indigo-50' }: {
  title: string; icon: React.ElementType; children: React.ReactNode; editing: boolean; accent?: boolean;
  iconColor?: string; iconBg?: string;
}) {
  return (
    <div className={cn(
      'rounded-2xl border p-6 shadow-sm',
      accent ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100' : 'bg-white border-gray-100'
    )}>
      <div className="flex items-center gap-3 mb-5">
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', accent ? 'bg-indigo-100' : iconBg)}>
          <Icon size={15} className={accent ? 'text-indigo-600' : iconColor} />
        </div>
        <h2 className={cn('text-sm font-bold', accent ? 'text-indigo-900' : 'text-gray-900')}>{title}</h2>
      </div>
      <div className={cn('grid gap-4', editing ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FounderCompany() {
  const { t } = useLanguage();
  const { setPageTitle } = usePageTitle();
  const { coverImage, currentUser, isInvestor, zohoEmail, portalSession } = useAuth();
  const [searchParams] = useSearchParams();
  const queryEmail = searchParams.get('email');
  const userEmail = zohoEmail || portalSession?.email || currentUser.email || '';
  const [data, setData]       = useState<CompanyData>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<CompanyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'partial' | 'error' | null>(null);
  const [allProfiles, setAllProfiles] = useState<Array<{ email: string; data: CompanyData; logo: string | null }>>([]);
  const [selectedProfile, setSelectedProfile] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPageTitle(t.nav.company); return () => setPageTitle(null); }, [t]);
  useEffect(() => { setLogoError(false); }, [logoUrl]);

  useEffect(() => {
    setLoading(true);
    const targetEmail = isInvestor && queryEmail ? queryEmail : userEmail;
    if (isInvestor && !queryEmail) {
      fetchAllCompanyProfiles()
        .then(profiles => {
          setAllProfiles(profiles);
          if (profiles.length > 0) {
            setData(profiles[0].data);
            setLogoUrl(profiles[0].logo);
          }
        })
        .finally(() => setLoading(false));
    } else if (targetEmail) {
      fetchCompanyProfile(targetEmail).then(result => {
        setData(result.data);
        setLogoUrl(result.logo);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [userEmail, isInvestor, queryEmail]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setLogoUrl(dataUrl);
      await uploadCompanyLogo(userEmail, dataUrl);
      setUploadingLogo(false);
    };
    reader.onerror = () => setUploadingLogo(false);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  useEffect(() => {
    if (editing) setDraft({ ...data });
  }, [editing]);

  function handleChange(field: string, val: string) {
    setDraft(prev => ({ ...prev, [field]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    try {
      const result = await saveCompanyProfile(userEmail, draft);
      setData(draft);
      setEditing(false);
      setSaveResult(result.crmSynced ? 'success' : 'partial');
      setTimeout(() => setSaveResult(null), 5000);
      // Notify the other party that the company profile changed.
      addNotification({
        type: 'company_update',
        title: 'Company Profile Updated',
        message: `${draft.name || 'A company'} updated their company profile.`,
        actor: currentUser?.name || draft.name || 'Founder',
        actorRole: isInvestor ? 'investor' : 'founder',
        targetRole: isInvestor ? 'founder' : 'investor',
        link: '/company',
      });
      window.dispatchEvent(new Event('notifications-updated'));
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(data);
    setEditing(false);
  }

  function selectInvestorProfile(idx: number) {
    setSelectedProfile(idx);
    if (allProfiles[idx]) {
      setData(allProfiles[idx].data);
      setLogoUrl(allProfiles[idx].logo);
    }
  }

  const d = editing ? draft : data;
  const hasData = !!data.name;

  function fmt(val: string, prefix = '$') {
    const n = parseFloat(val.replace(/,/g, ''));
    if (isNaN(n) || n === 0) return '—';
    if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${prefix}${(n / 1_000).toFixed(0)}K`;
    return `${prefix}${n}`;
  }

  return (
    <div className="w-full">

      {/* ── Hero Banner ── */}
      <div className="relative w-full h-44 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 overflow-hidden">
        {/* Cover image or subtle texture overlay */}
        {coverImage ? (
          <>
            <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
          </>
        ) : (
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 50%), radial-gradient(circle at 80% 20%, #a855f7 0%, transparent 40%)' }}
          />
        )}

        <div className="relative h-full flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-8 pt-4 sm:pt-0 gap-3 sm:gap-0">
          {/* Left: logo + name + tagline */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex-shrink-0 shadow-lg shadow-indigo-900/40 relative group/logo overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-600">
              {logoUrl && !logoError ? (
                <img src={logoUrl} alt={d.name || 'Logo'} className="w-full h-full object-cover rounded-2xl" onError={() => setLogoError(true)} />
              ) : (
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center">
                  <Building2 size={28} className="text-white" />
                </div>
              )}
              {!isInvestor && editing && (
                <>
                  <button
                    type="button"
                    onClick={() => logoFileRef.current?.click()}
                    disabled={uploadingLogo}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer rounded-2xl"
                  >
                    {uploadingLogo
                      ? <Loader2 size={20} className="text-white animate-spin" />
                      : <Camera size={20} className="text-white" />}
                  </button>
                  <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">
                {d.name || t.companyProfile.yourCompany}
              </h1>
              <p className="text-xs sm:text-sm text-white/60 mt-0.5 max-w-md leading-relaxed line-clamp-2">
                {d.tagline || t.companyProfile.addTagline}
              </p>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center pb-3 sm:pb-0">
            {!isInvestor && (
              editing ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-sm text-white/80 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 rounded-xl hover:bg-white/20 transition-all disabled:opacity-50"
                  >
                    <X size={14} /> {t.common.cancel}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-sm font-semibold text-white bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-xl hover:bg-white/25 transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {saving ? `${t.common.loading}` : t.common.save}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 rounded-xl hover:bg-white/20 transition-all"
                >
                  <Edit3 size={14} /> {t.companyProfile.editProfile}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Meta strip ── */}
      <div className="bg-white border-b border-gray-100 px-6 sm:px-8 py-3 flex items-center gap-3 flex-wrap">
        {data.stage && (
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">
            {data.stage}
          </span>
        )}
        {data.industry && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
            {data.industry}
          </span>
        )}
        {data.foundedYear && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar size={11} /> Est. {data.foundedYear}
          </span>
        )}
        {data.location && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <MapPin size={11} /> {data.location}
          </span>
        )}
        {data.website && (
          <a
            href={data.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-500 flex items-center gap-1 hover:underline"
          >
            <Globe size={11} /> {data.website.replace(/https?:\/\//, '')}
          </a>
        )}
      </div>

      {/* ── Page body ── */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
            <span className="ml-3 text-sm text-gray-500">{t.common.loading}</span>
          </div>
        )}

        {/* Save result banners */}
        {saveResult === 'success' && (
          <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle size={16} className="flex-shrink-0" />
            {t.companySidebar.savedAndSynced}
          </div>
        )}
        {saveResult === 'partial' && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700 flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            {t.companySidebar.savedLocally}
          </div>
        )}
        {saveResult === 'error' && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            {t.companySidebar.saveFailed}
          </div>
        )}

        {/* Investor: profile selector when multiple founders exist */}
        {isInvestor && allProfiles.length > 1 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            {allProfiles.map((p, i) => (
              <button
                key={p.email}
                onClick={() => selectInvestorProfile(i)}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
                  selectedProfile === i
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                )}
              >
                {p.data.name || p.email}
              </button>
            ))}
          </div>
        )}

        {/* Empty state banner */}
        {!loading && !hasData && !editing && !isInvestor && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
            <Lightbulb size={16} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">{t.companyProfile.completePrompt}</p>
              <p className="text-xs text-amber-600 mt-0.5">{t.companyProfile.completePromptDesc}</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              {t.companyProfile.getStarted}
            </button>
          </div>
        )}
        {!loading && !hasData && isInvestor && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
            <Building2 size={16} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">{t.companySidebar.noCompanyProfile}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.companySidebar.noCompanyProfileDesc}</p>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">

          {/* Left: main sections */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* ── Overview ── */}
            <Section title={t.companyProfile.companyOverview} icon={Building2} editing={editing} iconColor="text-indigo-500" iconBg="bg-indigo-50">
              {editing ? (
                <>
                  <EditField label={t.applicationForm.companyName} field="name" value={d.name} onChange={handleChange} placeholder="Acme Inc" />
                  <EditField label="Tagline" field="tagline" value={d.tagline} onChange={handleChange} placeholder="One-liner about your company" />
                  <EditField label={t.companyProfile.website} field="website" value={d.website} onChange={handleChange} placeholder="https://yourcompany.com" />
                  <EditField label={t.companyProfile.industry} field="industry" value={d.industry} onChange={handleChange} options={INDUSTRIES} />
                  <EditField label={t.companyProfile.stage} field="stage" value={d.stage} onChange={handleChange} options={STAGES} />
                  <EditField label={t.companyProfile.founded} field="foundedYear" value={d.foundedYear} onChange={handleChange} placeholder="2022" />
                  <EditField label="Location / HQ" field="location" value={d.location} onChange={handleChange} placeholder="San Francisco, CA" />
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.description} field="description" value={d.description} onChange={handleChange}
                      placeholder="Describe what your company does, the problem you solve, and who you serve…" multiline />
                  </div>
                </>
              ) : (
                <>
                  <DisplayField label={t.companyProfile.website} value={d.website} href={d.website} />
                  <DisplayField label={t.companyProfile.industry} value={d.industry} />
                  <DisplayField label={t.companyProfile.stage} value={d.stage} />
                  <DisplayField label={t.companyProfile.founded} value={d.foundedYear} />
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.description} value={d.description} />
                  </div>
                </>
              )}
            </Section>

            {/* ── Team ── */}
            <Section title={t.companyProfile.foundingTeam} icon={Users} editing={editing} iconColor="text-amber-500" iconBg="bg-amber-50">
              {editing ? (
                <>
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.founders} field="founderNames" value={d.founderNames} onChange={handleChange} placeholder="e.g. Alice Smith (CEO), Bob Jones (CTO)" />
                  </div>
                  <EditField label={t.companyProfile.teamSize} field="teamSize" value={d.teamSize} onChange={handleChange} placeholder="12" />
                  <EditField label={t.companyProfile.openRoles} field="openRoles" value={d.openRoles} onChange={handleChange} placeholder="e.g. Senior Engineer, Head of Sales" />
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.founders} value={d.founderNames} />
                  </div>
                  <DisplayField label={t.companyProfile.teamSize} value={d.teamSize ? `${d.teamSize} people` : ''} />
                  <DisplayField label={t.companyProfile.openRoles} value={d.openRoles} />
                </>
              )}
            </Section>

            {/* ── Product & Traction ── */}
            <Section title={t.companyProfile.productTraction} icon={TrendingUp} editing={editing} iconColor="text-emerald-500" iconBg="bg-emerald-50">
              {editing ? (
                <>
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.product} field="productDescription" value={d.productDescription} onChange={handleChange}
                      placeholder="What does your product do? Who is it for? What's the core value?" multiline />
                  </div>
                  <EditField label="MRR ($)" field="mrr" value={d.mrr} onChange={handleChange} placeholder="50,000" />
                  <EditField label="ARR ($)" field="arr" value={d.arr} onChange={handleChange} placeholder="600,000" />
                  <EditField label={t.companySidebar.activeCustomers} field="activeCustomers" value={d.activeCustomers} onChange={handleChange} placeholder="250" />
                  <EditField label={`${t.companySidebar.momGrowth} (%)`} field="momGrowth" value={d.momGrowth} onChange={handleChange} placeholder="12" />
                  <EditField label={t.companyProfile.monthlyChurn} field="churnRate" value={d.churnRate} onChange={handleChange} placeholder="2.5" />
                  <EditField label={t.companyProfile.nps} field="nps" value={d.nps} onChange={handleChange} placeholder="72" />
                  <EditField label="Key Metric Value" field="keyMetric" value={d.keyMetric} onChange={handleChange} placeholder="4.2M" />
                  <EditField label="Key Metric Label" field="keyMetricLabel" value={d.keyMetricLabel} onChange={handleChange} placeholder="API calls / month" />
                </>
              ) : (
                <>
                  {/* Traction stat chips */}
                  {(d.mrr || d.arr || d.activeCustomers || d.momGrowth) && (
                    <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-1">
                      {d.mrr && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-emerald-700">{fmt(d.mrr)}</p>
                          <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide mt-0.5">{t.companySidebar.mrr}</p>
                        </div>
                      )}
                      {d.arr && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-indigo-700">{fmt(d.arr)}</p>
                          <p className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide mt-0.5">{t.companySidebar.arr}</p>
                        </div>
                      )}
                      {d.activeCustomers && (
                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-purple-700">{d.activeCustomers}</p>
                          <p className="text-[10px] font-medium text-purple-500 uppercase tracking-wide mt-0.5">{t.companySidebar.customers}</p>
                        </div>
                      )}
                      {d.momGrowth && (
                        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-teal-700">{d.momGrowth}%</p>
                          <p className="text-[10px] font-medium text-teal-500 uppercase tracking-wide mt-0.5">{t.companySidebar.momGrowth}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.product} value={d.productDescription} />
                  </div>
                  <DisplayField label={t.companyProfile.monthlyChurn} value={d.churnRate ? `${d.churnRate}%` : ''} />
                  <DisplayField label={t.companyProfile.nps} value={d.nps} />
                  {d.keyMetric && <DisplayField label={d.keyMetricLabel || 'Key Metric'} value={d.keyMetric} />}
                </>
              )}
            </Section>

            {/* ── Financials ── */}
            <Section title={t.companyProfile.financialsFunding} icon={DollarSign} editing={editing} iconColor="text-green-600" iconBg="bg-green-50">
              {editing ? (
                <>
                  <EditField label={`${t.companyProfile.totalRaised} ($)`} field="totalRaised" value={d.totalRaised} onChange={handleChange} placeholder="2,500,000" />
                  <EditField label={`${t.companyProfile.lastRound} Size ($)`} field="lastRoundSize" value={d.lastRoundSize} onChange={handleChange} placeholder="2,000,000" />
                  <EditField label={`${t.companyProfile.lastRound} Stage`} field="lastRoundStage" value={d.lastRoundStage} onChange={handleChange} options={STAGES} />
                  <EditField label={`${t.companyProfile.lastRound} Date`} field="lastRoundDate" value={d.lastRoundDate} onChange={handleChange} type="month" />
                  <EditField label={`${t.companyProfile.preMoneyValuation} ($)`} field="preMoneyValuation" value={d.preMoneyValuation} onChange={handleChange} placeholder="10,000,000" />
                  <EditField label={`${t.companyProfile.monthlyBurn} ($)`} field="monthlyBurn" value={d.monthlyBurn} onChange={handleChange} placeholder="120,000" />
                  <EditField label={t.companyProfile.runway} field="runway" value={d.runway} onChange={handleChange} placeholder="18" />
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.revenueModel} field="revenueModel" value={d.revenueModel} onChange={handleChange}
                      placeholder="e.g. SaaS subscription — $99/mo per seat, enterprise contracts from $5K/mo" multiline />
                  </div>
                </>
              ) : (
                <>
                  <DisplayField label={t.companyProfile.totalRaised} value={d.totalRaised ? `$${d.totalRaised}` : ''} />
                  <DisplayField label={t.companyProfile.lastRound} value={d.lastRoundStage && d.lastRoundSize ? `${d.lastRoundStage} · $${d.lastRoundSize}` : (d.lastRoundSize || '')} />
                  <DisplayField label={t.companyProfile.preMoneyValuation} value={d.preMoneyValuation ? `$${d.preMoneyValuation}` : ''} />
                  <DisplayField label={t.companyProfile.monthlyBurn} value={d.monthlyBurn ? `$${d.monthlyBurn}` : ''} />
                  <DisplayField label={t.companyProfile.runway} value={d.runway ? `${d.runway} months` : ''} />
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.revenueModel} value={d.revenueModel} />
                  </div>
                </>
              )}
            </Section>

            {/* ── Market ── */}
            <Section title={t.companyProfile.marketCompetition} icon={Target} editing={editing} iconColor="text-violet-500" iconBg="bg-violet-50">
              {editing ? (
                <>
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.targetMarket} field="targetMarket" value={d.targetMarket} onChange={handleChange}
                      placeholder="Who is your ideal customer? Industry, company size, geography…" multiline />
                  </div>
                  <EditField label={`${t.companyProfile.tam} ($)`} field="tam" value={d.tam} onChange={handleChange} placeholder="50B" />
                  <EditField label={`${t.companyProfile.sam} ($)`} field="sam" value={d.sam} onChange={handleChange} placeholder="5B" />
                  <EditField label={`${t.companyProfile.som} ($)`} field="som" value={d.som} onChange={handleChange} placeholder="500M" />
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.competitors} field="keyCompetitors" value={d.keyCompetitors} onChange={handleChange}
                      placeholder="List your main competitors and how you compare" multiline />
                  </div>
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.moat} field="differentiator" value={d.differentiator} onChange={handleChange}
                      placeholder="What makes you unique and hard to copy?" multiline />
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.targetMarket} value={d.targetMarket} />
                  </div>
                  <DisplayField label={t.companyProfile.tam} value={d.tam} />
                  <DisplayField label={t.companyProfile.sam} value={d.sam} />
                  <DisplayField label={t.companyProfile.som} value={d.som} />
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.competitors} value={d.keyCompetitors} />
                  </div>
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.moat} value={d.differentiator} />
                  </div>
                </>
              )}
            </Section>

            {/* ── Investor Relations ── */}
            <Section title={t.companyProfile.currentRound} icon={Shield} editing={editing} accent>
              {editing ? (
                <>
                  <EditField label={`${t.companyProfile.currentAsk} ($)`} field="currentAsk" value={d.currentAsk} onChange={handleChange} placeholder="3,000,000" />
                  <EditField label={t.companyProfile.runway} field="runway" value={d.runway} onChange={handleChange} placeholder="24" />
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.useOfFunds} field="useOfFunds" value={d.useOfFunds} onChange={handleChange}
                      placeholder="e.g. 50% engineering hires, 30% sales & marketing, 20% infrastructure" multiline />
                  </div>
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.milestones12Month} field="nextMilestones" value={d.nextMilestones} onChange={handleChange}
                      placeholder="e.g. Reach $1M ARR, launch enterprise tier, hire 3 engineers" multiline />
                  </div>
                  <div className="sm:col-span-2">
                    <EditField label={t.companyProfile.keyRisks} field="keyRisks" value={d.keyRisks} onChange={handleChange}
                      placeholder="What are the biggest risks to the business and how are you mitigating them?" multiline />
                  </div>
                </>
              ) : (
                <>
                  <DisplayField label={t.companyProfile.currentAsk} value={d.currentAsk ? `$${d.currentAsk}` : ''} />
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.useOfFunds} value={d.useOfFunds} />
                  </div>
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.milestones12Month} value={d.nextMilestones} />
                  </div>
                  <div className="sm:col-span-2">
                    <DisplayField label={t.companyProfile.keyRisks} value={d.keyRisks} />
                  </div>
                </>
              )}
            </Section>

          </div>

          {/* Right sidebar */}
          <div className="w-72 flex-shrink-0 space-y-4 hidden lg:block sticky top-6">

            {/* Key Metrics */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp size={13} className="text-emerald-500" />
                </div>
                {t.companySidebar.keyMetrics}
              </h3>
              <div className="space-y-3">
                {[
                  { label: t.companySidebar.mrr,              value: fmt(data.mrr) },
                  { label: t.companySidebar.arr,              value: fmt(data.arr) },
                  { label: t.companySidebar.activeCustomers,  value: data.activeCustomers || '—' },
                  { label: t.companySidebar.momGrowth,        value: data.momGrowth ? `${data.momGrowth}%` : '—' },
                  { label: t.companyProfile.monthlyChurn,  value: data.churnRate ? `${data.churnRate}%` : '—' },
                  { label: t.companyProfile.nps,           value: data.nps || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-sm font-bold text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Funding snapshot */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-green-50 flex items-center justify-center">
                  <DollarSign size={13} className="text-green-600" />
                </div>
                {t.companySidebar.fundingSnapshot}
              </h3>
              <div className="space-y-3">
                {[
                  { label: t.companyProfile.totalRaised,        value: fmt(data.totalRaised) },
                  { label: t.companyProfile.lastRound,         value: data.lastRoundStage || '—' },
                  { label: t.companyProfile.preMoneyValuation, value: fmt(data.preMoneyValuation) },
                  { label: t.companyProfile.monthlyBurn,       value: fmt(data.monthlyBurn) },
                  { label: t.companyProfile.runway,            value: data.runway ? `${data.runway} mo` : '—' },
                  { label: t.companyProfile.currentAsk,        value: fmt(data.currentAsk) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-sm font-bold text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
              {data.runway && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>{t.companyProfile.runway}</span>
                    <span className={parseInt(data.runway) >= 12 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                      {data.runway} mo
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', parseInt(data.runway) >= 12 ? 'bg-emerald-400' : 'bg-amber-400')}
                      style={{ width: `${Math.min(100, (parseInt(data.runway) / 24) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Market size */}
            {(data.tam || data.sam || data.som) && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Target size={13} className="text-violet-500" />
                  </div>
                  {t.companySidebar.marketSize}
                </h3>
                <div className="space-y-3">
                  {[
                    { label: t.companyProfile.tam, value: data.tam, color: 'bg-violet-500', width: '100%' },
                    { label: t.companyProfile.sam, value: data.sam, color: 'bg-indigo-400', width: '60%' },
                    { label: t.companyProfile.som, value: data.som, color: 'bg-blue-300',   width: '25%' },
                  ].map(({ label, value, color, width }) => value ? (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-gray-700">{label}</span>
                        <span className="text-gray-500">{value}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width }} />
                      </div>
                    </div>
                  ) : null)}
                </div>
              </div>
            )}

            {/* Team card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Users size={13} className="text-amber-500" />
                </div>
                {t.companySidebar.team}
              </h3>
              <div className="space-y-2.5">
                {data.founderNames ? (
                  data.founderNames.split(',').map((name, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[10px] font-bold">{name.trim().charAt(0)}</span>
                      </div>
                      <p className="text-xs text-gray-700 font-medium leading-snug">{name.trim()}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic">{t.common.notSet}</p>
                )}
                {data.teamSize && (
                  <div className="pt-2 mt-2 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{t.companySidebar.totalTeam}</span>
                    <span className="text-sm font-bold text-gray-900">{data.teamSize} {t.companySidebar.people}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Next milestones */}
            {data.nextMilestones && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Calendar size={13} className="text-indigo-500" />
                  </div>
                  {t.companySidebar.nextMilestones}
                </h3>
                <p className="text-xs text-indigo-800 leading-relaxed">{data.nextMilestones}</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

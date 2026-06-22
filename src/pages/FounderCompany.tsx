import React, { useState, useEffect } from 'react';
import {
  Building2, Globe, MapPin, Users, DollarSign, TrendingUp,
  Lightbulb, Target, Edit3, Check, X, ExternalLink,
  Calendar, Shield,
} from 'lucide-react';
import { cn } from '../lib/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyData {
  // Overview
  name: string;
  tagline: string;
  description: string;
  website: string;
  industry: string;
  stage: string;
  foundedYear: string;
  location: string;
  // Team
  founderNames: string;
  teamSize: string;
  openRoles: string;
  // Product & Traction
  productDescription: string;
  mrr: string;
  arr: string;
  activeCustomers: string;
  momGrowth: string;
  churnRate: string;
  nps: string;
  keyMetric: string;
  keyMetricLabel: string;
  // Financials
  totalRaised: string;
  lastRoundSize: string;
  lastRoundStage: string;
  lastRoundDate: string;
  preMoneyValuation: string;
  monthlyBurn: string;
  runway: string;
  revenueModel: string;
  // Market
  tam: string;
  sam: string;
  som: string;
  targetMarket: string;
  keyCompetitors: string;
  differentiator: string;
  // Investor relations
  currentAsk: string;
  useOfFunds: string;
  keyRisks: string;
  nextMilestones: string;
}

const EMPTY: CompanyData = {
  name: '', tagline: '', description: '', website: '', industry: '', stage: '', foundedYear: '', location: '',
  founderNames: '', teamSize: '', openRoles: '',
  productDescription: '', mrr: '', arr: '', activeCustomers: '', momGrowth: '', churnRate: '', nps: '', keyMetric: '', keyMetricLabel: '',
  totalRaised: '', lastRoundSize: '', lastRoundStage: '', lastRoundDate: '', preMoneyValuation: '', monthlyBurn: '', runway: '', revenueModel: '',
  tam: '', sam: '', som: '', targetMarket: '', keyCompetitors: '', differentiator: '',
  currentAsk: '', useOfFunds: '', keyRisks: '', nextMilestones: '',
};

const STORAGE_KEY = 'lp_founder_company';

function load(): CompanyData {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return { ...EMPTY, ...JSON.parse(s) };
  } catch { /* ignore */ }
  // Start with empty company data — founders fill in their own
  return EMPTY;
}

function save(d: CompanyData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

const STAGES = ['Idea', 'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth', 'Profitable'];
const INDUSTRIES = ['SaaS', 'Fintech', 'Healthtech', 'Edtech', 'E-commerce', 'Marketplace', 'AI/ML', 'Hardware', 'Deep Tech', 'Consumer', 'Enterprise', 'Other'];

// ─── Field components ─────────────────────────────────────────────────────────

function DisplayField({ label, value, href }: { label: string; value: string; href?: string }) {
  if (!value) return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-300 italic">Not set</p>
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
  const [data, setData]       = useState<CompanyData>(load);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<CompanyData>(data);

  useEffect(() => {
    if (editing) setDraft({ ...data });
  }, [editing]);

  function handleChange(field: string, val: string) {
    setDraft(prev => ({ ...prev, [field]: val }));
  }

  function handleSave() {
    setData(draft);
    save(draft);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(data);
    setEditing(false);
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
        {/* subtle texture overlay */}
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 50%), radial-gradient(circle at 80% 20%, #a855f7 0%, transparent 40%)' }}
        />

        <div className="relative h-full flex items-center justify-between px-6 sm:px-8">
          {/* Left: logo + name + tagline */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-900/40">
              <Building2 size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">
                {d.name || 'Your Company'}
              </h1>
              <p className="text-sm text-white/60 mt-0.5 max-w-md leading-relaxed">
                {d.tagline || 'Add your one-liner tagline'}
              </p>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 text-sm text-white/80 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 rounded-xl hover:bg-white/20 transition-all"
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-xl hover:bg-white/25 transition-all"
                >
                  <Check size={14} /> Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 rounded-xl hover:bg-white/20 transition-all"
              >
                <Edit3 size={14} /> Edit Profile
              </button>
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

        {/* Empty state banner */}
        {!hasData && !editing && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
            <Lightbulb size={16} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Complete your company profile</p>
              <p className="text-xs text-amber-600 mt-0.5">This is what your investor sees when they review your company data.</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">

          {/* Left: main sections */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* ── Overview ── */}
            <Section title="Company Overview" icon={Building2} editing={editing} iconColor="text-indigo-500" iconBg="bg-indigo-50">
              {editing ? (
                <>
                  <EditField label="Company Name" field="name" value={d.name} onChange={handleChange} placeholder="Acme Inc" />
                  <EditField label="Tagline" field="tagline" value={d.tagline} onChange={handleChange} placeholder="One-liner about your company" />
                  <EditField label="Website" field="website" value={d.website} onChange={handleChange} placeholder="https://yourcompany.com" />
                  <EditField label="Industry" field="industry" value={d.industry} onChange={handleChange} options={INDUSTRIES} />
                  <EditField label="Stage" field="stage" value={d.stage} onChange={handleChange} options={STAGES} />
                  <EditField label="Founded Year" field="foundedYear" value={d.foundedYear} onChange={handleChange} placeholder="2022" />
                  <EditField label="Location / HQ" field="location" value={d.location} onChange={handleChange} placeholder="San Francisco, CA" />
                  <div className="sm:col-span-2">
                    <EditField label="Company Description" field="description" value={d.description} onChange={handleChange}
                      placeholder="Describe what your company does, the problem you solve, and who you serve…" multiline />
                  </div>
                </>
              ) : (
                <>
                  <DisplayField label="Website" value={d.website} href={d.website} />
                  <DisplayField label="Industry" value={d.industry} />
                  <DisplayField label="Stage" value={d.stage} />
                  <DisplayField label="Founded" value={d.foundedYear} />
                  <div className="sm:col-span-2">
                    <DisplayField label="Description" value={d.description} />
                  </div>
                </>
              )}
            </Section>

            {/* ── Team ── */}
            <Section title="Founding Team" icon={Users} editing={editing} iconColor="text-amber-500" iconBg="bg-amber-50">
              {editing ? (
                <>
                  <div className="sm:col-span-2">
                    <EditField label="Founder(s)" field="founderNames" value={d.founderNames} onChange={handleChange} placeholder="e.g. Alice Smith (CEO), Bob Jones (CTO)" />
                  </div>
                  <EditField label="Total Team Size" field="teamSize" value={d.teamSize} onChange={handleChange} placeholder="12" />
                  <EditField label="Open Roles" field="openRoles" value={d.openRoles} onChange={handleChange} placeholder="e.g. Senior Engineer, Head of Sales" />
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <DisplayField label="Founder(s)" value={d.founderNames} />
                  </div>
                  <DisplayField label="Team Size" value={d.teamSize ? `${d.teamSize} people` : ''} />
                  <DisplayField label="Open Roles" value={d.openRoles} />
                </>
              )}
            </Section>

            {/* ── Product & Traction ── */}
            <Section title="Product & Traction" icon={TrendingUp} editing={editing} iconColor="text-emerald-500" iconBg="bg-emerald-50">
              {editing ? (
                <>
                  <div className="sm:col-span-2">
                    <EditField label="Product Description" field="productDescription" value={d.productDescription} onChange={handleChange}
                      placeholder="What does your product do? Who is it for? What's the core value?" multiline />
                  </div>
                  <EditField label="MRR ($)" field="mrr" value={d.mrr} onChange={handleChange} placeholder="50,000" />
                  <EditField label="ARR ($)" field="arr" value={d.arr} onChange={handleChange} placeholder="600,000" />
                  <EditField label="Active Customers" field="activeCustomers" value={d.activeCustomers} onChange={handleChange} placeholder="250" />
                  <EditField label="MoM Revenue Growth (%)" field="momGrowth" value={d.momGrowth} onChange={handleChange} placeholder="12" />
                  <EditField label="Monthly Churn Rate (%)" field="churnRate" value={d.churnRate} onChange={handleChange} placeholder="2.5" />
                  <EditField label="NPS Score" field="nps" value={d.nps} onChange={handleChange} placeholder="72" />
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
                          <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide mt-0.5">MRR</p>
                        </div>
                      )}
                      {d.arr && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-indigo-700">{fmt(d.arr)}</p>
                          <p className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide mt-0.5">ARR</p>
                        </div>
                      )}
                      {d.activeCustomers && (
                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-purple-700">{d.activeCustomers}</p>
                          <p className="text-[10px] font-medium text-purple-500 uppercase tracking-wide mt-0.5">Customers</p>
                        </div>
                      )}
                      {d.momGrowth && (
                        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-teal-700">{d.momGrowth}%</p>
                          <p className="text-[10px] font-medium text-teal-500 uppercase tracking-wide mt-0.5">MoM Growth</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <DisplayField label="Product" value={d.productDescription} />
                  </div>
                  <DisplayField label="Monthly Churn" value={d.churnRate ? `${d.churnRate}%` : ''} />
                  <DisplayField label="NPS" value={d.nps} />
                  {d.keyMetric && <DisplayField label={d.keyMetricLabel || 'Key Metric'} value={d.keyMetric} />}
                </>
              )}
            </Section>

            {/* ── Financials ── */}
            <Section title="Financials & Funding" icon={DollarSign} editing={editing} iconColor="text-green-600" iconBg="bg-green-50">
              {editing ? (
                <>
                  <EditField label="Total Raised ($)" field="totalRaised" value={d.totalRaised} onChange={handleChange} placeholder="2,500,000" />
                  <EditField label="Last Round Size ($)" field="lastRoundSize" value={d.lastRoundSize} onChange={handleChange} placeholder="2,000,000" />
                  <EditField label="Last Round Stage" field="lastRoundStage" value={d.lastRoundStage} onChange={handleChange} options={STAGES} />
                  <EditField label="Last Round Date" field="lastRoundDate" value={d.lastRoundDate} onChange={handleChange} type="month" />
                  <EditField label="Pre-Money Valuation ($)" field="preMoneyValuation" value={d.preMoneyValuation} onChange={handleChange} placeholder="10,000,000" />
                  <EditField label="Monthly Burn ($)" field="monthlyBurn" value={d.monthlyBurn} onChange={handleChange} placeholder="120,000" />
                  <EditField label="Runway (months)" field="runway" value={d.runway} onChange={handleChange} placeholder="18" />
                  <div className="sm:col-span-2">
                    <EditField label="Revenue Model" field="revenueModel" value={d.revenueModel} onChange={handleChange}
                      placeholder="e.g. SaaS subscription — $99/mo per seat, enterprise contracts from $5K/mo" multiline />
                  </div>
                </>
              ) : (
                <>
                  <DisplayField label="Total Raised" value={d.totalRaised ? `$${d.totalRaised}` : ''} />
                  <DisplayField label="Last Round" value={d.lastRoundStage && d.lastRoundSize ? `${d.lastRoundStage} · $${d.lastRoundSize}` : (d.lastRoundSize || '')} />
                  <DisplayField label="Pre-Money Valuation" value={d.preMoneyValuation ? `$${d.preMoneyValuation}` : ''} />
                  <DisplayField label="Monthly Burn" value={d.monthlyBurn ? `$${d.monthlyBurn}` : ''} />
                  <DisplayField label="Runway" value={d.runway ? `${d.runway} months` : ''} />
                  <div className="sm:col-span-2">
                    <DisplayField label="Revenue Model" value={d.revenueModel} />
                  </div>
                </>
              )}
            </Section>

            {/* ── Market ── */}
            <Section title="Market & Competition" icon={Target} editing={editing} iconColor="text-violet-500" iconBg="bg-violet-50">
              {editing ? (
                <>
                  <div className="sm:col-span-2">
                    <EditField label="Target Market" field="targetMarket" value={d.targetMarket} onChange={handleChange}
                      placeholder="Who is your ideal customer? Industry, company size, geography…" multiline />
                  </div>
                  <EditField label="TAM ($)" field="tam" value={d.tam} onChange={handleChange} placeholder="50B" />
                  <EditField label="SAM ($)" field="sam" value={d.sam} onChange={handleChange} placeholder="5B" />
                  <EditField label="SOM ($)" field="som" value={d.som} onChange={handleChange} placeholder="500M" />
                  <div className="sm:col-span-2">
                    <EditField label="Key Competitors" field="keyCompetitors" value={d.keyCompetitors} onChange={handleChange}
                      placeholder="List your main competitors and how you compare" multiline />
                  </div>
                  <div className="sm:col-span-2">
                    <EditField label="Your Differentiator / Moat" field="differentiator" value={d.differentiator} onChange={handleChange}
                      placeholder="What makes you unique and hard to copy?" multiline />
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <DisplayField label="Target Market" value={d.targetMarket} />
                  </div>
                  <DisplayField label="TAM" value={d.tam} />
                  <DisplayField label="SAM" value={d.sam} />
                  <DisplayField label="SOM" value={d.som} />
                  <div className="sm:col-span-2">
                    <DisplayField label="Competitors" value={d.keyCompetitors} />
                  </div>
                  <div className="sm:col-span-2">
                    <DisplayField label="Moat / Differentiator" value={d.differentiator} />
                  </div>
                </>
              )}
            </Section>

            {/* ── Investor Relations ── */}
            <Section title="Current Round & Investor Ask" icon={Shield} editing={editing} accent>
              {editing ? (
                <>
                  <EditField label="Current Ask ($)" field="currentAsk" value={d.currentAsk} onChange={handleChange} placeholder="3,000,000" />
                  <EditField label="Expected Runway after raise (months)" field="runway" value={d.runway} onChange={handleChange} placeholder="24" />
                  <div className="sm:col-span-2">
                    <EditField label="Use of Funds" field="useOfFunds" value={d.useOfFunds} onChange={handleChange}
                      placeholder="e.g. 50% engineering hires, 30% sales & marketing, 20% infrastructure" multiline />
                  </div>
                  <div className="sm:col-span-2">
                    <EditField label="Next 12-Month Milestones" field="nextMilestones" value={d.nextMilestones} onChange={handleChange}
                      placeholder="e.g. Reach $1M ARR, launch enterprise tier, hire 3 engineers" multiline />
                  </div>
                  <div className="sm:col-span-2">
                    <EditField label="Key Risks" field="keyRisks" value={d.keyRisks} onChange={handleChange}
                      placeholder="What are the biggest risks to the business and how are you mitigating them?" multiline />
                  </div>
                </>
              ) : (
                <>
                  <DisplayField label="Current Ask" value={d.currentAsk ? `$${d.currentAsk}` : ''} />
                  <div className="sm:col-span-2">
                    <DisplayField label="Use of Funds" value={d.useOfFunds} />
                  </div>
                  <div className="sm:col-span-2">
                    <DisplayField label="12-Month Milestones" value={d.nextMilestones} />
                  </div>
                  <div className="sm:col-span-2">
                    <DisplayField label="Key Risks" value={d.keyRisks} />
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
                Key Metrics
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'MRR',             value: fmt(data.mrr) },
                  { label: 'ARR',             value: fmt(data.arr) },
                  { label: 'Active Customers',value: data.activeCustomers || '—' },
                  { label: 'MoM Growth',      value: data.momGrowth ? `${data.momGrowth}%` : '—' },
                  { label: 'Churn Rate',      value: data.churnRate ? `${data.churnRate}%` : '—' },
                  { label: 'NPS',             value: data.nps || '—' },
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
                Funding Snapshot
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Raised',    value: fmt(data.totalRaised) },
                  { label: 'Last Round',      value: data.lastRoundStage || '—' },
                  { label: 'Pre-Money Val.',  value: fmt(data.preMoneyValuation) },
                  { label: 'Monthly Burn',    value: fmt(data.monthlyBurn) },
                  { label: 'Runway',          value: data.runway ? `${data.runway} mo` : '—' },
                  { label: 'Current Ask',     value: fmt(data.currentAsk) },
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
                    <span>Runway remaining</span>
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
                  Market Size
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'TAM', value: data.tam, color: 'bg-violet-500', width: '100%' },
                    { label: 'SAM', value: data.sam, color: 'bg-indigo-400', width: '60%' },
                    { label: 'SOM', value: data.som, color: 'bg-blue-300',   width: '25%' },
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
                Team
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
                  <p className="text-xs text-gray-400 italic">No founders added yet</p>
                )}
                {data.teamSize && (
                  <div className="pt-2 mt-2 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Total team</span>
                    <span className="text-sm font-bold text-gray-900">{data.teamSize} people</span>
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
                  Next Milestones
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

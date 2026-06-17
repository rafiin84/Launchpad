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

const SAMPLE: CompanyData = {
  name: 'NexaFlow AI',
  tagline: 'Automate workflows with AI — no code required.',
  description: 'NexaFlow AI is a no-code workflow automation platform powered by large language models. We help operations teams at mid-market companies eliminate repetitive manual tasks, reduce errors, and reclaim 20+ hours per week. Our drag-and-drop builder connects to 150+ business tools and uses AI to suggest, generate, and optimize automations in plain English.',
  website: 'https://nexaflow.ai',
  industry: 'SaaS',
  stage: 'Seed',
  foundedYear: '2022',
  location: 'San Francisco, CA',
  founderNames: 'Rafi Nasser (CEO), Priya Sharma (CTO)',
  teamSize: '14',
  openRoles: 'Senior Full-Stack Engineer, Head of Growth, Customer Success Manager',
  productDescription: 'NexaFlow AI lets operations teams build powerful automations using natural language. Users describe what they want ("when a new lead comes in from HubSpot, enrich it with Clearbit, score it with our AI model, then create a task in Asana") and our engine builds and runs the automation. No engineering required.',
  mrr: '68000',
  arr: '816000',
  activeCustomers: '312',
  momGrowth: '14',
  churnRate: '1.8',
  nps: '68',
  keyMetric: '4.2M',
  keyMetricLabel: 'Automations run / month',
  totalRaised: '2800000',
  lastRoundSize: '2500000',
  lastRoundStage: 'Seed',
  lastRoundDate: '2023-09',
  preMoneyValuation: '12000000',
  monthlyBurn: '135000',
  runway: '18',
  revenueModel: 'SaaS subscription — Starter at $299/mo, Growth at $799/mo, Enterprise from $2,500/mo. Annual contracts at 20% discount. Usage-based overage for automations above plan limits.',
  tam: '$48B global workflow automation market (2027)',
  sam: '$6.5B mid-market operations automation',
  som: '$320M addressable in North America within 3 years',
  targetMarket: 'Operations, RevOps, and IT teams at B2B SaaS and professional services companies with 50–500 employees. Primary buyers are Heads of Operations and VPs of Revenue Operations.',
  keyCompetitors: 'Zapier (SMB-focused, limited AI), Make.com (technical users), Workato (enterprise, expensive). NexaFlow differentiates on AI-native UX, mid-market pricing, and real-time analytics.',
  differentiator: 'AI-first architecture that understands business intent — not just API connectors. Our proprietary workflow graph model learns from each customer\'s data to proactively suggest next automations. Switching cost grows with usage, creating strong retention.',
  currentAsk: '5000000',
  useOfFunds: '45% product & engineering (3 senior hires), 35% sales & marketing (outbound motion, content, PLG), 15% customer success & onboarding, 5% G&A and legal.',
  keyRisks: '1. Larger players (Zapier, HubSpot) adding AI features — mitigated by our 18-month head start and deeper LLM integration. 2. Enterprise sales cycle longer than expected — we\'re building a strong PLG motion to compress time-to-value. 3. LLM cost at scale — actively optimizing inference pipeline, 60% cost reduction since launch.',
  nextMilestones: 'Q3 2025: Reach $1M ARR. Q4 2025: Launch Enterprise tier with SSO & audit logs. Q1 2026: 500 paying customers. Q2 2026: Series A raise targeting $15M at $60M post.',
};

function load(): CompanyData {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return { ...EMPTY, ...JSON.parse(s) };
  } catch { /* ignore */ }
  // Pre-populate with sample data on first load
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE));
  return SAMPLE;
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

function Section({ title, icon: Icon, children, editing, accent }: {
  title: string; icon: React.ElementType; children: React.ReactNode; editing: boolean; accent?: boolean;
}) {
  return (
    <div className={cn('rounded-2xl border p-6', accent ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100' : 'bg-white border-gray-100')}>
      <h2 className={cn('text-sm font-bold mb-5 flex items-center gap-2', accent ? 'text-indigo-900' : 'text-gray-900')}>
        <Icon size={15} className={accent ? 'text-indigo-500' : 'text-gray-400'} />
        {title}
      </h2>
      <div className={cn('grid gap-4', editing ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FounderCompany() {
  const [data, setData]     = useState<CompanyData>(load);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]   = useState<CompanyData>(data);

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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Building2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{data.name || 'Your Company'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{data.tagline || 'Add your tagline'}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {data.stage && (
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{data.stage}</span>
              )}
              {data.industry && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{data.industry}</span>
              )}
              {data.location && (
                <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={10} />{data.location}</span>
              )}
              {data.website && (
                <a href={data.website} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-indigo-500 flex items-center gap-1 hover:underline">
                  <Globe size={10} />{data.website.replace(/https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={handleCancel} className="flex items-center gap-1.5 text-sm text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">
                <X size={14} /> Cancel
              </button>
              <button onClick={handleSave} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-black px-4 py-2 rounded-xl hover:bg-gray-800">
                <Check size={14} /> Save
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:border-gray-400 transition-all">
              <Edit3 size={14} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {!hasData && !editing && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3">
          <Lightbulb size={16} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Complete your company profile</p>
            <p className="text-xs text-amber-600 mt-0.5">This is what your investor sees when they review your company data.</p>
          </div>
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
            Get Started
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">

        {/* Left: main sections */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── Overview ── */}
          <Section title="Company Overview" icon={Building2} editing={editing}>
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
          <Section title="Founding Team" icon={Users} editing={editing}>
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
          <Section title="Product & Traction" icon={TrendingUp} editing={editing}>
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
                <div className="sm:col-span-2">
                  <DisplayField label="Product" value={d.productDescription} />
                </div>
                <DisplayField label="MRR" value={d.mrr ? `$${d.mrr}` : ''} />
                <DisplayField label="ARR" value={d.arr ? `$${d.arr}` : ''} />
                <DisplayField label="Active Customers" value={d.activeCustomers} />
                <DisplayField label="MoM Growth" value={d.momGrowth ? `${d.momGrowth}%` : ''} />
                <DisplayField label="Monthly Churn" value={d.churnRate ? `${d.churnRate}%` : ''} />
                <DisplayField label="NPS" value={d.nps} />
                {d.keyMetric && <DisplayField label={d.keyMetricLabel || 'Key Metric'} value={d.keyMetric} />}
              </>
            )}
          </Section>

          {/* ── Financials ── */}
          <Section title="Financials & Funding" icon={DollarSign} editing={editing}>
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
          <Section title="Market & Competition" icon={Target} editing={editing}>
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
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-indigo-500" /> Key Metrics
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
                  <span className="text-sm font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Funding snapshot */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign size={14} className="text-emerald-500" /> Funding Snapshot
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
                  <span className="text-sm font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
            {data.runway && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Runway used</span>
                  <span>{Math.max(0, 24 - parseInt(data.runway || '0'))} / 24 mo</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', parseInt(data.runway) >= 12 ? 'bg-emerald-400' : 'bg-amber-400')}
                    style={{ width: `${Math.min(100, (parseInt(data.runway) / 24) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Market size */}
          {(data.tam || data.sam || data.som) && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target size={14} className="text-violet-500" /> Market Size
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'TAM', value: data.tam, color: 'bg-violet-500', width: '100%' },
                  { label: 'SAM', value: data.sam, color: 'bg-indigo-400', width: '60%' },
                  { label: 'SOM', value: data.som, color: 'bg-blue-300',   width: '25%' },
                ].map(({ label, value, color, width }) => value ? (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{label}</span>
                      <span className="text-gray-500">{value}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width }} />
                    </div>
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          {/* Team card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={14} className="text-amber-500" /> Team
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
                  <span className="text-sm font-semibold text-gray-900">{data.teamSize} people</span>
                </div>
              )}
            </div>
          </div>

          {/* Next milestones */}
          {data.nextMilestones && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-indigo-500" /> Next Milestones
              </h3>
              <p className="text-xs text-indigo-800 leading-relaxed">{data.nextMilestones}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

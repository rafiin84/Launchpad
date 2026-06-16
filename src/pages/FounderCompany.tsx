import React, { useState, useEffect } from 'react';
import {
  Building2, Globe, MapPin, Users, DollarSign, TrendingUp,
  Lightbulb, Target, Edit3, Check, X, ExternalLink,
  Calendar, Layers, Shield,
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

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl">

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

      <div className="space-y-4">

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
              <DisplayField label="Team Size" value={d.teamSize} />
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
    </div>
  );
}

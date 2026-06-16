import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox, TrendingUp, DollarSign, Users, Clock,
  BarChart2, Search, ArrowUpRight, ChevronRight,
  AlertCircle, CheckCircle2, Eye, CalendarClock,
  Target, Layers, Plus, Building2,
} from 'lucide-react';
import { applicationsService } from '../services/dealsService';
import { mockApplications } from '../data/mockData';
import { getApplications, type StoredApplication } from '../services/store';
import type { Application, DealStage } from '../types';
import { StageBadge } from '../components/ui/Badge';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar } from '../components/ui/Avatar';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// Stages to show (never 'approved' — those go to Portfolio)
const PIPELINE_STAGES: { id: DealStage; label: string; color: string; bg: string }[] = [
  { id: 'new',                  label: 'New',               color: '#6b7280', bg: '#f9fafb' },
  { id: 'reviewing',            label: 'Under Review',      color: '#3b82f6', bg: '#eff6ff' },
  { id: 'meeting-scheduled',    label: 'Meeting Scheduled', color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'due-diligence',        label: 'Due Diligence',     color: '#f59e0b', bg: '#fffbeb' },
  { id: 'investment-committee', label: 'IC Review',         color: '#10b981', bg: '#ecfdf5' },
  { id: 'rejected',             label: 'Rejected',          color: '#ef4444', bg: '#fef2f2' },
];

const STAGE_ICONS: Record<string, React.ReactNode> = {
  new:                  <Inbox size={16} />,
  reviewing:            <Eye size={16} />,
  'meeting-scheduled':  <CalendarClock size={16} />,
  'due-diligence':      <Search size={16} />,
  'investment-committee': <CheckCircle2 size={16} />,
  rejected:             <AlertCircle size={16} />,
};

// ─── Pipeline Funnel Chart ────────────────────────────────────────────────────

function PipelineFunnelChart({ apps }: { apps: Application[] }) {
  const counts = PIPELINE_STAGES.map(s => ({
    ...s,
    count: apps.filter(a => a.stage === s.id).length,
  }));
  const max = Math.max(...counts.map(c => c.count), 1);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Pipeline Funnel</h3>
        <p className="text-xs text-gray-400 mt-0.5">Applications per stage</p>
      </div>
      <div className="space-y-3">
        {counts.map(s => (
          <div key={s.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600 w-36 flex-shrink-0">{s.label}</span>
              <span className="text-xs font-bold text-gray-900">{s.count}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(s.count / max) * 100}%`, backgroundColor: s.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Industry Breakdown Chart ─────────────────────────────────────────────────

function IndustryBreakdownChart({ apps }: { apps: Application[] }) {
  const byIndustry: Record<string, number> = {};
  apps.forEach(a => {
    byIndustry[a.industry] = (byIndustry[a.industry] ?? 0) + a.fundingRequested;
  });
  const data = Object.entries(byIndustry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const max = data[0]?.[1] ?? 1;
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ef4444'];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Funding Ask by Industry</h3>
        <p className="text-xs text-gray-400 mt-0.5">Total requested per sector</p>
      </div>
      <div className="space-y-3">
        {data.map(([industry, amount], i) => (
          <div key={industry}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600 truncate w-40 flex-shrink-0">{industry}</span>
              <span className="text-xs font-bold text-gray-900">{formatCurrency(amount)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(amount / max) * 100}%`, backgroundColor: colors[i] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stage Badge (local inline) ───────────────────────────────────────────────

function StagePill({ stage }: { stage: DealStage }) {
  const s = PIPELINE_STAGES.find(p => p.id === stage);
  if (!s) return <span className="text-xs text-gray-400 capitalize">{stage}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

// ─── Applications Table ───────────────────────────────────────────────────────

function ApplicationsTable({ apps }: { apps: Application[] }) {
  if (apps.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
        <Inbox size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No applications found</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3.5 w-48">Company</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-40">Key Person</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-44">Contact</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">What they're building</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-36">Stage</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5 w-28">Ask</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5 w-24">Submitted</th>
              <th className="px-4 py-3.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {apps.map((app, i) => (
              <tr
                key={app.id}
                className={`group border-b border-gray-50 hover:bg-gray-50/60 transition-colors last:border-0 ${i % 2 === 0 ? '' : ''}`}
              >
                {/* Company */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img src={app.company.logo} alt={app.company.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{app.company.name}</p>
                      <p className="text-xs text-gray-400 truncate">{app.industry}</p>
                    </div>
                  </div>
                </td>

                {/* Key Person */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Avatar src={app.founder.avatar} name={app.founder.name} size="xs" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{app.founder.name}</p>
                      <p className="text-xs text-gray-400 truncate">{app.founder.location ?? app.company.location}</p>
                    </div>
                  </div>
                </td>

                {/* Contact */}
                <td className="px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 truncate">{app.founder.email}</p>
                    <a
                      href={app.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:text-indigo-700 truncate flex items-center gap-0.5"
                      onClick={e => e.stopPropagation()}
                    >
                      {app.website.replace('https://', '')}
                      <ArrowUpRight size={10} />
                    </a>
                  </div>
                </td>

                {/* Description */}
                <td className="px-4 py-4">
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {app.company.description ?? app.company.shortDescription ?? app.notes}
                  </p>
                </td>

                {/* Stage */}
                <td className="px-4 py-4">
                  <StagePill stage={app.stage} />
                </td>

                {/* Ask */}
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(app.fundingRequested)}</span>
                </td>

                {/* Submitted */}
                <td className="px-4 py-4 text-right">
                  <span className="text-xs text-gray-400">{formatDate(app.submittedAt)}</span>
                </td>

                {/* Arrow */}
                <td className="px-4 py-4">
                  <Link
                    to={`/applications/${app.id}`}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 hover:bg-indigo-100 hover:text-indigo-600 text-gray-400 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── KPI Chip row ─────────────────────────────────────────────────────────────

interface Chip {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
  accent?: boolean;
}

function ChipRow({ chips }: { chips: Chip[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className={`flex-shrink-0 w-44 rounded-2xl p-5 ${
            chip.accent ? 'bg-black' : 'bg-white border border-gray-100 hover:border-gray-200'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${chip.accent ? 'bg-white/15' : 'bg-gray-50'}`}>
            <span className={chip.accent ? 'text-white' : 'text-gray-500'}>{chip.icon}</span>
          </div>
          <p className={`text-2xl font-bold mb-0.5 ${chip.accent ? 'text-white' : (chip.color ?? 'text-gray-900')}`}>
            {chip.value}
          </p>
          <p className={`text-xs font-semibold ${chip.accent ? 'text-gray-200' : 'text-gray-700'}`}>{chip.label}</p>
          {chip.sub && (
            <p className={`text-xs mt-0.5 ${chip.accent ? 'text-gray-400' : 'text-gray-400'}`}>{chip.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Applications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [storedApps, setStoredApps] = useState<StoredApplication[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    applicationsService.getAll().then(setApplications);
    setStoredApps(getApplications());
  }, []);

  // Use mockApplications for synchronous chip calculation
  const active = mockApplications.filter(a => a.stage !== 'approved' && a.stage !== 'invested');
  const totalFunding = active.reduce((s, a) => s + a.fundingRequested, 0);

  const count = (stage: DealStage) => active.filter(a => a.stage === stage).length;

  const chips: Chip[] = [
    {
      label: 'Total Applications',
      value: active.length,
      sub: 'in pipeline',
      icon: <Inbox size={16} />,
      accent: true,
    },
    {
      label: 'New',
      value: count('new'),
      sub: 'awaiting review',
      icon: <Inbox size={16} />,
    },
    {
      label: 'Under Review',
      value: count('reviewing'),
      sub: 'being evaluated',
      icon: <Eye size={16} />,
    },
    {
      label: 'Meeting Scheduled',
      value: count('meeting-scheduled'),
      sub: 'call booked',
      icon: <CalendarClock size={16} />,
      color: 'text-indigo-600',
    },
    {
      label: 'Due Diligence',
      value: count('due-diligence'),
      sub: 'deep review',
      icon: <Search size={16} />,
      color: 'text-amber-600',
    },
    {
      label: 'IC Review',
      value: count('investment-committee'),
      sub: 'committee stage',
      icon: <CheckCircle2 size={16} />,
      color: 'text-emerald-600',
    },
    {
      label: 'Rejected',
      value: count('rejected'),
      sub: 'passed',
      icon: <AlertCircle size={16} />,
      color: 'text-red-500',
    },
    {
      label: 'Total Funding Ask',
      value: formatCurrency(totalFunding),
      sub: 'pipeline value',
      icon: <DollarSign size={16} />,
    },
    {
      label: 'Avg Deal Size',
      value: formatCurrency(totalFunding / (active.length || 1)),
      sub: 'per application',
      icon: <BarChart2 size={16} />,
    },
    {
      label: 'Conversion Rate',
      value: `${Math.round((count('investment-committee') / (active.length || 1)) * 100)}%`,
      sub: 'to IC stage',
      icon: <Target size={16} />,
      color: 'text-indigo-600',
    },
  ];

  const filtered = query
    ? applications.filter(
        a =>
          a.company.name.toLowerCase().includes(query.toLowerCase()) ||
          a.industry.toLowerCase().includes(query.toLowerCase()) ||
          a.founder.name.toLowerCase().includes(query.toLowerCase())
      )
    : applications;

  const tableApps = filtered.filter(a => a.stage !== 'approved' && a.stage !== 'invested');

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Constrained header */}
      <div className="max-w-5xl">
        <PageHeader
          title="Applications"
          description="Manage your deal pipeline from first look to committee"
          action={
            <Link to="/applications/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
              <Plus size={15} /> Add Application
            </Link>
          }
        />
      </div>

      {/* Full-width KPI chips */}
      <ChipRow chips={chips} />

      {/* Charts + table — same full width as page */}
      <div className="max-w-5xl">
        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <PipelineFunnelChart apps={active} />
          <IndustryBreakdownChart apps={active} />
        </div>
      </div>

      {/* Table */}
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">
            All Applications
            <span className="ml-2 text-xs font-medium text-gray-400">{tableApps.length}</span>
          </h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies, founders..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 w-64"
            />
          </div>
        </div>
        <ApplicationsTable apps={tableApps} />

        {/* Manually added applications */}
        {storedApps.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Manually Added ({storedApps.length})</h3>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3.5 w-48">Company</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-40">Founder</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-44">Contact</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">What they're building</th>
                      <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 w-28">Stage</th>
                      <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5 w-28">Ask</th>
                      <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5 w-28">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storedApps.map((app) => {
                      const amount = parseFloat(app.amountRequested) || 0;
                      const fmtAmt = amount >= 1_000_000 ? `$${(amount/1_000_000).toFixed(1)}M` : amount >= 1000 ? `$${(amount/1000).toFixed(0)}K` : `$${amount}`;
                      return (
                        <tr key={app.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors last:border-0">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                                {app.logo ? <img src={app.logo} alt={app.companyName} className="w-full h-full object-cover" /> : <Building2 size={14} className="text-gray-400" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{app.companyName}</p>
                                <p className="text-xs text-gray-400 truncate capitalize">{app.industry}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-medium text-gray-900 truncate">{app.founderName || '—'}</p>
                            <p className="text-xs text-gray-400 truncate">{app.location}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-xs text-gray-700 truncate">{app.founderEmail}</p>
                            {app.website && <p className="text-xs text-indigo-500 truncate">{app.website.replace('https://', '')}</p>}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-xs text-gray-600 line-clamp-2">{app.shortDescription}</p>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                              {app.pipelineStage}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-sm font-semibold text-gray-900">{fmtAmt}</span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-xs text-gray-400">{new Date(app.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

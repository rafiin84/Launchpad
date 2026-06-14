import React, { useState, useEffect } from 'react';
import { LayoutGrid, List, Search, Filter, DollarSign, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { applicationsService } from '../services/dealsService';
import type { Application, DealStage } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { StageBadge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';

const STAGES: { id: DealStage; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: 'border-gray-200 bg-gray-50' },
  { id: 'reviewing', label: 'Reviewing', color: 'border-blue-200 bg-blue-50' },
  { id: 'meeting-scheduled', label: 'Meeting', color: 'border-indigo-200 bg-indigo-50' },
  { id: 'due-diligence', label: 'Due Diligence', color: 'border-purple-200 bg-purple-50' },
  { id: 'investment-committee', label: 'IC', color: 'border-amber-200 bg-amber-50' },
  { id: 'approved', label: 'Approved', color: 'border-emerald-200 bg-emerald-50' },
  { id: 'invested', label: 'Invested', color: 'border-emerald-300 bg-emerald-100' },
  { id: 'rejected', label: 'Rejected', color: 'border-red-200 bg-red-50' },
];

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

function KanbanColumn({ stage, apps }: { stage: typeof STAGES[0]; apps: Application[] }) {
  return (
    <div className={cn('flex-shrink-0 w-64 rounded-2xl border p-3', stage.color)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-700">{stage.label}</h3>
        <span className="text-xs font-medium bg-white/70 text-gray-600 px-2 py-0.5 rounded-full">
          {apps.length}
        </span>
      </div>
      <div className="space-y-2">
        {apps.map((app) => (
          <Link key={app.id} to={`/deals/${app.id}`}>
            <div className="bg-white rounded-xl p-3 border border-white hover:border-gray-200 hover:shadow-sm transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  <img src={app.company.logo} alt={app.company.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{app.company.name}</p>
                  <p className="text-xs text-gray-500 truncate">{app.industry}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">
                  {formatCurrency(app.fundingRequested)}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(app.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </Link>
        ))}
        {apps.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-4">Empty</div>
        )}
      </div>
    </div>
  );
}

function ListRow({ app }: { app: Application }) {
  return (
    <Link to={`/deals/${app.id}`}>
      <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 hover:border-gray-200 hover:shadow-sm transition-all flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          <img src={app.company.logo} alt={app.company.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-gray-900">{app.company.name}</p>
            <StageBadge stage={app.stage} />
          </div>
          <p className="text-xs text-gray-500">{app.industry}</p>
        </div>
        <div className="flex items-center gap-1 text-sm font-semibold text-gray-700">
          {formatCurrency(app.fundingRequested)}
        </div>
        <div className="flex items-center gap-2">
          <Avatar src={app.founder.avatar} name={app.founder.name} size="xs" />
          <span className="text-xs text-gray-500 hidden md:inline">{app.founder.name}</span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(app.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
      </div>
    </Link>
  );
}

export default function Applications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [query, setQuery] = useState('');

  useEffect(() => {
    applicationsService.getAll().then(setApplications);
  }, []);

  const filtered = query
    ? applications.filter(
        (a) =>
          a.company.name.toLowerCase().includes(query.toLowerCase()) ||
          a.industry.toLowerCase().includes(query.toLowerCase())
      )
    : applications;

  return (
    <div className="h-screen flex flex-col">
      <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
        <PageHeader
          title="Applications"
          description="Manage your deal pipeline from first look to close"
          action={
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setView('kanban')}
                  className={cn('p-1.5 rounded-lg transition-all', view === 'kanban' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={cn('p-1.5 rounded-lg transition-all', view === 'list' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          }
        />
        <div className="max-w-sm">
          <Input
            placeholder="Search applications..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex-1 overflow-x-auto px-6 pb-8">
          <div className="flex gap-3 min-w-max">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                apps={filtered.filter((a) => a.stage === stage.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          <div className="max-w-4xl space-y-2">
            {filtered.map((app) => (
              <ListRow key={app.id} app={app} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

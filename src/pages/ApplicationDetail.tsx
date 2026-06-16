import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Mail, MapPin, Users,
  DollarSign, TrendingUp, ExternalLink,
  Building2, Link2, Trash2,
} from 'lucide-react';
import { applicationsService } from '../services/dealsService';
import type { Application, DealStage } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { getApplications, deleteApplication } from '../services/store';

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const STAGE_ORDER: DealStage[] = [
  'new', 'reviewing', 'meeting-scheduled', 'due-diligence', 'investment-committee', 'approved',
];

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  reviewing: 'Under Review',
  'meeting-scheduled': 'Meeting Scheduled',
  'due-diligence': 'Due Diligence',
  'investment-committee': 'IC Review',
  approved: 'Approved',
  rejected: 'Rejected',
  invested: 'Invested',
};

const STAGE_COLORS: Record<string, string> = {
  new: '#6b7280',
  reviewing: '#3b82f6',
  'meeting-scheduled': '#8b5cf6',
  'due-diligence': '#f59e0b',
  'investment-committee': '#10b981',
  approved: '#059669',
  rejected: '#ef4444',
  invested: '#6366f1',
};

function StageTimeline({ current }: { current: DealStage }) {
  const currentIdx = STAGE_ORDER.indexOf(current);
  const isRejected = current === 'rejected';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Deal Progress</h3>
      <div className="flex items-center gap-1">
        {STAGE_ORDER.map((stage, i) => {
          const isPast = currentIdx > i;
          const isActive = currentIdx === i;
          const color = STAGE_COLORS[stage];
          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-all"
                  style={{
                    backgroundColor: isPast || isActive ? color : '#f3f4f6',
                    color: isPast || isActive ? 'white' : '#9ca3af',
                    boxShadow: isActive ? `0 0 0 3px ${color}33` : undefined,
                  }}
                >
                  {isPast ? '✓' : i + 1}
                </div>
                <span className="text-center text-[9px] leading-tight text-gray-400 max-w-[52px]">
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              {i < STAGE_ORDER.length - 1 && (
                <div
                  className="h-0.5 flex-none w-3 mb-5 rounded-full"
                  style={{ backgroundColor: isPast ? color : '#e5e7eb' }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {isRejected && (
        <div className="mt-3 px-3 py-2 bg-red-50 rounded-xl text-xs font-medium text-red-600 text-center">
          This application was rejected
        </div>
      )}
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const isStored = id?.startsWith('app-') ?? false;

  useEffect(() => {
    if (!id) return;
    applicationsService.getById(id).then(result => {
      setApp(result ?? null);
      setLoading(false);
    });
  }, [id]);

  function handleDelete() {
    if (!id) return;
    if (isStored) {
      deleteApplication(id);
    }
    navigate('/applications');
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded-xl w-48" />
          <div className="h-40 bg-gray-100 rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 bg-gray-100 rounded-2xl" />
            <div className="h-48 bg-gray-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl">
        <Link to="/applications" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={16} /> Back to Applications
        </Link>
        <div className="text-center py-20">
          <Building2 size={40} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500">Application not found</p>
        </div>
      </div>
    );
  }

  const stageColor = STAGE_COLORS[app.stage] ?? '#6b7280';
  const stageLabel = STAGE_LABELS[app.stage] ?? app.stage;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-5xl">
        {/* Back + Delete */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/applications"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={15} />
            All Applications
          </Link>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>

        {/* Hero card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
              <img src={app.company.logo} alt={app.company.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{app.company.name}</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{app.industry} · {app.company.location}</p>
                </div>
                <span
                  className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                  style={{ color: stageColor, backgroundColor: `${stageColor}18` }}
                >
                  {stageLabel}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                {app.company.description ?? app.company.shortDescription}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {app.company.tags?.map(tag => (
                  <span key={tag} className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full border border-gray-100">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Key metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-50">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Funding Ask</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(app.fundingRequested)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Company Stage</p>
              <p className="text-lg font-bold text-gray-900 capitalize">{app.company.stage?.replace('-', ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Founded</p>
              <p className="text-lg font-bold text-gray-900">{app.company.foundedYear}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
              <p className="text-sm font-semibold text-gray-700">{formatDate(app.submittedAt)}</p>
            </div>
          </div>
        </div>

        {/* Stage timeline */}
        <div className="mb-4">
          <StageTimeline current={app.stage} />
        </div>

        {/* Two-column detail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Founder card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Founding Team</h3>
            <div className="flex items-start gap-3 mb-4">
              <Avatar src={app.founder.avatar} name={app.founder.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{app.founder.name}</p>
                <p className="text-xs text-gray-500 capitalize">{app.founder.role} &amp; Co-founder</p>
                {app.founder.location && (
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin size={11} className="text-gray-400" />
                    <span className="text-xs text-gray-400">{app.founder.location}</span>
                  </div>
                )}
              </div>
            </div>
            {app.founder.bio && (
              <p className="text-xs text-gray-600 leading-relaxed mb-4">{app.founder.bio}</p>
            )}
            {app.founder.expertise?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {app.founder.expertise.map(ex => (
                  <span key={ex} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{ex}</span>
                ))}
              </div>
            )}
            <div className="space-y-2 pt-3 border-t border-gray-50">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail size={12} className="text-gray-400 flex-shrink-0" />
                <a href={`mailto:${app.founder.email}`} className="hover:text-indigo-600 truncate">{app.founder.email}</a>
              </div>
              {app.founder.linkedIn && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Link2 size={12} className="text-gray-400 flex-shrink-0" />
                  <a href={app.founder.linkedIn} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 truncate">
                    LinkedIn Profile
                  </a>
                </div>
              )}
              {app.founder.twitter && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Link2 size={12} className="text-gray-400 flex-shrink-0" />
                  <span>{app.founder.twitter}</span>
                </div>
              )}
            </div>
          </div>

          {/* Company info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Company Details</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Globe size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Website</p>
                  <a href={app.website} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5">
                    {app.website.replace('https://', '')}
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Location</p>
                  <p className="text-xs text-gray-700">{app.company.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Users size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Team Size</p>
                  <p className="text-xs text-gray-700">
                    {app.company.employeeCount ? `${app.company.employeeCount} employees` : 'Early stage'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <TrendingUp size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Industry</p>
                  <p className="text-xs text-gray-700">{app.industry}</p>
                </div>
              </div>
            </div>

            {/* Reviewer notes */}
            {app.notes && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <p className="text-xs font-medium text-gray-500 mb-2">Investor Notes</p>
                <p className="text-xs text-gray-600 leading-relaxed italic">"{app.notes}"</p>
                {app.reviewedBy && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Avatar src={app.reviewedBy.avatar} name={app.reviewedBy.name} size="xs" />
                    <span className="text-xs text-gray-400">{app.reviewedBy.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Public milestones */}
          {app.company.publicMilestones?.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Key Milestones</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {app.company.publicMilestones.map((m, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <TrendingUp size={12} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">{m.title}</p>
                      {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

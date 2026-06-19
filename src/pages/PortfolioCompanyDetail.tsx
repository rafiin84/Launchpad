import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Globe, MapPin, Users, Calendar, DollarSign,
  TrendingUp, Percent, FileText, User, Mail, Link2, Phone,
  Edit2, Trash2, Tag, ExternalLink, Newspaper,
} from 'lucide-react';
import { getCRMPortfolioRecord, deleteCRMPortfolioRecord, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const stageColors: Record<string, string> = {
  seed: 'bg-violet-50 text-violet-700',
  'series-a': 'bg-blue-50 text-blue-700',
  'series-b': 'bg-indigo-50 text-indigo-700',
  'series-c': 'bg-cyan-50 text-cyan-700',
  pre_seed: 'bg-purple-50 text-purple-700',
};
const statusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  exited: 'bg-indigo-50 text-indigo-700',
  'written-off': 'bg-red-50 text-red-600',
  'follow-on': 'bg-amber-50 text-amber-700',
};

type Tab = 'overview' | 'founder' | 'funding' | 'updates';

export default function PortfolioCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<CRMPortfolioRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCRMPortfolioRecord(id)
      .then(setRecord)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load record'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteCRMPortfolioRecord(id);
      navigate('/portfolio');
    } catch (err) {
      setDeleting(false);
      setShowDeleteModal(false);
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-24 h-4 bg-gray-100 rounded animate-pulse mb-6" />
        <div className="h-48 sm:h-64 bg-gray-100 rounded-2xl animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse space-y-3">
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                {[1, 2, 3].map(j => <div key={j} className="h-3 bg-gray-100 rounded" />)}
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse space-y-3">
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                {[1, 2, 3].map(j => <div key={j} className="h-3 bg-gray-100 rounded" />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={15} /> Portfolio
        </Link>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-sm font-medium text-red-700">{error || 'Record not found'}</p>
        </div>
      </div>
    );
  }

  const investmentAmount = parseFloat(record.investmentAmount) || 0;
  const preMoneyValuation = parseFloat(record.preMoneyValuation) || 0;
  const tags = record.tags ? record.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'founder', label: 'Founder' },
    { key: 'funding', label: 'Funding' },
    { key: 'updates', label: 'Updates' },
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-12">
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Company"
          message={`Are you sure you want to delete "${record.companyName || 'this company'}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}

      {/* Back link */}
      <div className="pt-6 pb-4">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft size={15} /> Portfolio
        </Link>
      </div>

      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden h-48 sm:h-64 mb-0">
        <img
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?fm=jpg&q=80&w=1600&auto=format&fit=crop"
          alt="Company banner"
          className="w-full h-full object-cover"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Action buttons top-right */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <Link
            to={`/portfolio/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-1.5 rounded-xl hover:bg-white/30 transition-colors"
          >
            <Edit2 size={13} /><span className="hidden sm:inline">Edit</span>
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-red-500/70 backdrop-blur-sm border border-red-400/50 px-3 py-1.5 rounded-xl hover:bg-red-500/90 transition-colors"
          >
            <Trash2 size={13} /><span className="hidden sm:inline">Delete</span>
          </button>
        </div>

        {/* Logo — left-aligned, straddling banner bottom */}
        <div className="absolute -bottom-6 left-6">
          <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center">
            <Building2 size={30} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* Company name + badges — left-aligned below banner */}
      <div className="mt-10 mb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{record.companyName}</h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {record.stage && (
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${stageColors[record.stage] ?? 'bg-gray-100 text-gray-600'}`}>
              {record.stage.replace(/-/g, ' ')}
            </span>
          )}
          {record.status && (
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${statusColors[record.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
            </span>
          )}
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">

        {/* Left: Tabs (65%) */}
        <div className="lg:col-span-2">
          {/* Tab bar */}
          <div className="flex items-center gap-1 border-b border-gray-100 mb-6">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative ${
                  activeTab === tab.key
                    ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px bg-indigo-50/50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {(record.shortDescription || record.fullDescription) && (
                <div className="bg-white border border-gray-100 rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">About</h3>
                  {record.shortDescription && (
                    <p className="text-sm font-medium text-gray-700 mb-3">{record.shortDescription}</p>
                  )}
                  {record.fullDescription && (
                    <p className="text-sm text-gray-600 leading-relaxed">{record.fullDescription}</p>
                  )}
                </div>
              )}

              {/* Mock update cards */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Updates</h3>
                <div className="space-y-4">
                  {[
                    { date: 'Jun 10, 2025', text: 'Completed Series A funding round. Raised additional capital to scale product and expand team.', icon: <TrendingUp size={14} className="text-emerald-500" /> },
                    { date: 'Apr 22, 2025', text: 'Launched v2.0 of the platform with new enterprise features. Early customer feedback has been very positive.', icon: <FileText size={14} className="text-indigo-500" /> },
                    { date: 'Feb 5, 2025', text: 'Onboarded 3 new enterprise clients. Monthly recurring revenue grew 40% QoQ.', icon: <Users size={14} className="text-blue-500" /> },
                  ].map((update, i) => (
                    <div key={i} className="flex items-start gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                      <div className="w-7 h-7 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {update.icon}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">{update.date}</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{update.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Founder tab */}
          {activeTab === 'founder' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-5">Founder Information</h3>
              {record.founderName || record.founderEmail || record.founderLinkedin || record.founderPhone ? (
                <div className="flex items-start gap-5">
                  {/* Avatar initial */}
                  <div className="w-14 h-14 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-indigo-400">
                      {record.founderName ? record.founderName.charAt(0).toUpperCase() : <User size={20} />}
                    </span>
                  </div>
                  <div className="space-y-3 flex-1">
                    {record.founderName && (
                      <div>
                        <p className="text-base font-semibold text-gray-900">{record.founderName}</p>
                        <p className="text-xs text-gray-400">Founder</p>
                      </div>
                    )}
                    {record.founderEmail && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-300 flex-shrink-0" />
                        <a href={`mailto:${record.founderEmail}`} className="text-sm text-indigo-600 hover:underline">
                          {record.founderEmail}
                        </a>
                      </div>
                    )}
                    {record.founderPhone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-300 flex-shrink-0" />
                        <a href={`tel:${record.founderPhone}`} className="text-sm text-gray-700 hover:underline">
                          {record.founderPhone}
                        </a>
                      </div>
                    )}
                    {record.founderLinkedin && (
                      <div className="flex items-center gap-2">
                        <Link2 size={14} className="text-gray-300 flex-shrink-0" />
                        <a
                          href={record.founderLinkedin.startsWith('http') ? record.founderLinkedin : `https://${record.founderLinkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1"
                        >
                          LinkedIn Profile <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No founder information available.</p>
              )}
            </div>
          )}

          {/* Funding tab */}
          {activeTab === 'funding' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-5">Funding Details</h3>
              <div className="relative pl-6 border-l-2 border-indigo-100 space-y-6">
                {investmentAmount > 0 && (
                  <div className="relative">
                    <div className="absolute -left-[1.35rem] top-0.5 w-4 h-4 rounded-full bg-indigo-100 border-2 border-indigo-400 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    </div>
                    <p className="text-xs text-gray-400 mb-0.5">Investment Amount</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(investmentAmount)}</p>
                  </div>
                )}
                {record.investmentDate && (
                  <div className="relative">
                    <div className="absolute -left-[1.35rem] top-0.5 w-4 h-4 rounded-full bg-indigo-50 border-2 border-indigo-300 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    </div>
                    <p className="text-xs text-gray-400 mb-0.5">Investment Date</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {new Date(record.investmentDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {preMoneyValuation > 0 && (
                  <div className="relative">
                    <div className="absolute -left-[1.35rem] top-0.5 w-4 h-4 rounded-full bg-indigo-50 border-2 border-indigo-300 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    </div>
                    <p className="text-xs text-gray-400 mb-0.5">Pre-Money Valuation</p>
                    <p className="text-sm font-semibold text-gray-800">{formatCurrency(preMoneyValuation)}</p>
                  </div>
                )}
                {record.ownershipPct && (
                  <div className="relative">
                    <div className="absolute -left-[1.35rem] top-0.5 w-4 h-4 rounded-full bg-indigo-50 border-2 border-indigo-300 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    </div>
                    <p className="text-xs text-gray-400 mb-0.5">Ownership %</p>
                    <p className="text-sm font-semibold text-gray-800">{record.ownershipPct}%</p>
                  </div>
                )}
                {record.notes && (
                  <div className="relative">
                    <div className="absolute -left-[1.35rem] top-0.5 w-4 h-4 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    </div>
                    <p className="text-xs text-gray-400 mb-0.5">Investment Notes</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{record.notes}</p>
                  </div>
                )}
                {investmentAmount === 0 && !record.investmentDate && preMoneyValuation === 0 && !record.ownershipPct && !record.notes && (
                  <p className="text-sm text-gray-400">No funding details available.</p>
                )}
              </div>
            </div>
          )}

          {/* Updates tab */}
          {activeTab === 'updates' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                <Newspaper size={24} className="text-gray-300" />
              </div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">No updates yet</h3>
              <p className="text-xs text-gray-400 max-w-xs">
                Updates and announcements for this company will appear here once added.
              </p>
            </div>
          )}
        </div>

        {/* Right: Sidebar (35%) */}
        <div className="space-y-4">
          {/* Key stats */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Key Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-indigo-50/60 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign size={13} className="text-indigo-400" />
                  <span className="text-xs text-gray-400">Invested</span>
                </div>
                <p className="text-base font-bold text-gray-900">
                  {investmentAmount > 0 ? formatCurrency(investmentAmount) : '—'}
                </p>
              </div>
              <div className="bg-emerald-50/60 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Percent size={13} className="text-emerald-400" />
                  <span className="text-xs text-gray-400">Ownership</span>
                </div>
                <p className="text-base font-bold text-gray-900">
                  {record.ownershipPct ? `${record.ownershipPct}%` : '—'}
                </p>
              </div>
              <div className="bg-blue-50/60 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={13} className="text-blue-400" />
                  <span className="text-xs text-gray-400">Valuation</span>
                </div>
                <p className="text-base font-bold text-gray-900">
                  {preMoneyValuation > 0 ? formatCurrency(preMoneyValuation) : '—'}
                </p>
              </div>
              <div className="bg-amber-50/60 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users size={13} className="text-amber-400" />
                  <span className="text-xs text-gray-400">Team Size</span>
                </div>
                <p className="text-base font-bold text-gray-900">
                  {record.teamSize || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Company Info</h3>
            <div className="space-y-3">
              {record.website && (
                <div className="flex items-center gap-2.5">
                  <Globe size={14} className="text-gray-300 flex-shrink-0" />
                  <a
                    href={record.website.startsWith('http') ? record.website : `https://${record.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:underline truncate inline-flex items-center gap-1"
                  >
                    {record.website} <ExternalLink size={10} />
                  </a>
                </div>
              )}
              {record.location && (
                <div className="flex items-center gap-2.5">
                  <MapPin size={14} className="text-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{record.location}</span>
                </div>
              )}
              {record.industry && (
                <div className="flex items-center gap-2.5">
                  <Building2 size={14} className="text-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{record.industry}</span>
                </div>
              )}
              {record.foundedYear && (
                <div className="flex items-center gap-2.5">
                  <Calendar size={14} className="text-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Founded {record.foundedYear}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Tag size={13} className="text-gray-300" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

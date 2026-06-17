import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Trophy, Calendar, Users, MapPin, Globe, Trash2 } from 'lucide-react';
import { companiesService } from '../services/companiesService';
import { postsService } from '../services/postsService';
import type { Company, Post } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { StageBadge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { FeedCard } from '../components/feed/FeedCard';
import { getPortfolioCompanies, deletePortfolioCompany } from '../services/store';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'feed', label: 'Activity' },
  { id: 'milestones', label: 'Milestones' },
];

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    companiesService.getById(id).then((c) => setCompany(c ?? null));
    postsService.getFeed().then((allPosts) => {
      setPosts(allPosts.filter((p) => p.company?.id === id));
    });
  }, [id]);

  function handleDelete() {
    if (!company) return;
    const stored = getPortfolioCompanies().find(c => c.companyName === company.name);
    if (stored) deletePortfolioCompany(stored.id);
    navigate('/companies');
  }

  function confirmDelete() {
    setShowDeleteModal(true);
  }

  if (!company) {
    return (
      <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Company"
          message={`Are you sure you want to delete "${company?.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
      {/* Back + Delete */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/companies" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={16} />
          All Companies
        </Link>
        <button
          onClick={confirmDelete}
          className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      {/* Company header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
            <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
              <StageBadge stage={company.stage} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{company.industry}</p>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {company.location && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin size={12} />
                  {company.location}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={12} />
                Founded {company.foundedYear}
              </span>
              {company.employeeCount && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Users size={12} />
                  {company.employeeCount} employees
                </span>
              )}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  <Globe size={12} />
                  Website
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-700 leading-relaxed">{company.description}</p>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {company.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Founders */}
      {company.founders.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Founders</h3>
          <div className="space-y-3">
            {company.founders.map((founder) => (
              <div key={founder.id} className="flex items-center gap-3">
                <Avatar src={founder.avatar} name={founder.name} size="md" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{founder.name}</p>
                  <p className="text-xs text-gray-500">{founder.bio.slice(0, 80)}...</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="prose prose-sm max-w-none">
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">About</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{company.description}</p>
          </div>
        </div>
      )}

      {activeTab === 'feed' && (
        <div className="space-y-4">
          {posts.length > 0 ? (
            posts.map((post) => <FeedCard key={post.id} post={post} />)
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
              <p className="text-gray-400 text-sm">No activity yet</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'milestones' && (
        <div className="space-y-3">
          {company.publicMilestones.length > 0 ? (
            company.publicMilestones.map((m) => (
              <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Trophy size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{m.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                    {m.metrics && (
                      <div className="flex gap-2 mt-2">
                        {m.metrics.map((metric, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">
                            <span className="text-xs text-gray-500">{metric.label}:</span>
                            <span className="text-xs font-semibold text-gray-900 ml-1">{metric.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
              <p className="text-gray-400 text-sm">No public milestones yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

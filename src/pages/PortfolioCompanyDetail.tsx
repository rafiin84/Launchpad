import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Globe, MapPin, Users, Calendar, DollarSign,
  TrendingUp, Percent, FileText, User, Mail, Link2, Phone,
  Edit2, Trash2, Tag, ExternalLink,
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-300 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  );
}

function LinkField({ icon, label, href, text }: { icon: React.ReactNode; label: string; href?: string | null; text?: string | null }) {
  if (!href && !text) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-300 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        {href ? (
          <a href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noopener noreferrer"
            className="text-sm text-indigo-600 font-medium hover:underline inline-flex items-center gap-1">
            {text || href} <ExternalLink size={11} />
          </a>
        ) : (
          <p className="text-sm text-gray-800 font-medium">{text}</p>
        )}
      </div>
    </div>
  );
}

export default function PortfolioCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<CRMPortfolioRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-24 h-4 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-8 bg-gray-100 rounded w-64 mb-2 animate-pulse" />
        <div className="h-4 bg-gray-100 rounded w-40 mb-8 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse space-y-3">
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              {[1,2,3,4].map(j => <div key={j} className="h-3 bg-gray-100 rounded" />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
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

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl">
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Company"
          message={`Are you sure you want to delete "${record.companyName || 'this company'}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}

      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft size={15} /> Portfolio
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/portfolio/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl hover:border-gray-300 transition-colors"
            title="Edit"
          >
            <Edit2 size={14} /><span className="hidden sm:inline ml-1">Edit</span>
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-100 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl hover:bg-red-100 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} /><span className="hidden sm:inline ml-1">Delete</span>
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Building2 size={22} className="text-gray-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{record.companyName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
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
        </div>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Company Overview */}
        <Section title="Company Overview">
          <LinkField icon={<Globe size={14} />} label="Website" href={record.website} text={record.website} />
          <Field icon={<MapPin size={14} />} label="Location" value={record.location} />
          <Field icon={<Building2 size={14} />} label="Industry" value={record.industry} />
          <Field icon={<Calendar size={14} />} label="Founded Year" value={record.foundedYear} />
          <Field icon={<Users size={14} />} label="Team Size" value={record.teamSize} />
          {record.shortDescription && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><FileText size={14} /></span>
              <div>
                <p className="text-xs text-gray-400">Short Description</p>
                <p className="text-sm text-gray-800">{record.shortDescription}</p>
              </div>
            </div>
          )}
          {record.fullDescription && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><FileText size={14} /></span>
              <div>
                <p className="text-xs text-gray-400">Full Description</p>
                <p className="text-sm text-gray-800 leading-relaxed">{record.fullDescription}</p>
              </div>
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><Tag size={14} /></span>
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Investment Details */}
        <Section title="Investment Details">
          {investmentAmount > 0 && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><DollarSign size={14} /></span>
              <div>
                <p className="text-xs text-gray-400">Investment Amount</p>
                <p className="text-sm text-gray-800 font-medium">{formatCurrency(investmentAmount)}</p>
              </div>
            </div>
          )}
          {record.investmentDate && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><Calendar size={14} /></span>
              <div>
                <p className="text-xs text-gray-400">Investment Date</p>
                <p className="text-sm text-gray-800 font-medium">
                  {new Date(record.investmentDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
          )}
          {preMoneyValuation > 0 && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><TrendingUp size={14} /></span>
              <div>
                <p className="text-xs text-gray-400">Pre-Money Valuation</p>
                <p className="text-sm text-gray-800 font-medium">{formatCurrency(preMoneyValuation)}</p>
              </div>
            </div>
          )}
          {record.ownershipPct && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><Percent size={14} /></span>
              <div>
                <p className="text-xs text-gray-400">Ownership %</p>
                <p className="text-sm text-gray-800 font-medium">{record.ownershipPct}%</p>
              </div>
            </div>
          )}
          {record.notes && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><FileText size={14} /></span>
              <div>
                <p className="text-xs text-gray-400">Investment Notes</p>
                <p className="text-sm text-gray-800 leading-relaxed">{record.notes}</p>
              </div>
            </div>
          )}
        </Section>

        {/* Founder Info */}
        <Section title="Founder Info">
          <Field icon={<User size={14} />} label="Founder Name" value={record.founderName} />
          {record.founderEmail && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><Mail size={14} /></span>
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <a href={`mailto:${record.founderEmail}`} className="text-sm text-indigo-600 font-medium hover:underline">
                  {record.founderEmail}
                </a>
              </div>
            </div>
          )}
          <LinkField icon={<Link2 size={14} />} label="LinkedIn" href={record.founderLinkedin} text={record.founderLinkedin} />
          {record.founderPhone && (
            <div className="flex items-start gap-3">
              <span className="text-gray-300 mt-0.5 flex-shrink-0"><Phone size={14} /></span>
              <div>
                <p className="text-xs text-gray-400">Phone</p>
                <a href={`tel:${record.founderPhone}`} className="text-sm text-gray-800 font-medium hover:underline">
                  {record.founderPhone}
                </a>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

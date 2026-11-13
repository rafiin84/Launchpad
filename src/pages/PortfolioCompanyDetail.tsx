import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, MapPin, Globe, Clock } from 'lucide-react';
import { getCRMPortfolioRecord, deleteCRMPortfolioRecord, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { fetchCompanyProfileFromCrm, type CompanyData } from '../services/companyProfile';
import { fetchInvestments, type InvestmentRecord } from '../services/crmInvestments';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { CompanyLogo } from '../components/ui/CompanyLogo';
import OverviewTab from '../components/company/OverviewTab';
import ActivitiesTab from '../components/company/ActivitiesTab';
import DocumentsTab from '../components/company/DocumentsTab';
import MilestonesTab from '../components/company/MilestonesTab';
import FinanceReportsPanel from '../components/finance/FinanceReportsPanel';
import { loadToken } from '../services/oauth';
import { apiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePortfolioOptions, optionLabel } from '../lib/usePortfolioOptions';
import { formatDate } from '../lib/portfolioFormat';
import { cn } from '../lib/cn';

type Tab = 'overview' | 'finance' | 'activities' | 'documents' | 'milestones';

/** CRM-defined picklist values get a soft colour by value; anything else is neutral. */
const TONE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-600', exited: 'bg-indigo-50 text-indigo-600',
  'written-off': 'bg-rose-50 text-rose-500', 'follow-on': 'bg-amber-50 text-amber-600',
};

export default function PortfolioCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { t: all, language } = useLanguage();
  const t = all.companyDetail;
  const locale = language === 'ja' ? 'ja-JP' : 'en-US';
  const options = usePortfolioOptions();

  const [record, setRecord] = useState<CRMPortfolioRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [founderPhotoUrl, setFounderPhotoUrl] = useState('');
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  /** The founder's own profile record: undefined = still looking, null = they have none. */
  const [profile, setProfile] = useState<{ data: CompanyData; recordId: string; logo: string | null } | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCRMPortfolioRecord(id)
      .then(r => {
        setRecord(r);
        if (r?.founderEmail) {
          const token = loadToken();
          fetch(apiUrl('/api/profile?contactPhotos=1'), { headers: token ? { Authorization: `Zoho-oauthtoken ${token}` } : {} })
            .then(res => res.json())
            .then((json: { photos?: Record<string, string> }) => {
              const photo = json.photos?.[r.founderEmail.toLowerCase()];
              if (photo) setFounderPhotoUrl(photo);
            })
            .catch(() => undefined);
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load record'))
      .finally(() => setLoading(false));
  }, [id]);

  const founderEmail = record?.founderEmail || '';
  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    // Funding history comes from this company's Investments records.
    void fetchInvestments().then(all => { if (!cancelled) setInvestments(all.filter(i => i.companyId === record.id)); }).catch(() => undefined);
    if (!founderEmail) { setProfile(null); return; }
    void fetchCompanyProfileFromCrm(founderEmail).then(p => { if (!cancelled) setProfile(p); }).catch(() => { if (!cancelled) setProfile(null); });
    return () => { cancelled = true; };
  }, [record, founderEmail]);

  const tabs: Array<{ key: Tab; label: string }> = useMemo(() => [
    { key: 'overview', label: t.tabOverview }, { key: 'finance', label: t.tabFinance }, { key: 'activities', label: t.tabActivities },
    { key: 'documents', label: t.tabDocuments }, { key: 'milestones', label: t.tabMilestones },
  ], [t]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try { await deleteCRMPortfolioRecord(id); navigate('/portfolio'); }
    catch (err) { setDeleting(false); setShowDeleteModal(false); alert(err instanceof Error ? err.message : 'Delete failed'); }
  };

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 pb-6">
        <div className="h-28 bg-white border border-gray-100 rounded-3xl animate-pulse mb-5" />
        <div className="h-64 bg-white border border-gray-100 rounded-3xl animate-pulse" />
      </div>
    );
  }
  if (error || !record) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        <Link to="/portfolio" className="md:hidden inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"><ArrowLeft size={15} /> {all.nav.company}</Link>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center"><p className="text-sm font-medium text-red-600">{error || 'Record not found'}</p></div>
      </div>
    );
  }

  const pill = (value: string, list: typeof options.stage, tone?: string) => (
    <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', tone ?? 'bg-gray-100 text-gray-600')}>{optionLabel(list, value)}</span>
  );

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-12">
      {showDeleteModal && (
        <DeleteConfirmModal title="Delete Company" message={`Are you sure you want to delete "${record.companyName || 'this company'}"? This action cannot be undone.`}
          onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} deleting={deleting} />
      )}

      <div className="pt-2 pb-4">
        <Link to="/portfolio" className="md:hidden inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors"><ArrowLeft size={15} /> {all.nav.company}</Link>
      </div>

      {/* Header: the company's real logo and live CRM facts */}
      <div className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <CompanyLogo name={record.companyName || '?'} website={record.website} logoUrl={profile?.logo} size={16} className="flex-shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight break-words">{record.companyName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {record.industry && pill(record.industry, options.industry)}
              {record.stage && pill(record.stage, options.stage, 'bg-violet-50 text-violet-600')}
              {record.status && pill(record.status, options.status, TONE[record.status.toLowerCase()] ?? undefined)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-gray-400">
              {record.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{record.location}</span>}
              {record.website && <span className="inline-flex items-center gap-1"><Globe size={11} />{record.website.replace(/^https?:\/\//, '')}</span>}
              {record.modifiedTime && <span className="inline-flex items-center gap-1"><Clock size={11} />{t.colLastUpdated}: {formatDate(record.modifiedTime, locale)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to={`/portfolio/${id}/edit`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors">
              <Edit2 size={13} /><span className="hidden sm:inline">{all.common.edit}</span>
            </Link>
            <button onClick={() => setShowDeleteModal(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-500 bg-white border border-rose-100 px-3 py-1.5 rounded-xl hover:bg-rose-50 transition-colors">
              <Trash2 size={13} /><span className="hidden sm:inline">{all.common.delete}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex p-1 bg-gray-100/80 rounded-2xl overflow-x-auto max-w-full mb-5" role="tablist">
        {tabs.map(tab => (
          <button key={tab.key} role="tab" aria-selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all', activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab record={record} founderData={profile?.data ?? null} investments={investments} options={options}
          founderPhotoUrl={founderPhotoUrl} locale={locale} t={t} />
      )}
      {activeTab === 'finance' && (
        <FinanceReportsPanel mode="investor" founderCompanyId={founderEmail ? (profile === undefined ? undefined : profile?.recordId ?? null) : null}
          companyName={record.companyName} user={{ name: currentUser?.name ?? '', email: currentUser?.email ?? '' }} t={all.finance} locale={locale} />
      )}
      {activeTab === 'activities' && <ActivitiesTab companyId={record.id} companyName={record.companyName} locale={locale} t={t} />}
      {activeTab === 'documents' && <DocumentsTab companyName={record.companyName} locale={locale} t={t} />}
      {activeTab === 'milestones' && (
        <MilestonesTab companyId={record.id} initialJson={record.milestones} founderOutlook={profile?.data?.nextMilestones ?? ''} locale={locale} t={t} />
      )}
    </div>
  );
}

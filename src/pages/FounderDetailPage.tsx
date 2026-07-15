import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Globe, MapPin, Users, DollarSign,
  Mail, Phone, Link as LinkIcon, ExternalLink, Loader2,
  Target, Shield, Lightbulb, FileText,
} from 'lucide-react';
import { getCRMPortfolioRecord, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { fetchCompanyProfile, type CompanyData, EMPTY } from '../services/companyProfile';
import { Avatar } from '../components/ui/Avatar';
import { loadToken } from '../services/oauth';
import { useLanguage } from '../context/LanguageContext';

function fmt(val: string, prefix = '$') {
  if (!val) return '';
  const n = parseFloat(val.replace(/[,$]/g, ''));
  if (isNaN(n) || n === 0) return val;
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n}`;
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-indigo-500" />
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          {value} <ExternalLink size={11} />
        </a>
      ) : (
        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-line">{value}</p>
      )}
    </div>
  );
}

function MetricCard({ label, value, color = 'text-gray-900' }: { label: string; value: string; color?: string }) {
  if (!value) return null;
  return (
    <div className="text-center p-3 bg-gray-50 rounded-xl">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 uppercase mt-0.5">{label}</p>
    </div>
  );
}

type Tab = 'profile' | 'business' | 'pitch';

export default function FounderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [company, setCompany] = useState<CRMPortfolioRecord | null>(null);
  const [profile, setProfile] = useState<CompanyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCRMPortfolioRecord(id)
      .then(async (record) => {
        setCompany(record);
        if (record?.founderEmail) {
          const result = await fetchCompanyProfile(record.founderEmail).catch(() => ({ data: EMPTY, logo: null }));
          setProfile(result.data);

          const token = loadToken();
          fetch('/api/profile?contactPhotos=1', {
            headers: token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {},
          })
            .then(r => r.json())
            .then((json: { photos?: Record<string, string> }) => {
              const photo = json.photos?.[record.founderEmail!.toLowerCase()];
              if (photo) setPhotoUrl(photo);
            })
            .catch(() => {});
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <span className="ml-3 text-sm text-gray-500">{t.founderDetailPage.loadingDetails}</span>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <Link to="/founders" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} /> {t.founderDetailPage.backToFounders}
        </Link>
        <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl">
          <p className="text-sm text-gray-500">{error || t.founderDetailPage.notFound}</p>
        </div>
      </div>
    );
  }

  const c = company;
  const p = profile;
  const hasProfile = p.name || p.description || p.productDescription;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: t.founderDetailPage.tabProfile },
    { key: 'business', label: t.founderDetailPage.tabBusiness },
    { key: 'pitch', label: t.founderDetailPage.tabPitch },
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Back — hidden on mobile (handled by MobileHeader) */}
      <Link to="/founders" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={14} /> {t.founderDetailPage.backToFounders}
      </Link>

      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 sm:p-8 text-white mb-6">
        <div className="flex items-start gap-5">
          <div className="flex-shrink-0">
            <Avatar src={photoUrl || undefined} name={c.founderName || 'F'} size="xl" className="ring-2 ring-white/30" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">{c.founderName}</h1>
            {c.companyName && (
              <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
                <Building2 size={14} /> {c.companyName}
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-3">
              {c.founderEmail && (
                <a href={`mailto:${c.founderEmail}`} className="text-xs text-white/70 hover:text-white flex items-center gap-1">
                  <Mail size={12} /> {c.founderEmail}
                </a>
              )}
              {c.founderPhone && (
                <a href={`tel:${c.founderPhone}`} className="text-xs text-white/70 hover:text-white flex items-center gap-1">
                  <Phone size={12} /> {c.founderPhone}
                </a>
              )}
              {c.founderLinkedin && (
                <a href={c.founderLinkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-white/70 hover:text-white flex items-center gap-1">
                  <LinkIcon size={12} /> LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Company meta */}
        <div className="flex flex-wrap gap-2 mt-5">
          {c.stage && <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">{c.stage}</span>}
          {c.industry && <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">{c.industry}</span>}
          {c.status && <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">{c.status}</span>}
          {c.location && <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1"><MapPin size={10} /> {c.location}</span>}
          {c.website && (
            <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer"
              className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1 hover:bg-white/30">
              <Globe size={10} /> {t.founderDetailPage.website}
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-xs font-medium py-2 px-3 rounded-lg transition-all ${
              activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Section title={t.founderDetailPage.companyOverview} icon={Building2}>
              <div className="space-y-4">
                <Field label={t.founderDetailPage.companyName} value={p.name || c.companyName} />
                <Field label={t.founderDetailPage.tagline} value={p.tagline} />
                <Field label={t.founderDetailPage.description} value={p.description || c.fullDescription || c.shortDescription} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t.founderDetailPage.industry} value={p.industry || c.industry} />
                  <Field label={t.founderDetailPage.stage} value={p.stage || c.stage} />
                  <Field label={t.founderDetailPage.founded} value={p.foundedYear || c.foundedYear} />
                  <Field label={t.founderDetailPage.location} value={p.location || c.location} />
                </div>
                <Field label={t.founderDetailPage.website} value={p.website || c.website} href={p.website || c.website} />
              </div>
            </Section>

            <Section title={t.founderDetailPage.foundingTeam} icon={Users}>
              <div className="space-y-4">
                <Field label={t.founderDetailPage.founderNames} value={p.founderNames || c.founderName} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t.founderDetailPage.teamSize} value={p.teamSize || c.teamSize} />
                  <Field label={t.founderDetailPage.openRoles} value={p.openRoles} />
                </div>
              </div>
            </Section>

            <Section title={t.founderDetailPage.productTraction} icon={Lightbulb}>
              <div className="space-y-4">
                <Field label={t.founderDetailPage.productDescription} value={p.productDescription} />
                <Field label={t.founderDetailPage.revenueModel} value={p.revenueModel} />
                <Field label={t.founderDetailPage.targetMarket} value={p.targetMarket} />
              </div>
            </Section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{t.founderDetailPage.keyMetrics}</h3>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="MRR" value={fmt(p.mrr)} color="text-emerald-600" />
                <MetricCard label="ARR" value={fmt(p.arr)} color="text-indigo-600" />
                <MetricCard label={t.founderDetailPage.customers} value={p.activeCustomers} color="text-purple-600" />
                <MetricCard label={t.founderDetailPage.momGrowth} value={p.momGrowth ? `${p.momGrowth}%` : ''} color="text-blue-600" />
                <MetricCard label={t.founderDetailPage.churnRate} value={p.churnRate ? `${p.churnRate}%` : ''} color="text-red-500" />
                <MetricCard label="NPS" value={p.nps} color="text-amber-600" />
              </div>
            </div>

            {/* Investment */}
            {(c.investmentAmount || c.investmentDate || c.preMoneyValuation) && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{t.founderDetailPage.investment}</h3>
                <div className="space-y-3">
                  <Field label={t.founderDetailPage.amount} value={c.investmentAmount ? fmt(c.investmentAmount) : ''} />
                  <Field label={t.founderDetailPage.date} value={c.investmentDate} />
                  <Field label={t.founderDetailPage.preMoneyValuation} value={c.preMoneyValuation ? fmt(c.preMoneyValuation) : ''} />
                  <Field label={t.founderDetailPage.ownership} value={c.ownershipPct ? `${c.ownershipPct}%` : ''} />
                </div>
              </div>
            )}

            {/* Notes */}
            {c.notes && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{t.founderDetailPage.notes}</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">{c.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'business' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Section title={t.founderDetailPage.financialsFunding} icon={DollarSign}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t.founderDetailPage.totalRaised} value={fmt(p.totalRaised)} />
                  <Field label={t.founderDetailPage.lastRoundSize} value={fmt(p.lastRoundSize)} />
                  <Field label={t.founderDetailPage.lastRoundStage} value={p.lastRoundStage} />
                  <Field label={t.founderDetailPage.lastRoundDate} value={p.lastRoundDate} />
                  <Field label={t.founderDetailPage.preMoneyValuation} value={fmt(p.preMoneyValuation)} />
                  <Field label={t.founderDetailPage.monthlyBurn} value={fmt(p.monthlyBurn)} />
                </div>
                <Field label={t.founderDetailPage.runway} value={p.runway} />
              </div>
            </Section>

            <Section title={t.founderDetailPage.marketCompetition} icon={Target}>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="TAM" value={fmt(p.tam)} />
                  <Field label="SAM" value={fmt(p.sam)} />
                  <Field label="SOM" value={fmt(p.som)} />
                </div>
                <Field label={t.founderDetailPage.targetMarket} value={p.targetMarket} />
                <Field label={t.founderDetailPage.keyCompetitors} value={p.keyCompetitors} />
                <Field label={t.founderDetailPage.differentiator} value={p.differentiator} />
              </div>
            </Section>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{t.founderDetailPage.marketSize}</h3>
              <div className="space-y-2">
                <MetricCard label="TAM" value={fmt(p.tam)} color="text-indigo-600" />
                <MetricCard label="SAM" value={fmt(p.sam)} color="text-blue-600" />
                <MetricCard label="SOM" value={fmt(p.som)} color="text-purple-600" />
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{t.founderDetailPage.fundingSnapshot}</h3>
              <div className="space-y-2">
                <MetricCard label={t.founderDetailPage.totalRaised} value={fmt(p.totalRaised)} color="text-emerald-600" />
                <MetricCard label={t.founderDetailPage.monthlyBurn} value={fmt(p.monthlyBurn)} color="text-red-500" />
                <MetricCard label={t.founderDetailPage.runway} value={p.runway} color="text-amber-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pitch' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Section title={t.founderDetailPage.currentRoundAsk} icon={Shield}>
              <div className="space-y-4">
                <Field label={t.founderDetailPage.currentAsk} value={p.currentAsk} />
                <Field label={t.founderDetailPage.useOfFunds} value={p.useOfFunds} />
                <Field label={t.founderDetailPage.keyRisks} value={p.keyRisks} />
              </div>
            </Section>

            {(p.description || c.fullDescription) && (
              <Section title={t.founderDetailPage.fullDescription} icon={FileText}>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {p.description || c.fullDescription}
                </p>
              </Section>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{t.founderDetailPage.nextMilestones}</h3>
              {p.nextMilestones ? (
                <p className="text-sm text-gray-700 whitespace-pre-line">{p.nextMilestones}</p>
              ) : (
                <p className="text-sm text-gray-300 italic">{t.founderDetailPage.notSet}</p>
              )}
            </div>

            {c.tags && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">{t.founderDetailPage.tags}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {c.tags.split(',').map(tg => tg.trim()).filter(Boolean).map(tag => (
                    <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

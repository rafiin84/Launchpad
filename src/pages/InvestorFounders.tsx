import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Globe, MapPin, List, LayoutGrid,
  Loader2, Search, Users, ExternalLink, Mail, Phone, Link as LinkIcon,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { fetchCRMPortfolio, type CRMPortfolioRecord } from '../services/crmPortfolio';
import { fetchAllCompanyProfiles } from '../services/companyProfile';
import { CompanyLogo } from '../components/ui/CompanyLogo';
import { useLanguage } from '../context/LanguageContext';
import { usePageTitle } from '../context/PageTitleContext';

type ViewMode = 'list' | 'grid';

function FounderRow({ company, logoUrl }: { company: CRMPortfolioRecord; logoUrl?: string | null }) {
  const { t } = useLanguage();
  return (
    <Link
      to={`/founders/${company.id}`}
      className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors group"
    >
      <div className="flex-shrink-0">
        <CompanyLogo name={company.companyName || company.founderName || '?'} website={company.website} logoUrl={logoUrl} size={10} />
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-x-6 gap-y-0.5 items-center">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
            {company.founderName || t.investorFounders.unknownFounder}
          </h3>
          {company.companyName && (
            <p className="text-xs text-gray-500 truncate flex items-center gap-1">
              <Building2 size={10} className="text-gray-400 flex-shrink-0" /> {company.companyName}
            </p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-3 min-w-0">
          {company.industry && (
            <span className="text-xs text-gray-500 truncate">{company.industry}</span>
          )}
          {company.stage && (
            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
              {company.stage}
            </span>
          )}
          {company.status && (
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0',
              company.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
            )}>
              {company.status}
            </span>
          )}
          {company.location && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0">
              <MapPin size={9} /> {company.location}
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          {company.founderEmail && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Mail size={9} /> {company.founderEmail}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
    </Link>
  );
}

function FounderCard({ company, logoUrl }: { company: CRMPortfolioRecord; logoUrl?: string | null }) {
  const { t } = useLanguage();
  return (
    <Link
      to={`/founders/${company.id}`}
      className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <CompanyLogo name={company.companyName || company.founderName || '?'} website={company.website} logoUrl={logoUrl} size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
            {company.founderName || t.investorFounders.unknownFounder}
          </h3>
          {company.companyName && (
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              <Building2 size={11} className="text-gray-400" />
              {company.companyName}
            </p>
          )}
          {company.industry && (
            <p className="text-xs text-gray-500 mt-0.5">{company.industry}{company.stage ? ` · ${company.stage}` : ''}</p>
          )}
        </div>
        <ExternalLink size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {company.stage && (
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
            {company.stage}
          </span>
        )}
        {company.status && (
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full font-semibold',
            company.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
          )}>
            {company.status}
          </span>
        )}
        {company.location && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
            <MapPin size={8} /> {company.location}
          </span>
        )}
        {company.website && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
            <Globe size={8} /> {company.website.replace(/https?:\/\//, '').replace(/\/$/, '')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-50">
        {company.founderEmail && (
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Mail size={9} /> {company.founderEmail}
          </p>
        )}
        {company.founderPhone && (
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Phone size={9} /> {company.founderPhone}
          </p>
        )}
        {company.founderLinkedin && (
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <LinkIcon size={9} /> LinkedIn
          </p>
        )}
      </div>
    </Link>
  );
}

export default function InvestorFounders() {
  const { t } = useLanguage();
  const { setPageTitle } = usePageTitle();
  const [companies, setCompanies] = useState<CRMPortfolioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [logoMap, setLogoMap] = useState<Record<string, string>>({});

  useEffect(() => { setPageTitle(t.investorFounders.title, t.investorFounders.description); return () => setPageTitle(null); }, [t]);

  useEffect(() => {
    fetchCRMPortfolio()
      .then(records => setCompanies(records.filter(r => r.founderName)))
      .catch(err => console.error('[Founders] Failed to load:', err))
      .finally(() => setLoading(false));

    fetchAllCompanyProfiles().then(profiles => {
      const map: Record<string, string> = {};
      for (const p of profiles) {
        if (p.logo && p.email) map[p.email.toLowerCase()] = p.logo;
        if (p.logo && p.data.name) map[p.data.name.toLowerCase()] = p.logo;
      }
      setLogoMap(map);
    }).catch(() => {});
  }, []);

  const filtered = companies.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.founderName.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q) ||
      c.founderEmail?.toLowerCase().includes(q) ||
      c.industry?.toLowerCase().includes(q) ||
      c.location?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Search + Controls */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.investorFounders.searchPlaceholder}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setView('grid')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                view === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <span className="ml-3 text-sm text-gray-500">{t.investorFounders.loadingFounders}</span>
        </div>
      )}

      {/* Empty */}
      {!loading && companies.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl bg-white">
          <Users size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">{t.investorFounders.noFoundersYet}</p>
          <p className="text-xs text-gray-400">{t.investorFounders.noFoundersDesc}</p>
        </div>
      )}

      {/* No search results */}
      {!loading && companies.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <Search size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{t.investorFounders.noMatch} "{search}"</p>
        </div>
      )}

      {/* List view */}
      {filtered.length > 0 && view === 'list' && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {filtered.map(c => (
            <FounderRow key={c.id} company={c} logoUrl={logoMap[c.founderEmail?.toLowerCase() || ''] || logoMap[c.companyName?.toLowerCase() || '']} />
          ))}
        </div>
      )}

      {/* Grid view */}
      {filtered.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <FounderCard key={c.id} company={c} logoUrl={logoMap[c.founderEmail?.toLowerCase() || ''] || logoMap[c.companyName?.toLowerCase() || '']} />
          ))}
        </div>
      )}
    </div>
  );
}

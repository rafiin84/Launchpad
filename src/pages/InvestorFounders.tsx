import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Globe, MapPin, TrendingUp, DollarSign,
  Loader2, Search, AlertCircle, Users, ExternalLink,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { fetchAllCompanyProfiles, type CompanyData } from '../services/companyProfile';

interface FounderProfile {
  email: string;
  data: CompanyData;
}

function fmt(val: string, prefix = '$') {
  if (!val) return '';
  const n = parseFloat(val.replace(/[,$]/g, ''));
  if (isNaN(n) || n === 0) return val;
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n}`;
}

function FounderCard({ profile }: { profile: FounderProfile }) {
  const d = profile.data;
  const hasMetrics = d.mrr || d.arr || d.activeCustomers;

  return (
    <Link
      to={`/company?email=${encodeURIComponent(profile.email)}`}
      className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Building2 size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
            {d.name || profile.email}
          </h3>
          {d.founderNames && (
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              <Users size={11} className="text-gray-400" />
              {d.founderNames}
            </p>
          )}
          {d.industry && (
            <p className="text-xs text-gray-500 mt-0.5">{d.industry}{d.stage ? ` · ${d.stage}` : ''}</p>
          )}
        </div>
        <ExternalLink size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {d.stage && (
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
            {d.stage}
          </span>
        )}
        {d.location && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
            <MapPin size={8} /> {d.location}
          </span>
        )}
        {d.website && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
            <Globe size={8} /> {d.website.replace(/https?:\/\//, '').replace(/\/$/, '')}
          </span>
        )}
      </div>

      {/* Key metrics */}
      {hasMetrics && (
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
          {d.mrr && (
            <div className="text-center">
              <p className="text-xs font-bold text-emerald-600">{fmt(d.mrr)}</p>
              <p className="text-[9px] text-gray-400 uppercase">MRR</p>
            </div>
          )}
          {d.arr && (
            <div className="text-center">
              <p className="text-xs font-bold text-indigo-600">{fmt(d.arr)}</p>
              <p className="text-[9px] text-gray-400 uppercase">ARR</p>
            </div>
          )}
          {d.activeCustomers && (
            <div className="text-center">
              <p className="text-xs font-bold text-purple-600">{d.activeCustomers}</p>
              <p className="text-[9px] text-gray-400 uppercase">Customers</p>
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

export default function InvestorFounders() {
  const [profiles, setProfiles] = useState<FounderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAllCompanyProfiles()
      .then(setProfiles)
      .finally(() => setLoading(false));
  }, []);

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    const d = p.data;
    return (
      p.email.toLowerCase().includes(q) ||
      d.name?.toLowerCase().includes(q) ||
      d.founderNames?.toLowerCase().includes(q) ||
      d.industry?.toLowerCase().includes(q) ||
      d.location?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Founders</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Founder company profiles
            {!loading && profiles.length > 0 && (
              <span className="ml-1.5 text-gray-300">· {profiles.length} companies</span>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      {!loading && profiles.length > 0 && (
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by company, founder, industry, location…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <span className="ml-3 text-sm text-gray-500">Loading founder companies...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && profiles.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl bg-white">
          <Building2 size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No founder companies yet</p>
          <p className="text-xs text-gray-400">Founder company profiles will appear here once founders update their profiles.</p>
        </div>
      )}

      {/* No search results */}
      {!loading && profiles.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <Search size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No companies match "{search}"</p>
        </div>
      )}

      {/* Company grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <FounderCard key={p.email} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}

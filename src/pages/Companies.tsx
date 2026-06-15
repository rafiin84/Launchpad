import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Users, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { companiesService } from '../services/companiesService';
import type { Company } from '../types';
import { Input } from '../components/ui/Input';
import { StageBadge } from '../components/ui/Badge';
import { PageHeader } from '../components/layout/PageHeader';

function CompanyCard({ company }: { company: Company }) {
  return (
    <Link to={`/companies/${company.id}`}>
      <div className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-sm transition-all group">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
            <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {company.name}
              </h3>
              <StageBadge stage={company.stage} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">{company.industry}</p>
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
              {company.shortDescription || company.description}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users size={13} />
            {company.founders.length} founder{company.founders.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar size={13} />
            Founded {company.foundedYear}
          </div>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 ml-auto"
            >
              <ExternalLink size={12} />
              Website
            </a>
          )}
        </div>

        {/* Tags */}
        {company.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {company.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companiesService.getAll().then((data) => {
      setCompanies(data);
      setLoading(false);
    });
  }, []);

  const filtered = query
    ? companies.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.industry.toLowerCase().includes(query.toLowerCase()) ||
          c.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
      )
    : companies;

  const stages = ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'];

  return (
    <div className="max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Portfolio Companies"
        description="The founders and companies in our network"
      />

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search by name, industry, or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Search size={16} />}
        />
      </div>

      {/* Stage filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setQuery('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${!query ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All
        </button>
        {stages.map((stage) => (
          <button
            key={stage}
            onClick={() => setQuery(stage)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all capitalize"
          >
            {stage.replace('-', ' ').replace('series', 'Series')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-4">{filtered.length} companies</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

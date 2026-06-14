import React, { useState, useEffect } from 'react';
import { Search, BookOpen, ThumbsUp, Eye, Sparkles, ChevronRight } from 'lucide-react';
import { knowledgeService } from '../services/knowledgeService';
import type { KnowledgeArticle, KnowledgeCategory } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/layout/PageHeader';
import { TimeAgo } from '../components/ui/TimeAgo';
import { cn } from '../lib/cn';

const CATEGORIES: KnowledgeCategory[] = [
  'Product Strategy',
  'Pricing',
  'Fundraising',
  'Enterprise Sales',
  'AI',
  'Partnerships',
  'Marketing',
  'Scaling',
  'Operations',
  'Legal',
];

const categoryColors: Record<string, string> = {
  'Product Strategy': 'bg-indigo-50 text-indigo-700',
  Pricing: 'bg-amber-50 text-amber-700',
  Fundraising: 'bg-purple-50 text-purple-700',
  'Enterprise Sales': 'bg-blue-50 text-blue-700',
  AI: 'bg-emerald-50 text-emerald-700',
  Partnerships: 'bg-sky-50 text-sky-700',
  Marketing: 'bg-rose-50 text-rose-700',
  Scaling: 'bg-orange-50 text-orange-700',
  Operations: 'bg-gray-100 text-gray-700',
  Legal: 'bg-slate-50 text-slate-700',
};

function ArticleCard({ article, onClick }: { article: KnowledgeArticle; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', categoryColors[article.category] || 'bg-gray-100 text-gray-700')}>
          {article.category}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors leading-snug mb-1.5">
        {article.title}
      </h3>
      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">{article.summary}</p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Avatar src={article.author.avatar} name={article.author.name} size="xs" />
          <span className="text-xs text-gray-500">{article.author.name}</span>
        </div>
        <span className="text-gray-200">·</span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <ThumbsUp size={12} />
          {article.helpful}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Eye size={12} />
          {article.views}
        </span>
        <TimeAgo date={article.createdAt} className="text-xs text-gray-400 ml-auto" />
      </div>
    </div>
  );
}

function ArticleDetail({ article, onClose }: { article: KnowledgeArticle; onClose: () => void }) {
  const [marked, setMarked] = useState(false);

  const handleHelpful = async () => {
    if (marked) return;
    await knowledgeService.markHelpful(article.id);
    setMarked(true);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl">
      {/* Article header */}
      <div className="p-6 border-b border-gray-100">
        <button onClick={onClose} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-4">
          ← Back to Knowledge Hub
        </button>
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', categoryColors[article.category] || 'bg-gray-100 text-gray-700')}>
          {article.category}
        </span>
        <h1 className="text-xl font-bold text-gray-900 mt-3 mb-2 leading-tight">{article.title}</h1>
        <p className="text-sm text-gray-600 leading-relaxed">{article.summary}</p>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Avatar src={article.author.avatar} name={article.author.name} size="sm" />
            <div>
              <p className="text-xs font-medium text-gray-900">{article.author.name}</p>
              <TimeAgo date={article.createdAt} className="text-xs text-gray-400" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-gray-400"><Eye size={12} /> {article.views}</span>
            <button
              onClick={handleHelpful}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                marked ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <ThumbsUp size={13} />
              {article.helpful + (marked ? 1 : 0)} helpful
            </button>
          </div>
        </div>
      </div>

      {/* Article content */}
      <div className="p-6">
        <div className="prose prose-sm prose-gray max-w-none">
          {article.content.split('\n\n').map((paragraph, i) => {
            if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
              return <h3 key={i} className="text-sm font-bold text-gray-900 mt-4 mb-1">{paragraph.replace(/\*\*/g, '')}</h3>;
            }
            if (paragraph.startsWith('→') || paragraph.startsWith('- ')) {
              return (
                <ul key={i} className="space-y-1 my-2">
                  {paragraph.split('\n').map((line, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-indigo-400 mt-0.5">•</span>
                      <span>{line.replace(/^[→\-]\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            return <p key={i} className="text-sm text-gray-700 leading-relaxed mb-3">{paragraph}</p>;
          })}
        </div>

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-6 pt-4 border-t border-gray-100">
            {article.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Knowledge() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory | 'All'>('All');
  const [selected, setSelected] = useState<KnowledgeArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    knowledgeService.getAll().then((data) => {
      setArticles(data);
      setLoading(false);
    });
  }, []);

  const filtered = articles.filter((a) => {
    const matchesCat = category === 'All' || a.category === category;
    const matchesQuery = !query || a.title.toLowerCase().includes(query.toLowerCase()) || a.summary.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQuery;
  });

  if (selected) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <ArticleDetail article={selected} onClose={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Knowledge Hub"
        description="Founder wisdom, investor insights, and lessons that compound over time"
      />

      {/* AI banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">AI Knowledge Builder</p>
          <p className="text-xs text-indigo-200 mt-0.5">Great conversations are automatically converted into searchable knowledge articles.</p>
        </div>
      </div>

      <div className="mb-5">
        <Input
          placeholder="Search knowledge articles..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Search size={16} />}
        />
      </div>

      {/* Mobile category scroll */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4 sm:hidden">
        {(['All', ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
              category === cat ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Category sidebar — desktop only */}
        <div className="w-48 flex-shrink-0 hidden md:block">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Topics</p>
          <div className="space-y-1">
            <button
              onClick={() => setCategory('All')}
              className={cn('w-full text-left px-3 py-2 rounded-xl text-sm transition-all', category === 'All' ? 'bg-black text-white font-medium' : 'text-gray-600 hover:bg-gray-100')}
            >
              All Topics
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn('w-full text-left px-3 py-2 rounded-xl text-sm transition-all', category === cat ? 'bg-black text-white font-medium' : 'text-gray-600 hover:bg-gray-100')}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Articles */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4">{filtered.length} articles</p>
              <div className="space-y-3">
                {filtered.map((article) => (
                  <ArticleCard key={article.id} article={article} onClick={() => setSelected(article)} />
                ))}
                {filtered.length === 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
                    <BookOpen size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No articles found</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

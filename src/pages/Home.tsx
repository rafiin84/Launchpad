import React, { useState, useEffect } from 'react';
import { Trophy, HelpCircle, ArrowLeftRight, Lightbulb, Sparkles, TrendingUp, Users, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postsService } from '../services/postsService';
import type { Post, PostType } from '../types';
import { FeedCard } from '../components/feed/FeedCard';
import { CreatePost } from '../components/feed/CreatePost';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { mockUsers, mockCompanies, mockMilestones } from '../data/mockData';

// ─── Sidebar widgets ──────────────────────────────────────────────────────────

function RecentWinsWidget() {
  const wins = mockMilestones.slice(0, 3);
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Trophy size={15} className="text-emerald-500" />
        Recent Wins
      </h3>
      <div className="space-y-3">
        {wins.map((m) => {
          const company = mockCompanies.find((c) => c.id === m.companyId);
          return (
            <div key={m.id} className="flex gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                {company && <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 leading-snug">{m.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{company?.name}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SuggestedConnectionsWidget() {
  const founders = mockUsers.filter((u) => u.role === 'founder').slice(0, 3);
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Users size={15} className="text-indigo-500" />
        Suggested Connections
      </h3>
      <div className="space-y-3">
        {founders.map((user) => (
          <div key={user.id} className="flex items-center gap-2.5">
            <Avatar src={user.avatar} name={user.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.company?.name}</p>
            </div>
            <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex-shrink-0">
              Connect
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TrendingWidget() {
  const topics = [
    { label: 'Enterprise Pricing', count: 12 },
    { label: 'AI Product Strategy', count: 9 },
    { label: 'Series A Fundraising', count: 8 },
    { label: 'PLG Strategies', count: 7 },
    { label: 'Hiring Eng Leaders', count: 5 },
  ];
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <TrendingUp size={15} className="text-amber-500" />
        Trending Topics
      </h3>
      <div className="space-y-2">
        {topics.map((t, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-xs text-gray-700">{t.label}</span>
            <span className="text-xs text-gray-400">{t.count} posts</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AIInsightsWidget() {
  return (
    <Card padding="md" className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Sparkles size={13} className="text-white" />
        </div>
        <h3 className="text-sm font-semibold text-indigo-900">AI Portfolio Digest</h3>
      </div>
      <p className="text-xs text-indigo-800 leading-relaxed">
        <strong>This week:</strong> 3 portfolio companies shared revenue milestones. Enterprise pricing and PLG are the most-discussed topics. SynthFlow and HealthBridge are getting the most engagement.
      </p>
      <button className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">
        View full digest →
      </button>
    </Card>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────

function InvestorHome() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<PostType | 'all'>('all');

  useEffect(() => {
    postsService.getFeed().then(setPosts);
  }, []);

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.type === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Main feed */}
        <div className="flex-1 min-w-0">
          {/* Welcome */}
          <div className="mb-5">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Good morning, {currentUser.name.split(' ')[0]} 👋</h1>
            <p className="text-gray-500 mt-1 text-sm">Here's what your portfolio is up to.</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Portfolio', value: '6' },
              { label: 'Active deals', value: '3' },
              { label: 'Applications', value: '2' },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-2xl px-3 sm:px-5 py-4">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Feed filter */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Filter size={13} className="text-gray-400 flex-shrink-0" />
            {(['all', 'win', 'advice', 'introduction', 'insight'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  filter === f ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filtered.map((post) => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        </div>

        {/* Right sidebar — hidden on mobile */}
        <div className="hidden lg:block w-72 flex-shrink-0 space-y-4">
          <AIInsightsWidget />
          <RecentWinsWidget />
          <TrendingWidget />
        </div>
      </div>
    </div>
  );
}

function FounderHome() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<PostType | 'all'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    postsService.getFeed().then(setPosts);
  }, [refreshKey]);

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.type === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Main feed */}
        <div className="flex-1 min-w-0">
          {/* Hero */}
          <div className="mb-5">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Welcome back, {currentUser.name.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentUser.company
                ? `Building ${currentUser.company.name} · Share what's happening`
                : "Share what's happening with your startup"}
            </p>
          </div>

          {/* Hero actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {[
              { type: 'win' as PostType, label: 'Share a Win', emoji: '🚀', desc: 'Launch, revenue, team', bg: 'bg-emerald-50 hover:bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-100' },
              { type: 'advice' as PostType, label: 'Ask for Advice', emoji: '💡', desc: 'Pricing, strategy, product', bg: 'bg-indigo-50 hover:bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-100' },
              { type: 'introduction' as PostType, label: 'Request an Intro', emoji: '🤝', desc: 'Customers, partners, experts', bg: 'bg-amber-50 hover:bg-amber-100', text: 'text-amber-800', border: 'border-amber-100' },
            ].map((action) => (
              <button
                key={action.type}
                className={`flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0 p-4 rounded-2xl border transition-all text-left ${action.bg} ${action.border}`}
                onClick={() => {}}
              >
                <span className="text-2xl sm:mb-2 flex-shrink-0">{action.emoji}</span>
                <div>
                  <span className={`text-sm font-semibold ${action.text} block`}>{action.label}</span>
                  <span className={`text-xs mt-0.5 opacity-70 ${action.text} hidden sm:block`}>{action.desc}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Create post */}
          <div className="mb-5">
            <CreatePost onPost={() => setRefreshKey((k) => k + 1)} />
          </div>

          {/* Feed filter */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Filter size={13} className="text-gray-400 flex-shrink-0" />
            {(['all', 'win', 'advice', 'introduction', 'insight'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  filter === f ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
              </button>
            ))}
          </div>

          {/* Feed */}
          <div className="space-y-4">
            {filtered.map((post) => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        </div>

        {/* Right sidebar — hidden on mobile */}
        <div className="hidden lg:block w-72 flex-shrink-0 space-y-4">
          <RecentWinsWidget />
          <SuggestedConnectionsWidget />
          <TrendingWidget />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isInvestor } = useAuth();
  return isInvestor ? <InvestorHome /> : <FounderHome />;
}

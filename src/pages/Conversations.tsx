import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Pin, CheckCircle, Plus, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { conversationsService } from '../services/conversationsService';
import type { Conversation } from '../types';
import { Avatar, AvatarGroup } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { TimeAgo } from '../components/ui/TimeAgo';

const TOPICS = ['All', 'Enterprise Sales', 'Pricing', 'Fundraising', 'Scaling', 'Operations', 'Product Strategy'];

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const topicColors: Record<string, string> = {
    'Enterprise Sales': 'text-blue-700 bg-blue-50',
    Pricing: 'text-amber-700 bg-amber-50',
    Fundraising: 'text-purple-700 bg-purple-50',
    Scaling: 'text-emerald-700 bg-emerald-50',
    Operations: 'text-gray-700 bg-gray-100',
    'Product Strategy': 'text-indigo-700 bg-indigo-50',
  };
  const topicStyle = topicColors[conversation.topic] || 'text-gray-700 bg-gray-100';

  return (
    <Link to={`/conversations/${conversation.id}`}>
      <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all group">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {conversation.isPinned && (
                <Pin size={13} className="text-amber-500 flex-shrink-0" />
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${topicStyle}`}>
                {conversation.topic}
              </span>
              {conversation.isAnswered && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle size={12} />
                  Answered
                </span>
              )}
            </div>

            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors leading-snug mb-1">
              {conversation.title}
            </h3>
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{conversation.description}</p>

            <div className="flex items-center gap-3 mt-3">
              <AvatarGroup
                users={conversation.participants.map((p) => ({ name: p.name, avatar: p.avatar }))}
                max={4}
                size="xs"
              />
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MessageSquare size={12} />
                {conversation.messageCount} replies
              </span>
              <TimeAgo date={conversation.updatedAt} className="text-xs text-gray-400 ml-auto" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    conversationsService.getAll().then((data) => {
      setConversations(data);
      setLoading(false);
    });
  }, []);

  const filtered = conversations.filter((c) => {
    const matchesTopic = topic === 'All' || c.topic === topic;
    const matchesQuery = !query || c.title.toLowerCase().includes(query.toLowerCase()) || c.description.toLowerCase().includes(query.toLowerCase());
    return matchesTopic && matchesQuery;
  });

  const pinned = filtered.filter((c) => c.isPinned);
  const rest = filtered.filter((c) => !c.isPinned);

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Conversations"
        description="Persistent discussions that become institutional knowledge"
        action={<Button size="sm" icon={<Plus size={15} />}>New Thread</Button>}
      />

      <div className="mb-5">
        <Input
          placeholder="Search conversations..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Search size={16} />}
        />
      </div>

      {/* Topic filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              topic === t ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {pinned.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pinned</p>
              {pinned.map((c) => <ConversationRow key={c.id} conversation={c} />)}
              {rest.length > 0 && <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-4">Recent</p>}
            </>
          )}
          {rest.map((c) => <ConversationRow key={c.id} conversation={c} />)}
          {filtered.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
              <MessageSquare size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No conversations found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

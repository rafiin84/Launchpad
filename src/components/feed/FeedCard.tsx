import React, { useState } from 'react';
import { MessageCircle, Globe, Lock, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { Post } from '../../types';
import { Avatar } from '../ui/Avatar';
import { TimeAgo } from '../ui/TimeAgo';
import { PostTypePill } from './PostTypeIcon';
import { postsService } from '../../services/postsService';

interface FeedCardProps {
  post: Post;
  onUpdate?: (post: Post) => void;
}

const visibilityIcons = {
  portfolio: Globe,
  private: Lock,
  circle: Users,
};

const visibilityLabels = {
  portfolio: 'Portfolio',
  private: 'Private',
  circle: 'Circle',
};

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

export function FeedCard({ post, onUpdate }: FeedCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [localPost, setLocalPost] = useState(post);

  const VisibilityIcon = visibilityIcons[post.visibility];
  const contentLines = localPost.content.split('\n');
  const isLong = contentLines.length > 6 || localPost.content.length > 400;
  const displayContent = isLong && !expanded ? contentLines.slice(0, 5).join('\n') : localPost.content;

  const handleReact = async (emoji: string) => {
    const updated = await postsService.reactToPost(localPost.id, emoji);
    setLocalPost(updated);
    onUpdate?.(updated);
  };

  return (
    <article className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 transition-all">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <Avatar src={localPost.author.avatar} name={localPost.author.name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{localPost.author.name}</span>
            {localPost.author.company && (
              <span className="text-sm text-gray-500">· {localPost.author.company.name}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <TimeAgo date={localPost.createdAt} className="text-xs text-gray-400" />
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <VisibilityIcon size={11} />
              {visibilityLabels[localPost.visibility]}
            </span>
          </div>
        </div>
        <PostTypePill type={localPost.type} />
      </div>

      {/* Title */}
      {localPost.title && (
        <h3 className="text-base font-semibold text-gray-900 mb-2 leading-snug">{localPost.title}</h3>
      )}

      {/* Content */}
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {displayContent}
      </div>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          {expanded ? (
            <><ChevronUp size={14} /> Show less</>
          ) : (
            <><ChevronDown size={14} /> Read more</>
          )}
        </button>
      )}

      {/* Metrics */}
      {localPost.metrics && localPost.metrics.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {localPost.metrics.map((m, i) => (
            <MetricPill key={i} label={m.label} value={m.value} />
          ))}
        </div>
      )}

      {/* Tags */}
      {localPost.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {localPost.tags.map((tag) => (
            <span key={tag} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-4 pt-3 border-t border-gray-50">
        {/* Reactions */}
        <div className="flex items-center gap-1 flex-1 flex-wrap">
          {localPost.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => handleReact(r.emoji)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm transition-all',
                r.userReacted
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              )}
            >
              <span>{r.emoji}</span>
              <span className="text-xs font-medium">{r.count}</span>
            </button>
          ))}
          {localPost.reactions.length < 3 && (
            <button
              onClick={() => handleReact('👍')}
              className="px-2.5 py-1.5 rounded-xl text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-all"
            >
              +
            </button>
          )}
        </div>

        {/* Comment toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
            showComments ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
          )}
        >
          <MessageCircle size={14} />
          {localPost.comments.length > 0 ? localPost.comments.length : 'Reply'}
        </button>
      </div>

      {/* Comments */}
      {showComments && localPost.comments.length > 0 && (
        <div className="mt-4 space-y-3 pt-3 border-t border-gray-50">
          {localPost.comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar src={comment.author.avatar} name={comment.author.name} size="sm" />
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-900">{comment.author.name}</span>
                  <TimeAgo date={comment.createdAt} className="text-xs text-gray-400" />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                {comment.reactions.map((r) => (
                  <button
                    key={r.emoji}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs mt-1.5 mr-1',
                      r.userReacted ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-gray-600 border border-gray-200'
                    )}
                  >
                    {r.emoji} {r.count}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

import { useState } from 'react';
import {
  ThumbsUp, MessageCircle, Share2, Send, Globe,
  TrendingUp, BookMarked, Hash,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar';
import { TimeAgo } from '../components/ui/TimeAgo';
import { PostTypePill } from '../components/feed/PostTypeIcon';
import { PageHeader } from '../components/layout/PageHeader';
import {
  mockPosts,
  mockUsers,
  mockInvestments,
  mockConversations,
} from '../data/mockData';
import type { Post } from '../types';
import { cn } from '../lib/cn';

// ─── Images per post (2–4 each) ───────────────────────────────────────────────

const POST_IMAGES: Record<string, string[]> = {
  'p-1': [
    'https://picsum.photos/seed/synth-a/520/260',
    'https://picsum.photos/seed/synth-b/258/160',
    'https://picsum.photos/seed/synth-c/258/160',
  ],
  'p-2': [
    'https://picsum.photos/seed/carbon-a/258/200',
    'https://picsum.photos/seed/carbon-b/258/200',
  ],
  'p-3': [
    'https://picsum.photos/seed/stack-a/258/200',
    'https://picsum.photos/seed/stack-b/258/200',
    'https://picsum.photos/seed/stack-c/258/200',
    'https://picsum.photos/seed/stack-d/258/200',
  ],
  'p-4': [
    'https://picsum.photos/seed/health-a/520/260',
    'https://picsum.photos/seed/health-b/258/160',
    'https://picsum.photos/seed/health-c/258/160',
  ],
  'p-5': [
    'https://picsum.photos/seed/supply-a/258/200',
    'https://picsum.photos/seed/supply-b/258/200',
  ],
  'p-6': [
    'https://picsum.photos/seed/legal-a/258/160',
    'https://picsum.photos/seed/legal-b/258/160',
    'https://picsum.photos/seed/legal-c/258/160',
    'https://picsum.photos/seed/legal-d/258/160',
  ],
};

// ─── Image grid layouts ────────────────────────────────────────────────────────

function PostImages({ postId }: { postId: string }) {
  const images = POST_IMAGES[postId];
  if (!images || images.length === 0) return null;
  const n = images.length;

  if (n === 1) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden">
        <img src={images[0]} alt="" className="w-full h-[220px] object-cover" loading="lazy" />
      </div>
    );
  }

  if (n === 2) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <img src={images[0]} alt="" className="w-full h-[180px] object-cover" loading="lazy" />
        <img src={images[1]} alt="" className="w-full h-[180px] object-cover" loading="lazy" />
      </div>
    );
  }

  if (n === 3) {
    return (
      <div
        className="mt-3 rounded-xl overflow-hidden"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '110px 110px', gap: 2 }}
      >
        <img src={images[0]} alt="" style={{ gridRow: '1 / 3' }} className="w-full h-full object-cover" loading="lazy" />
        <img src={images[1]} alt="" className="w-full h-full object-cover" loading="lazy" />
        <img src={images[2]} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }

  // 4 images — 2×2
  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '130px 130px', gap: 2 }}>
      {images.map((src, i) => (
        <img key={i} src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
      ))}
    </div>
  );
}

// ─── Activity post card ────────────────────────────────────────────────────────

function ActivityPost({ post }: { post: Post }) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(
    post.reactions.reduce((sum, r) => sum + r.count, 0)
  );
  const [shared, setShared] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const [commentText, setCommentText] = useState('');

  const lines = post.content.split('\n');
  const isLong = lines.length > 5 || post.content.length > 350;
  const display = isLong && !expanded ? lines.slice(0, 4).join('\n') : post.content;

  const handleLike = () => {
    setLiked(v => {
      setLikeCount(c => v ? c - 1 : c + 1);
      return !v;
    });
  };

  const handleShare = () => {
    if (!shared) {
      setShared(true);
      setShareCount(c => c + 1);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <article className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-all">
      {/* Company banner */}
      {post.company && (
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-50 bg-gradient-to-r from-gray-50/70 to-white">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
            <img src={post.company.logo} alt={post.company.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900">{post.company.name}</p>
            <p className="text-xs text-gray-500">{post.company.industry}</p>
          </div>
          <PostTypePill type={post.type} />
        </div>
      )}

      <div className="px-5 py-4">
        {/* Author */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar src={post.author.avatar} name={post.author.name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{post.author.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {post.author.bio ? post.author.bio.split('.')[0] : 'Founder'}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <TimeAgo date={post.createdAt} className="text-xs text-gray-400" />
              <span className="text-gray-200">·</span>
              <Globe size={10} className="text-gray-400" />
            </div>
          </div>
          {!post.company && <PostTypePill type={post.type} />}
        </div>

        {/* Title */}
        {post.title && (
          <h3 className="text-sm font-semibold text-gray-900 mb-2 leading-snug">{post.title}</h3>
        )}

        {/* Content */}
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{display}</div>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1"
          >
            {expanded ? 'Show less' : '…see more'}
          </button>
        )}

        {/* Images */}
        <PostImages postId={post.id} />

        {/* Metric pills */}
        {post.metrics && post.metrics.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.metrics.map((m, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5">
                <span className="text-xs text-gray-400">{m.label}</span>
                <span className="text-xs font-bold text-gray-900">{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Engagement summary */}
        {(likeCount > 0 || post.comments.length > 0 || shareCount > 0) && (
          <div className="flex items-center justify-between mt-3 pb-2 border-b border-gray-50 text-xs text-gray-400">
            <span>{likeCount > 0 ? `${likeCount} likes` : ''}</span>
            <div className="flex gap-3">
              {post.comments.length > 0 && <span>{post.comments.length} comments</span>}
              {shareCount > 0 && <span>{shareCount} shares</span>}
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-1 pt-2">
          <button
            onClick={handleLike}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
              liked ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
          >
            <ThumbsUp size={14} className={liked ? 'fill-current' : ''} />
            Like
          </button>
          <button
            onClick={() => setShowComments(v => !v)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
              showComments ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
          >
            <MessageCircle size={14} />
            Comment
          </button>
          <button
            onClick={handleShare}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
              shared ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
          >
            <Share2 size={14} />
            {shared ? 'Shared!' : 'Share'}
          </button>
        </div>

        {/* Comments */}
        {showComments && (
          <div className="mt-4 pt-3 border-t border-gray-50 space-y-3">
            {post.comments.map(comment => (
              <div key={comment.id} className="flex gap-2.5">
                <Avatar src={comment.author.avatar} name={comment.author.name} size="sm" />
                <div className="flex-1 bg-gray-50 rounded-2xl px-3.5 py-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-gray-900">{comment.author.name}</p>
                    <TimeAgo date={comment.createdAt} className="text-xs text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                  {comment.reactions.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {comment.reactions.map(r => (
                        <span key={r.emoji} className="inline-flex items-center gap-0.5 text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded-lg text-gray-600">
                          {r.emoji} {r.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Reply input */}
            <div className="flex gap-2.5 pt-1">
              <Avatar
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=KumarVembu"
                name="Kumar Vembu"
                size="sm"
              />
              <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-3.5 py-2.5 focus-within:border-indigo-200 focus-within:bg-white transition-all">
                <input
                  type="text"
                  placeholder="Write a reply…"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && commentText) setCommentText(''); }}
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400 text-gray-900"
                />
                <button
                  onClick={() => setCommentText('')}
                  className={cn(
                    'p-1 rounded-lg transition-all flex-shrink-0',
                    commentText ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-300 cursor-default'
                  )}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Right panel (250px) ──────────────────────────────────────────────────────

function HotDiscussionsCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
        <BookMarked size={13} className="text-amber-500" />
        Hot Discussions
      </h3>
      <div className="space-y-3">
        {mockConversations.slice(0, 4).map(conv => (
          <Link key={conv.id} to={`/conversations/${conv.id}`} className="block group">
            <p className="text-xs font-medium text-gray-900 group-hover:text-indigo-600 transition-colors leading-snug mb-0.5 line-clamp-2">
              {conv.title}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span>{conv.messageCount} replies</span>
              <span>·</span>
              <span>{conv.topic}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TrendingTagsCard() {
  const allTags = mockPosts.flatMap(p => p.tags);
  const tagCounts = allTags.reduce<Record<string, number>>((acc, tag) => {
    acc[tag] = (acc[tag] ?? 0) + 1;
    return acc;
  }, {});
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
        <Hash size={13} className="text-indigo-500" />
        Trending
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {topTags.map(([tag, count]) => (
          <span
            key={tag}
            className="flex items-center gap-1 text-[10px] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-100 transition-all cursor-pointer"
          >
            #{tag}
            <span className="text-gray-400">{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function NetworkCard() {
  const founders = mockUsers.filter(u => u.role === 'founder').slice(0, 4);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
        <TrendingUp size={13} className="text-indigo-500" />
        People to follow
      </h3>
      <div className="space-y-2.5">
        {founders.map(u => (
          <div key={u.id} className="flex items-center gap-2">
            <Avatar src={u.avatar} name={u.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{u.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{u.company?.name ?? 'Founder'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Activities() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Three-column layout */}
      <div className="flex gap-5 items-start">

        {/* Center feed — 650px */}
        <div className="w-full lg:w-[650px] flex-shrink-0 space-y-4">
          <PageHeader
            title="Activities"
            description="What's happening across your portfolio network"
          />
          {mockPosts.map(post => (
            <ActivityPost key={post.id} post={post} />
          ))}
        </div>

        {/* Right panel — 250px */}
        <div className="hidden lg:block w-[250px] flex-shrink-0 sticky top-6 space-y-3">
          <HotDiscussionsCard />
          <TrendingTagsCard />
          <NetworkCard />
        </div>

      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ThumbsUp, MessageSquare, Share2, Image, Send, X, MoreHorizontal, Plus,
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { PageHeader } from '../components/layout/PageHeader';
import { TimeAgo } from '../components/ui/TimeAgo';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { mockFounder, mockInvestor, mockUsers } from '../data/mockData';
import type { User } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscussionPost {
  id: string;
  author: User;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  shares: number;
  createdAt: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_POSTS: DiscussionPost[] = [
  {
    id: 'd1',
    author: mockInvestor,
    content: `Just wrapped up our Q1 LP update. What I'm seeing across the portfolio:\n\n→ Revenue growth is holding steady at 2–3x YoY for early-stage\n→ Burn multiples are tightening — founders who did that work in 2023 are reaping the benefits now\n→ Enterprise sales cycles are getting longer, but deal sizes are bigger\n\nIf you're a founder with a Q1 win, share it below. I'd love to see what's working.`,
    likes: 84,
    comments: 31,
    shares: 12,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd2',
    author: mockFounder,
    content: `We just crossed $1M ARR at SynthFlow 🎉\n\nSix months ago we were at $180K. Here's what changed:\n\n1. We fired our 3 smallest customers (yes, really)\n2. Rebuilt pricing around outcomes, not features\n3. Hired a dedicated enterprise AE at $120K base\n\nRevenue per customer went from $8K to $42K ARR. Counter-intuitive, but it works. Happy to share the pricing playbook if anyone wants it.`,
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=280&fit=crop&auto=format&q=80',
    likes: 147,
    comments: 52,
    shares: 28,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd3',
    author: mockUsers[1] ?? mockFounder,
    content: `Enterprise healthcare sales truth that nobody talks about:\n\nThe decision-maker (CMO/CIO) is NOT your champion. Your champion is the director who's been trying to fix this problem for 2 years and can't get budget.\n\nFocus all your energy on making the director look good in front of leadership. That's how you close in healthcare. The director becomes your internal seller.\n\nShout out to Sarah Chen for this insight 3 months ago — it changed our entire sales motion. We went from 8-month cycles to 4-month cycles.`,
    likes: 63,
    comments: 18,
    shares: 9,
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd4',
    author: mockInvestor,
    content: `Q: What makes a great founder update?\n\nAfter reading 500+ updates over the past 4 years, here's what separates good from great:\n\n✓ Leads with the ONE number (MRR, ARR, DAU — just pick one and own it)\n✓ One honest "what's hard" section — not a laundry list, one real thing\n✓ One specific ask — investors aren't mind readers\n✓ Under 3 minutes to read\n\nBonus: a Loom walkthrough of a customer win. Nothing makes investors more excited than seeing real users genuinely loving your product.`,
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=280&fit=crop&auto=format&q=80',
    likes: 203,
    comments: 67,
    shares: 41,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd5',
    author: mockFounder,
    content: `Founder therapy: I almost quit last Tuesday.\n\nThe Series A process is brutal in ways nobody prepares you for. You put your whole soul into every partner meeting and then wait 3 weeks for a "we're going to pass."\n\nWhat got me through it: our head of sales sent a Slack at 11pm that night — we'd just closed our biggest contract ever, $280K ARR.\n\nTiming is everything. Don't quit on a bad day. The wins come when you least expect them.`,
    likes: 318,
    comments: 94,
    shares: 56,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function getAuthorSubtitle(author: User): string {
  if (author.company?.name) return author.company.name;
  const firstSentence = author.bio?.split('.')[0];
  return firstSentence || (author.role === 'investor' ? 'Investor' : 'Founder');
}

// ─── Composer ─────────────────────────────────────────────────────────────────

function ComposerCard({ onPost }: { onPost: (content: string, image: string | null) => void }) {
  const { currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePost = () => {
    if (!content.trim()) return;
    onPost(content, previewImage);
    setContent('');
    setPreviewImage(null);
    setExpanded(false);
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewImage(url);
    }
  };

  const handleCancel = () => {
    setExpanded(false);
    setContent('');
    setPreviewImage(null);
  };

  if (!expanded) {
    return (
      <div
        className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 cursor-text hover:border-gray-200 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
        <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-400 select-none">
          Start a discussion...
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <Image size={18} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{currentUser.name}</p>
          <p className="text-xs text-gray-500">{getAuthorSubtitle(currentUser)}</p>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What do you want to share or discuss with the network?"
        className="w-full text-sm text-gray-800 placeholder-gray-400 resize-none border-0 outline-none leading-relaxed min-h-[120px] mb-2"
        autoFocus
      />

      {previewImage && (
        <div className="relative mb-4">
          <img
            src={previewImage}
            alt="preview"
            className="w-full rounded-xl object-cover max-h-72"
          />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
          >
            <X size={13} className="text-white" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Image size={15} />
            Photo
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={!content.trim()}
            className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send size={14} />
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Discussion card ───────────────────────────────────────────────────────────

function DiscussionCard({ post }: { post: DiscussionPost }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [expanded, setExpanded] = useState(false);

  const CHAR_LIMIT = 320;
  const isLong = post.content.length > CHAR_LIMIT;
  const displayContent = isLong && !expanded ? post.content.slice(0, CHAR_LIMIT) : post.content;

  const toggleLike = () => {
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    setLiked(!liked);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-colors">
      <div className="p-5">
        {/* Author row */}
        <div className="flex items-start gap-3 mb-3.5">
          <Avatar src={post.author.avatar} name={post.author.name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{post.author.name}</p>
            <p className="text-xs text-gray-500 truncate">{getAuthorSubtitle(post.author)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              <TimeAgo date={post.createdAt} />
            </p>
          </div>
          <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0">
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="mb-1">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {displayContent}
            {isLong && !expanded && '...'}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 mt-1.5"
            >
              {expanded ? 'Show less' : 'See more'}
            </button>
          )}
        </div>
      </div>

      {/* Image — edge-to-edge within the card */}
      {post.image && (
        <div className="border-y border-gray-50">
          <img
            src={post.image}
            alt=""
            className="w-full object-cover max-h-72"
            loading="lazy"
          />
        </div>
      )}

      <div className="px-5 pb-4">
        {/* Metrics row */}
        {(likeCount > 0 || post.comments > 0) && (
          <div className="flex items-center justify-between py-2.5 text-xs text-gray-400 border-b border-gray-50">
            <span>{likeCount > 0 ? `${likeCount} ${likeCount === 1 ? 'like' : 'likes'}` : ''}</span>
            <span>
              {post.comments > 0 && `${post.comments} comments`}
              {post.comments > 0 && post.shares > 0 && ' · '}
              {post.shares > 0 && `${post.shares} shares`}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-around pt-1 -mx-1">
          <button
            onClick={toggleLike}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex-1 justify-center',
              liked ? 'text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
          >
            <ThumbsUp size={17} strokeWidth={liked ? 2.5 : 1.8} />
            <span>Like</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors flex-1 justify-center">
            <MessageSquare size={17} strokeWidth={1.8} />
            <span>Comment</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors flex-1 justify-center">
            <Share2 size={17} strokeWidth={1.8} />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Discussions() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<DiscussionPost[]>(INITIAL_POSTS);

  const handlePost = (content: string, image: string | null) => {
    const newPost: DiscussionPost = {
      id: `d-${Date.now()}`,
      author: currentUser,
      content,
      image: image ?? undefined,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: new Date().toISOString(),
    };
    setPosts([newPost, ...posts]);
  };

  return (
    <div className="py-6 sm:py-8 px-4 sm:px-6">
      {/* Constrain feed to 550px, centered */}
      <div className="max-w-[550px]">
        <PageHeader
          title="Discussions"
          description="Share insights, ask questions, and learn from the network"
          className="mb-5"
          action={
            <Link to="/discussions/new" className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors">
              <Plus size={15} /> New Post
            </Link>
          }
        />

        <div className="mb-4">
          <ComposerCard onPost={handlePost} />
        </div>

        <div className="space-y-3">
          {posts.map((post) => (
            <DiscussionCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}

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
// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscussionAuthor {
  id: string;
  name: string;
  avatar?: string;
  subtitle: string;
}

interface DiscussionPost {
  id: string;
  author: DiscussionAuthor;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  shares: number;
  createdAt: string;
}

const INITIAL_POSTS: DiscussionPost[] = [];

// ─── Helper ───────────────────────────────────────────────────────────────────

function getAuthorSubtitle(author: DiscussionAuthor): string {
  return author.subtitle || 'Member';
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
          <p className="text-xs text-gray-500">{currentUser.role === 'investor' ? 'Investor' : (currentUser.company?.name ?? 'Founder')}</p>
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
      author: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        subtitle: currentUser.role === 'investor' ? 'Investor' : (currentUser.company?.name ?? 'Founder'),
      },
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

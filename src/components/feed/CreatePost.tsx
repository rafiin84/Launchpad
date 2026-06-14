import React, { useState } from 'react';
import { Trophy, HelpCircle, ArrowLeftRight, Lightbulb, X, Globe, Lock, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { PostType, PostVisibility } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { postsService } from '../../services/postsService';
import { useAuth } from '../../context/AuthContext';

const postTypes: { type: PostType; label: string; icon: React.ElementType; description: string; emoji: string; bg: string; activeBg: string; text: string }[] = [
  {
    type: 'win',
    label: 'Share a Win',
    icon: Trophy,
    description: 'Product launch, customer, milestone',
    emoji: '🏆',
    bg: 'bg-emerald-50',
    activeBg: 'bg-emerald-100 border-emerald-300',
    text: 'text-emerald-700',
  },
  {
    type: 'advice',
    label: 'Ask for Advice',
    icon: HelpCircle,
    description: 'Get help from founders and investors',
    emoji: '💡',
    bg: 'bg-indigo-50',
    activeBg: 'bg-indigo-100 border-indigo-300',
    text: 'text-indigo-700',
  },
  {
    type: 'introduction',
    label: 'Request an Intro',
    icon: ArrowLeftRight,
    description: 'Customer, partner, advisor',
    emoji: '🤝',
    bg: 'bg-amber-50',
    activeBg: 'bg-amber-100 border-amber-300',
    text: 'text-amber-700',
  },
  {
    type: 'insight',
    label: 'Share an Insight',
    icon: Lightbulb,
    description: 'Lesson learned, market observation',
    emoji: '✨',
    bg: 'bg-sky-50',
    activeBg: 'bg-sky-100 border-sky-300',
    text: 'text-sky-700',
  },
];

interface CreatePostProps {
  onPost?: () => void;
}

export function CreatePost({ onPost }: CreatePostProps) {
  const { currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [postType, setPostType] = useState<PostType>('win');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('portfolio');
  const [posting, setPosting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      await postsService.createPost({
        type: postType,
        author: currentUser,
        company: currentUser.company,
        content: content.trim(),
        title: title.trim() || undefined,
        visibility,
        tags: [],
      });
      setContent('');
      setTitle('');
      setExpanded(false);
      onPost?.();
    } finally {
      setPosting(false);
    }
  };

  if (!expanded) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Avatar src={currentUser.avatar} name={currentUser.name} size="md" />
          <button
            onClick={() => setExpanded(true)}
            className="flex-1 text-left text-sm text-gray-400 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl px-4 py-2.5"
          >
            Share a win, ask for advice, or request an intro...
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
          {postTypes.map((pt) => (
            <button
              key={pt.type}
              onClick={() => { setPostType(pt.type); setExpanded(true); }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all', pt.bg, pt.text, 'hover:opacity-80')}
            >
              <span>{pt.emoji}</span>
              <span className="hidden sm:inline">{pt.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // activeType used for future contextual placeholder customization
  postTypes.find((pt) => pt.type === postType);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar src={currentUser.avatar} name={currentUser.name} size="md" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{currentUser.name}</p>
            <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
              <Globe size={11} />
              Portfolio
              <ChevronDown size={11} />
            </button>
          </div>
        </div>
        <button onClick={() => setExpanded(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
          <X size={16} />
        </button>
      </div>

      {/* Post type selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {postTypes.map((pt) => {
          const Icon = pt.icon;
          return (
            <button
              key={pt.type}
              onClick={() => setPostType(pt.type)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                postType === pt.type
                  ? cn(pt.activeBg, pt.text, 'border-current')
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              <Icon size={13} />
              {pt.label}
            </button>
          );
        })}
      </div>

      <input
        placeholder="Add a title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-base font-semibold text-gray-900 placeholder-gray-300 border-0 outline-none mb-3 bg-transparent"
      />

      <Textarea
        placeholder={
          postType === 'win' ? "What did you accomplish? Share the story..." :
          postType === 'advice' ? "What challenge are you facing? Be specific..." :
          postType === 'introduction' ? "Who are you looking to connect with and why?" :
          "What did you learn? Share your insight..."
        }
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        className="border-0 bg-transparent p-0 focus:ring-0 resize-none"
      />

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {(['portfolio', 'private'] as PostVisibility[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                visibility === v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              {v === 'portfolio' ? <Globe size={12} /> : <Lock size={12} />}
              {v === 'portfolio' ? 'Portfolio' : 'Private'}
            </button>
          ))}
        </div>
        <Button
          onClick={handleSubmit}
          loading={posting}
          disabled={!content.trim()}
          size="sm"
        >
          Post
        </Button>
      </div>
    </div>
  );
}

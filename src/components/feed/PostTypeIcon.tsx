import React from 'react';
import { Trophy, HelpCircle, ArrowLeftRight, Lightbulb } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { PostType } from '../../types';

interface PostTypeIconProps {
  type: PostType;
  size?: 'sm' | 'md' | 'lg';
}

const configs: Record<PostType, { icon: React.ElementType; bg: string; text: string; label: string; emoji: string }> = {
  win: { icon: Trophy, bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Win', emoji: '🏆' },
  advice: { icon: HelpCircle, bg: 'bg-indigo-50', text: 'text-indigo-600', label: 'Advice', emoji: '💡' },
  introduction: { icon: ArrowLeftRight, bg: 'bg-amber-50', text: 'text-amber-600', label: 'Intro Request', emoji: '🤝' },
  insight: { icon: Lightbulb, bg: 'bg-sky-50', text: 'text-sky-600', label: 'Insight', emoji: '✨' },
};

const sizes = {
  sm: { container: 'w-8 h-8', icon: 16 },
  md: { container: 'w-10 h-10', icon: 20 },
  lg: { container: 'w-12 h-12', icon: 24 },
};

export function PostTypeIcon({ type, size = 'md' }: PostTypeIconProps) {
  const config = configs[type];
  const Icon = config.icon;
  const { container, icon: iconSize } = sizes[size];

  return (
    <div className={cn('rounded-xl flex items-center justify-center flex-shrink-0', container, config.bg)}>
      <Icon size={iconSize} className={config.text} />
    </div>
  );
}

export function PostTypePill({ type }: { type: PostType }) {
  const config = configs[type];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', config.bg, config.text)}>
      {config.emoji} {config.label}
    </span>
  );
}

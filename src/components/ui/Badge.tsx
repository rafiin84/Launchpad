import React from 'react';
import { cn } from '../../lib/cn';

type Color = 'default' | 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'indigo' | 'gray';
type Size = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  color?: Color;
  size?: Size;
  dot?: boolean;
  className?: string;
}

const colors: Record<Color, string> = {
  default: 'bg-gray-100 text-gray-700',
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  gray: 'bg-gray-100 text-gray-500',
};

const dotColors: Record<Color, string> = {
  default: 'bg-gray-500',
  green: 'bg-emerald-500',
  blue: 'bg-sky-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  indigo: 'bg-indigo-500',
  gray: 'bg-gray-400',
};

const sizes: Record<Size, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({ children, color = 'default', size = 'sm', dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        colors[color],
        sizes[size],
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[color])} />}
      {children}
    </span>
  );
}

// Stage-specific badge mappings
export function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { label: string; color: Color }> = {
    new: { label: 'New', color: 'gray' },
    reviewing: { label: 'Reviewing', color: 'blue' },
    'meeting-scheduled': { label: 'Meeting', color: 'indigo' },
    'due-diligence': { label: 'Due Diligence', color: 'purple' },
    'investment-committee': { label: 'IC', color: 'amber' },
    approved: { label: 'Approved', color: 'green' },
    rejected: { label: 'Rejected', color: 'red' },
    invested: { label: 'Invested', color: 'green' },
    'pre-seed': { label: 'Pre-Seed', color: 'gray' },
    seed: { label: 'Seed', color: 'blue' },
    'series-a': { label: 'Series A', color: 'indigo' },
    'series-b': { label: 'Series B', color: 'purple' },
    'series-c': { label: 'Series C', color: 'amber' },
    growth: { label: 'Growth', color: 'green' },
  };

  const config = map[stage] || { label: stage, color: 'default' as Color };
  return <Badge color={config.color} dot>{config.label}</Badge>;
}

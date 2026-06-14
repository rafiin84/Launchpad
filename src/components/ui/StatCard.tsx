import React from 'react';
import { cn } from '../../lib/cn';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  accent?: boolean;
}

export function StatCard({ label, value, change, changeLabel, icon, className, accent }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        'bg-white border border-gray-100 rounded-2xl p-5',
        accent && 'bg-black text-white border-black',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('text-sm font-medium', accent ? 'text-gray-300' : 'text-gray-500')}>{label}</div>
        {icon && (
          <div className={cn('p-2 rounded-xl', accent ? 'bg-white/10' : 'bg-gray-50')}>{icon}</div>
        )}
      </div>
      <div className={cn('mt-2 text-2xl font-bold tracking-tight', accent ? 'text-white' : 'text-gray-900')}>
        {value}
      </div>
      {change !== undefined && (
        <div className="mt-1.5 flex items-center gap-1">
          {isPositive ? (
            <TrendingUp size={14} className="text-emerald-500" />
          ) : (
            <TrendingDown size={14} className="text-red-500" />
          )}
          <span className={cn('text-xs font-medium', isPositive ? 'text-emerald-600' : 'text-red-600')}>
            {isPositive ? '+' : ''}
            {change}%
          </span>
          {changeLabel && <span className={cn('text-xs', accent ? 'text-gray-400' : 'text-gray-400')}>{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}

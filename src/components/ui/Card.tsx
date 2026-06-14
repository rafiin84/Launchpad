import React from 'react';
import { cn } from '../../lib/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ children, className, hover, onClick, padding = 'md' }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-gray-100 rounded-2xl',
        paddings[padding],
        hover && 'hover:border-gray-200 hover:shadow-sm transition-all duration-200 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function CardHeader({ children, className, action }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}

export function CardDivider({ className }: { className?: string }) {
  return <div className={cn('border-t border-gray-100 -mx-6 my-4', className)} />;
}

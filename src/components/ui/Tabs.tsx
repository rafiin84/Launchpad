import React from 'react';
import { cn } from '../../lib/cn';

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
}

export function Tabs({ tabs, activeTab, onChange, className, variant = 'underline' }: TabsProps) {
  if (variant === 'pills') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-black text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold',
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center border-b border-gray-100', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-1 py-3 mr-6 text-sm font-medium border-b-2 transition-all -mb-px',
            activeTab === tab.id
              ? 'border-black text-black'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-xs font-semibold',
                activeTab === tab.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

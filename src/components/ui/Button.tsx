import React from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-black text-white hover:bg-gray-800 active:bg-gray-900',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
  outline: 'bg-transparent border border-gray-300 text-gray-900 hover:bg-gray-50',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-lg',
  md: 'px-4 py-2 text-sm font-medium rounded-xl',
  lg: 'px-6 py-3 text-base font-medium rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children}
      {iconRight && !loading && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  );
}

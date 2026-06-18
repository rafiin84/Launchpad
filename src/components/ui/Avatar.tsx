import React from 'react';
import { cn } from '../../lib/cn';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string;
  name: string;
  size?: Size;
  className?: string;
  ring?: boolean;
}

const sizes: Record<Size, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getColor(name: string) {
  const colors = [
    'bg-indigo-100 text-indigo-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-sky-100 text-sky-700',
    'bg-violet-100 text-violet-700',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export function Avatar({ src, name, size = 'md', className, ring }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);

  return (
    <div
      className={cn(
        'relative flex-shrink-0 rounded-full overflow-hidden',
        sizes[size],
        ring && 'ring-2 ring-white',
        className
      )}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover scale-150"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={cn('w-full h-full flex items-center justify-center font-semibold', getColor(name))}>
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}

interface AvatarGroupProps {
  users: { name: string; avatar?: string }[];
  max?: number;
  size?: Size;
}

export function AvatarGroup({ users, max = 4, size = 'sm' }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="flex -space-x-2">
      {visible.map((user, i) => (
        <Avatar key={i} src={user.avatar} name={user.name} size={size} ring />
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'flex-shrink-0 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-medium ring-2 ring-white',
            sizes[size],
            'text-xs'
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

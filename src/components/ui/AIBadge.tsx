import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Small "AI" pill shown next to AI-generated content */
export function AIBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider',
        'bg-gradient-to-r from-violet-100 to-indigo-100 text-indigo-600',
        'px-2 py-0.5 rounded-full',
        className
      )}
    >
      <Sparkles size={9} /> AI
    </span>
  );
}

/** Toggle switch between Manual and AI modes */
export function AIToggle({
  mode,
  onToggle,
}: {
  mode: 'manual' | 'ai';
  onToggle: (mode: 'manual' | 'ai') => void;
}) {
  return (
    <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
      <button
        onClick={() => onToggle('manual')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
          mode === 'manual'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        )}
      >
        Manual
      </button>
      <button
        onClick={() => onToggle('ai')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
          mode === 'ai'
            ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        )}
      >
        <Sparkles size={11} /> AI
      </button>
    </div>
  );
}

/** AI Insight Card — used across dashboards */
export function AIInsightCard({
  icon,
  title,
  description,
  priority,
  actionLabel,
  onAction,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const priorityStyles = {
    high: 'border-l-red-400',
    medium: 'border-l-amber-400',
    low: 'border-l-blue-400',
  };

  return (
    <div
      className={cn(
        'bg-white border border-gray-100 rounded-xl p-4 border-l-[3px] hover:shadow-sm transition-all',
        priority ? priorityStyles[priority] : 'border-l-indigo-400',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-xs font-semibold text-gray-900">{title}</h4>
            <AIBadge />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              {actionLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Score ring visualization */
export function AIScoreRing({
  score,
  size = 48,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="3"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color }}>
            {score}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] text-gray-400 font-medium">{label}</span>
      )}
    </div>
  );
}

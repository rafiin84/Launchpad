import { useState } from 'react';

const LOGO_COLORS: [string, string][] = [
  ['#6366f1', '#818cf8'], // indigo
  ['#8b5cf6', '#a78bfa'], // violet
  ['#0ea5e9', '#38bdf8'], // sky
  ['#10b981', '#34d399'], // emerald
  ['#f59e0b', '#fbbf24'], // amber
  ['#ef4444', '#f87171'], // red
  ['#ec4899', '#f472b6'], // pink
  ['#14b8a6', '#2dd4bf'], // teal
];

interface Props {
  name: string;
  website?: string;
  /** Pre-loaded logo data URL or image URL from CRM */
  logoUrl?: string | null;
  /** Tailwind size unit — e.g. 10 = w-10 h-10 (40px) */
  size?: number;
  className?: string;
}

export function CompanyLogo({ name, website, logoUrl: crmLogo, size = 10, className = '' }: Props) {
  const [imgError, setImgError] = useState(false);
  const [clearbitError, setClearbitError] = useState(false);

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const colorIdx = name ? name.charCodeAt(0) % LOGO_COLORS.length : 0;
  const [from, to] = LOGO_COLORS[colorIdx];

  const domain = website
    ? website.replace(/https?:\/\//, '').replace(/\/.*/, '').trim()
    : '';
  const clearbitUrl = domain ? `https://logo.clearbit.com/${domain}` : '';

  const px = size * 4;
  const sizeClass = `w-${size} h-${size}`;

  // Priority 1: CRM-uploaded logo
  if (crmLogo && !imgError) {
    return (
      <div className={`${sizeClass} rounded-xl overflow-hidden flex-shrink-0 bg-white border border-gray-100 flex items-center justify-center ${className}`}>
        <img
          src={crmLogo}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Priority 2: Clearbit logo from website domain
  if (clearbitUrl && !clearbitError) {
    return (
      <div className={`${sizeClass} rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100 flex items-center justify-center ${className}`}>
        <img
          src={clearbitUrl}
          alt={name}
          className="w-full h-full object-contain p-1"
          onError={() => setClearbitError(true)}
        />
      </div>
    );
  }

  // Fallback: colored initials
  return (
    <div
      className={`${sizeClass} rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-white select-none ${className}`}
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: Math.round(px * 0.35),
      }}
    >
      {initials}
    </div>
  );
}

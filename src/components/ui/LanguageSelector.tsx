import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { LANGUAGES } from '../../i18n';
import { cn } from '../../lib/cn';

interface Props {
  variant?: 'icon' | 'full' | 'login';
  className?: string;
}

export function LanguageSelector({ variant = 'icon', className }: Props) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  if (variant === 'login') {
    return (
      <div ref={ref} className={cn('relative', className)}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-full transition-colors"
        >
          <Globe size={13} />
          <span>{current.flag} {current.label}</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px] z-50">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => { setLanguage(lang.code); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors',
                  language === lang.code && 'bg-indigo-50 text-indigo-700 font-medium'
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div ref={ref} className={cn('relative', className)}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-xl transition-colors"
        >
          <Globe size={15} />
          <span>{current.flag} {current.label}</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px] z-50">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => { setLanguage(lang.code); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition-colors',
                  language === lang.code && 'bg-indigo-50 text-indigo-700 font-medium'
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // icon variant (compact, for headers)
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600"
        title={current.label}
      >
        <Globe size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px] z-50">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors',
                language === lang.code && 'bg-indigo-50 text-indigo-700 font-medium'
              )}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

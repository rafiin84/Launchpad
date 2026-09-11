import { NavLink, Link, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { NotificationBell } from '../ui/NotificationBell';
import { LanguageSelector } from '../ui/LanguageSelector';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/cn';

interface Props {
  title?: ReactNode;
  subtitle?: ReactNode;
}

/**
 * Detail pages that get their "back" control in this header rather than in the
 * page body, so the page itself starts at the top of the viewport instead of
 * spending its first rows on a link. Keyed by the first path segment; the
 * `except` list is for sibling routes that are pages in their own right
 * (/applications/apply is a form, not an application).
 */
const BACK_IN_HEADER: Record<string, { to: string; except: string[] }> = {
  applications: { to: '/applications', except: ['track', 'review', 'apply'] },
};

export function DesktopHeader({ title, subtitle }: Props) {
  const { currentUser, role } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();

  // Derived from the route rather than set by the page: a page that pushes into
  // shared header state has to remember to clear it, and forgetting leaves a
  // stale back link pointing somewhere the user is no longer coming from.
  const segments = pathname.split('/').filter(Boolean);
  const backCfg = segments.length === 2 ? BACK_IN_HEADER[segments[0]] : undefined;
  const back = backCfg && !backCfg.except.includes(segments[1])
    ? { to: backCfg.to, label: t.applicationDetail.backToApplications }
    : null;

  return (
    <header className="sticky top-0 z-20 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
      <div className="flex items-center justify-between gap-4 px-6 py-2.5">
        {back || title ? (
          <div className="min-w-0 flex items-center gap-3">
            {back && (
              <Link
                to={back.to}
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors flex-shrink-0"
              >
                <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
                {back.label}
              </Link>
            )}
            {title && (
              <div className={cn('min-w-0', back && 'border-l border-gray-200 pl-3')}>
                <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
                {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
              </div>
            )}
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          <LanguageSelector variant="icon" />
          <NotificationBell />
          <NavLink
            to="/profile"
            className="flex items-center gap-2.5 ml-1 px-2.5 py-1.5 rounded-xl hover:bg-white/80 transition-colors"
          >
            <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
            <div className="hidden lg:block min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate leading-tight">{currentUser.name}</p>
              <p className="text-[11px] text-gray-400 capitalize leading-tight">{role === 'investor' ? t.login.investor : t.login.founder}</p>
            </div>
          </NavLink>
        </div>
      </div>
    </header>
  );
}

import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Building2, PieChart, User, LayoutDashboard, Inbox, FileText, Rss, Home, MoreHorizontal, Users, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';

export function BottomNav() {
  const { isInvestor, currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  // Close on route change
  useEffect(() => {
    setShowMore(false);
  }, [location.pathname]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (showMore) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showMore]);

  const founderItems = [
    { label: 'Dashboard',  path: '/',            icon: Home },
    { label: 'Activities', path: '/activities',   icon: Rss },
    { label: 'Company',    path: '/company',      icon: Building2 },
  ];

  const investorItems = [
    { label: 'Dashboard',    path: '/',              icon: LayoutDashboard },
    { label: 'Activities',   path: '/activities',    icon: Rss },
    { label: 'Portfolio',    path: '/portfolio',     icon: PieChart },
    { label: 'Applications', path: '/applications', icon: Inbox },
  ];

  const founderMoreItems = [
    { label: 'Documents', path: '/documents', icon: FileText, desc: 'Files and attachments' },
    { label: 'Founders',  path: '/founders',  icon: Users,    desc: 'Portfolio founders' },
    { label: 'Profile',   path: '/profile',   icon: User,     desc: 'Your account settings' },
  ];

  const investorMoreItems = [
    { label: 'Documents', path: '/documents', icon: FileText, desc: 'Files and attachments' },
    { label: 'Founders',  path: '/founders',  icon: Users,    desc: 'Portfolio founders' },
    { label: 'Profile',   path: '/profile',   icon: User,     desc: 'Your account settings' },
  ];

  const items = isInvestor ? investorItems : founderItems;
  const moreItems = isInvestor ? investorMoreItems : founderMoreItems;

  const moreIsActive = moreItems.some(item =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  );

  return (
    <>
      {/* iOS-style bottom sheet overlay */}
      {showMore && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMore(false)}
            style={{ animation: 'fadeIn 200ms ease-out' }}
          />

          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden"
            style={{ animation: 'slideUp 300ms cubic-bezier(0.32, 0.72, 0, 1)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Profile header */}
            <div className="px-5 pt-2 pb-4">
              <button
                onClick={() => { navigate('/profile'); setShowMore(false); }}
                className="flex items-center gap-3 w-full p-3 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <Avatar src={currentUser.avatar} name={currentUser.name} size="md" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-gray-900 truncate">{currentUser.name}</p>
                  <p className="text-xs text-gray-500 capitalize">View Profile</p>
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-100 mx-5" />

            {/* Menu items */}
            <div className="px-5 py-3 space-y-0.5">
              {moreItems.filter(i => i.path !== '/profile').map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setShowMore(false); }}
                    className={cn(
                      'flex items-center gap-3.5 w-full px-3 py-3 rounded-2xl transition-colors active:bg-gray-100',
                      isActive ? 'bg-gray-50' : ''
                    )}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                      isActive ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'
                    )}>
                      <Icon size={17} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={cn(
                        'text-sm font-medium',
                        isActive ? 'text-gray-900' : 'text-gray-700'
                      )}>{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Cancel button */}
            <div className="px-5 pt-1 pb-safe-offset-4">
              <button
                onClick={() => setShowMore(false)}
                className="w-full py-3 text-sm font-semibold text-gray-500 bg-gray-100 rounded-2xl active:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/60 z-40 md:hidden">
        <div className="flex items-center justify-around px-2 py-1.5 pb-safe">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-0',
                  isActive ? 'text-blue-600' : 'text-gray-400'
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.6} />
                <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>{item.label}</span>
              </NavLink>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-0',
              moreIsActive ? 'text-blue-600' : 'text-gray-400'
            )}
          >
            <MoreHorizontal size={22} strokeWidth={moreIsActive ? 2.2 : 1.6} />
            <span className={cn('text-[10px] font-medium', moreIsActive && 'font-semibold')}>More</span>
          </button>
        </div>
      </nav>

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .pb-safe-offset-4 {
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
        }
      `}</style>
    </>
  );
}

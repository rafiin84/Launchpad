import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { ElementType } from 'react';
import {
  Home,
  Inbox,
  TrendingUp,
  Building2,
  PieChart,
  FileText,
  Settings,
  Rocket,
  LayoutDashboard,
  LogOut,
  Rss,
  MessageSquare,
  BookOpen,
  ArrowLeftRight,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  label: string;
  path: string;
  icon: ElementType;
}

const investorNav: NavItem[] = [
  { label: 'Dashboard',    path: '/',            icon: LayoutDashboard },
  { label: 'Activities',   path: '/activities',  icon: Rss },
  { label: 'Portfolio',    path: '/portfolio',   icon: PieChart },
  { label: 'Applications', path: '/applications',icon: Inbox },
  { label: 'Documents',    path: '/documents',   icon: FileText },
  { label: 'Settings',     path: '/settings',    icon: Settings },
];

const founderNav: NavItem[] = [
  { label: 'Home',          path: '/',              icon: Home },
  { label: 'Activities',    path: '/activities',    icon: Rss },
  { label: 'Companies',     path: '/companies',     icon: Building2 },
  { label: 'Discussions',   path: '/discussions',   icon: Users },
  { label: 'Conversations', path: '/conversations', icon: MessageSquare },
  { label: 'Knowledge Hub', path: '/knowledge',     icon: BookOpen },
  { label: 'Introductions', path: '/introductions', icon: ArrowLeftRight },
  { label: 'Documents',     path: '/documents',     icon: FileText },
  { label: 'Settings',      path: '/settings',      icon: Settings },
];

export function Sidebar() {
  const { currentUser, role, isInvestor, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = isInvestor ? investorNav : founderNav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col border-r border-gray-100 bg-white overflow-hidden">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center">
          <Rocket size={15} className="text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-gray-900">Launchpad</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-3 pb-4">
        {navItems.map((item) => {
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
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon size={17} className="flex-shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Profile + logout */}
      <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0">
        <NavLink
          to="/profile"
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors mb-2"
        >
          <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{currentUser.name}</p>
            <p className="text-xs text-gray-500 capitalize truncate">{role}</p>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

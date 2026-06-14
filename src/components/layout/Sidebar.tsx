import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Inbox,
  TrendingUp,
  Building2,
  PieChart,
  MessageSquare,
  Users,
  BookOpen,
  DollarSign,
  Layers,
  FileText,
  Settings,
  Rocket,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  investorOnly?: boolean;
  founderVisible?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Applications', path: '/applications', icon: Inbox, investorOnly: true },
  { label: 'Deal Flow', path: '/deals', icon: TrendingUp, investorOnly: true },
  { label: 'Companies', path: '/companies', icon: Building2 },
  { label: 'Portfolio', path: '/portfolio', icon: PieChart },
  { label: 'Conversations', path: '/conversations', icon: MessageSquare },
  { label: 'Introductions', path: '/introductions', icon: ArrowLeftRight },
  { label: 'Knowledge', path: '/knowledge', icon: BookOpen },
  { label: 'Investments', path: '/investments', icon: DollarSign, investorOnly: true },
  { label: 'Funds', path: '/funds', icon: Layers, investorOnly: true },
  { label: 'Documents', path: '/documents', icon: FileText },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export function Sidebar() {
  const { currentUser, role, switchRole, isInvestor } = useAuth();
  const location = useLocation();

  const visibleItems = navItems.filter((item) => {
    if (item.investorOnly && !isInvestor) return false;
    return true;
  });

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col border-r border-gray-100 bg-white overflow-hidden">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
          <Rocket size={16} className="text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-gray-900">Launchpad</span>
      </div>

      {/* Role Switcher */}
      <div className="px-4 pb-4">
        <div className="flex rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => switchRole('founder')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all',
              role === 'founder' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Founder
          </button>
          <button
            onClick={() => switchRole('investor')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all',
              role === 'investor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Investor
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all',
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

      {/* Profile */}
      <div className="px-4 py-4 border-t border-gray-100">
        <NavLink to="/profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
          <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{currentUser.name}</p>
            <p className="text-xs text-gray-500 capitalize truncate">{role}</p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}

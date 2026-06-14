import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Building2, MessageSquare, DollarSign, User } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuth } from '../../context/AuthContext';

export function BottomNav() {
  const { isInvestor } = useAuth();
  const location = useLocation();

  const items = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Companies', path: '/companies', icon: Building2 },
    { label: 'Chats', path: '/conversations', icon: MessageSquare },
    { label: isInvestor ? 'Deals' : 'Portfolio', path: isInvestor ? '/deals' : '/portfolio', icon: DollarSign },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 md:hidden">
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-0',
                isActive ? 'text-black' : 'text-gray-400'
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

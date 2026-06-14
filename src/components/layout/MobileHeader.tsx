import React from 'react';
import { Rocket, Bell, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';

export function MobileHeader() {
  const { currentUser } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <Rocket size={14} className="text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-gray-900">Launchpad</span>
        </Link>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <Search size={18} className="text-gray-600" />
          </button>
          <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <Bell size={18} className="text-gray-600" />
          </button>
          <Link to="/profile">
            <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}

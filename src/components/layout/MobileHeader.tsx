import React from 'react';
import { Rocket, Search, Plus, LayoutGrid, List } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { NotificationBell } from '../ui/NotificationBell';
import { useAuth } from '../../context/AuthContext';

export function MobileHeader() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Hide on detail / edit / new sub-pages (any path with 2+ segments)
  const segments = location.pathname.split('/').filter(Boolean);
  if (segments.length >= 2) return null;

  const isHome         = location.pathname === '/' || location.pathname === '/dashboard';
  const isApplications = location.pathname === '/applications';
  const isPortfolio    = location.pathname === '/portfolio';
  const isSearchOnly   = location.pathname === '/activities';
  const isDocuments    = location.pathname === '/documents';
  const isFounders     = location.pathname === '/founders';

  const view = (searchParams.get('view') as 'grid' | 'list') || 'list';
  const toggleView = (v: 'grid' | 'list') =>
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('view', v); return p; });

  // Reusable grid/list toggle
  const ViewToggle = () => (
    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden ml-1">
      <button
        onClick={() => toggleView('grid')}
        className={`p-2 transition-colors ${view === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-400'}`}
        title="Grid view"
      >
        <LayoutGrid size={14} />
      </button>
      <button
        onClick={() => toggleView('list')}
        className={`p-2 transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-400'}`}
        title="List view"
      >
        <List size={14} />
      </button>
    </div>
  );

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <Rocket size={14} className="text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-gray-900">Launchpad</span>
        </Link>

        {/* Right-side icons — vary by page */}
        <div className="flex items-center gap-1">
          {isHome && (
            <>
              <NotificationBell size={18} />
              <Link to="/profile">
                <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
              </Link>
            </>
          )}

          {isSearchOnly && (
            <button
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              title="Search"
              onClick={() => document.getElementById('page-search')?.focus()}
            >
              <Search size={18} className="text-gray-600" />
            </button>
          )}

          {isDocuments && (
            <>
              <button
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                title="Search"
                onClick={() => document.getElementById('page-search')?.focus()}
              >
                <Search size={18} className="text-gray-600" />
              </button>
              <Link
                to="/documents/new"
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                title="Add Document"
              >
                <Plus size={18} className="text-gray-600" />
              </Link>
            </>
          )}

          {isPortfolio && (
            <>
              <Link
                to="/portfolio/new"
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                title="Add Company"
              >
                <Plus size={18} className="text-gray-600" />
              </Link>
              <ViewToggle />
            </>
          )}

          {isApplications && (
            <Link
              to="/applications/new"
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              title="Add Application"
            >
              <Plus size={18} className="text-gray-600" />
            </Link>
          )}

          {isFounders && (
            <>
              <button
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                title="Add Founder"
                onClick={() => {
                  // Dispatch custom event that the Founders page listens for
                  window.dispatchEvent(new CustomEvent('open-add-founder'));
                }}
              >
                <Plus size={18} className="text-gray-600" />
              </button>
              <ViewToggle />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

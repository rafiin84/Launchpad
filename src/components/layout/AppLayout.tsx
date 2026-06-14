import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop: three-column layout */}
      <div className="hidden md:flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <Outlet />
        </main>
      </div>

      {/* Mobile: single column with bottom nav */}
      <div className="md:hidden min-h-screen flex flex-col bg-white">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto pb-20">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

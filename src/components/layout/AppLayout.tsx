import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { DesktopHeader } from './DesktopHeader';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop: sidebar + main */}
      <div className="hidden md:flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-0">
          <DesktopHeader />
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile: header + content + bottom nav */}
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

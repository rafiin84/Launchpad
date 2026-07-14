import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { DesktopHeader } from './DesktopHeader';
import { PageTitleProvider, usePageTitle } from '../../context/PageTitleContext';

function DesktopLayout() {
  const { title, subtitle } = usePageTitle();
  return (
    <div className="hidden md:flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DesktopHeader title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <PageTitleProvider>
      <div className="min-h-screen bg-gray-50">
        <DesktopLayout />
        <div className="md:hidden min-h-screen flex flex-col bg-white">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto pb-20">
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </div>
    </PageTitleProvider>
  );
}

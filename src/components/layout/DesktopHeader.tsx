import { NavLink } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { NotificationBell } from '../ui/NotificationBell';
import { LanguageSelector } from '../ui/LanguageSelector';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export function DesktopHeader() {
  const { currentUser, role } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-20 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
      <div className="flex items-center justify-end gap-2 px-6 py-2.5">
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
    </header>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getUnreadCount } from '../../services/notifications';

interface NotificationBellProps {
  className?: string;
  size?: number;
}

export function NotificationBell({ className, size = 17 }: NotificationBellProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(getUnreadCount());

    refresh();

    const interval = setInterval(refresh, 3000);

    window.addEventListener('notifications-updated', refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-updated', refresh);
    };
  }, []);

  return (
    <Link
      to="/notifications"
      className={`relative p-2 rounded-xl hover:bg-gray-100 transition-colors ${className ?? ''}`}
    >
      <Bell size={size} className="text-gray-600" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Building2, Rss, Send, UserCheck, UserX, User, Megaphone,
  CheckCheck, Trash2,
} from 'lucide-react';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications,
  type AppNotification,
  type NotificationType,
} from '../../services/notifications';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/cn';

const TYPE_META: Record<NotificationType, { icon: React.ElementType; bg: string; text: string }> = {
  company_update:   { icon: Building2,  bg: 'bg-indigo-50',  text: 'text-indigo-500' },
  activity_post:    { icon: Rss,        bg: 'bg-emerald-50', text: 'text-emerald-500' },
  invitation_sent:  { icon: Send,       bg: 'bg-purple-50',  text: 'text-purple-500' },
  user_activated:   { icon: UserCheck,   bg: 'bg-green-50',   text: 'text-green-500' },
  user_deactivated: { icon: UserX,       bg: 'bg-red-50',     text: 'text-red-500' },
  profile_update:   { icon: User,        bg: 'bg-sky-50',     text: 'text-sky-500' },
  announcement:     { icon: Megaphone,   bg: 'bg-amber-50',   text: 'text-amber-500' },
};

function relativeTime(timestamp: string, t: any, language: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return t.activities.justNow;
  if (diffMin < 60) return t.activities.minutesAgo.replace('{n}', String(diffMin));
  if (diffHr < 24) return t.activities.hoursAgo.replace('{n}', String(diffHr));
  if (diffDay === 1) return t.activities.yesterday;
  if (diffDay < 7) return t.activities.daysAgo.replace('{n}', String(diffDay));

  const d = new Date(timestamp);
  return d.toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' });
}

interface NotificationBellProps {
  className?: string;
  size?: number;
}

export function NotificationBell({ className, size = 17 }: NotificationBellProps) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const refresh = useCallback(async () => {
    try {
      const notifs = await getNotifications();
      setNotifications(notifs);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    window.addEventListener('notifications-updated', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-updated', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleDropdown = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(o => !o);
    if (!open) refresh();
  };

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
    refresh();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    refresh();
  };

  const handleClearAll = () => {
    clearNotifications();
    setNotifications([]);
    setOpen(false);
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={btnRef}
        onClick={toggleDropdown}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <Bell size={size} className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed bg-white border border-gray-200 rounded-2xl shadow-xl z-[9999] w-[380px] max-h-[480px] flex flex-col"
          style={{ top: dropdownPos.top, right: dropdownPos.right }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">{t.notifications.title}</h3>
              {unreadCount > 0 && (
                <span className="min-w-[20px] h-[20px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                  title={t.notifications.markAllRead}
                >
                  <CheckCheck size={14} />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
                  title={t.notifications.clearAll}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Bell size={18} className="text-gray-400" />
                </div>
                <p className="text-xs font-semibold text-gray-700">{t.notifications.noNotifications}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{t.notifications.noNotificationsDesc}</p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map(n => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.announcement;
                  const Icon = meta.icon;

                  const content = (
                    <div
                      className={cn(
                        'flex items-start gap-2.5 px-4 py-3 transition-colors cursor-pointer',
                        n.read ? 'hover:bg-gray-50' : 'bg-blue-50/30 hover:bg-blue-50/50',
                      )}
                      onClick={() => { handleMarkAsRead(n.id); if (n.link) setOpen(false); }}
                    >
                      <div className={cn('flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5', meta.bg)}>
                        <Icon size={14} className={meta.text} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-900 truncate">{n.title}</span>
                          {!n.read && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{n.message}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400">
                          <span>{n.actor}</span>
                          <span>·</span>
                          <span>{relativeTime(n.timestamp, t, language)}</span>
                        </div>
                      </div>
                    </div>
                  );

                  return n.link ? (
                    <Link key={n.id} to={n.link} className="block">{content}</Link>
                  ) : (
                    <div key={n.id}>{content}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

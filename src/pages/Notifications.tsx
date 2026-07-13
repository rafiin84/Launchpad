import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Building2, Rss, Send, UserCheck, UserX, User, Megaphone,
  CheckCheck, Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearNotifications,
  type AppNotification,
  type NotificationType,
} from '../services/notifications';
import { cn } from '../lib/cn';

// ─── Icon / colour mapping per notification type ─────────────────────────────

const TYPE_META: Record<NotificationType, { icon: React.ElementType; bg: string; text: string }> = {
  company_update:    { icon: Building2,  bg: 'bg-indigo-50',  text: 'text-indigo-500' },
  activity_post:     { icon: Rss,        bg: 'bg-emerald-50', text: 'text-emerald-500' },
  invitation_sent:   { icon: Send,       bg: 'bg-purple-50',  text: 'text-purple-500' },
  user_activated:    { icon: UserCheck,   bg: 'bg-green-50',   text: 'text-green-500' },
  user_deactivated:  { icon: UserX,       bg: 'bg-red-50',     text: 'text-red-500' },
  profile_update:    { icon: User,        bg: 'bg-sky-50',     text: 'text-sky-500' },
  announcement:      { icon: Megaphone,   bg: 'bg-amber-50',   text: 'text-amber-500' },
};

// ─── Relative time helper ────────────────────────────────────────────────────

function relativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;

  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Notifications() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    const notifs = await getNotifications();
    setNotifications(notifs);
    const count = notifs.filter(n => !n.read).length;
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    setUnreadCount(0);
  };

  // ─── Empty state ─────────────────────────────────────────────────────────────

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Bell className="w-7 h-7 text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-900">{t.notifications.noNotifications}</p>
      <p className="mt-1 text-xs text-gray-500">{t.notifications.noNotificationsDesc}</p>
    </div>
  );

  // ─── Notification card ───────────────────────────────────────────────────────

  function NotificationCard({ n }: { n: AppNotification }) {
    const meta = TYPE_META[n.type] ?? TYPE_META.announcement;
    const Icon = meta.icon;

    const inner = (
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-2xl border border-gray-100 transition-colors cursor-pointer',
          n.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/40 hover:bg-blue-50/60',
        )}
        onClick={() => handleMarkAsRead(n.id)}
      >
        {/* Icon */}
        <div className={cn('flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center', meta.bg)}>
          <Icon className={cn('w-4.5 h-4.5', meta.text)} />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">{n.title}</span>
            {!n.read && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">{n.message}</p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
            <span>{n.actor}</span>
            <span className="text-gray-300">·</span>
            <span>{relativeTime(n.timestamp)}</span>
          </div>
        </div>
      </div>
    );

    if (n.link) {
      return (
        <Link to={n.link} className="block">
          {inner}
        </Link>
      );
    }

    return inner;
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={t.notifications.title}
        description={t.notifications.description}
        action={
          notifications.length > 0 ? (
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {t.notifications.markAllRead}
                </button>
              )}
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.notifications.clearAll}
              </button>
            </div>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        emptyState
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
        </div>
      )}
    </div>
  );
}

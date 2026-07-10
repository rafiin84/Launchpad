/**
 * notifications.ts
 *
 * CRM-backed notification service. Notifications are stored as My_Activities
 * records with Activity_Type='notification' and targetRole in Activity_Tags.
 *
 * Falls back to localStorage for offline/error resilience.
 */

import { loadRole, loadToken } from './oauth';

const STORAGE_KEY = 'lp_notifications';
const MAX_NOTIFICATIONS = 100;

export type NotificationType =
  | 'company_update'
  | 'activity_post'
  | 'invitation_sent'
  | 'user_activated'
  | 'user_deactivated'
  | 'profile_update'
  | 'announcement';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actor: string;
  actorRole: 'investor' | 'founder';
  targetRole: 'investor' | 'founder';
  link?: string;
}

// ─── localStorage cache ────────────────────────────────────────────────────

function loadLocal(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveLocal(notifications: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch { /* storage full */ }
}

// ─── Server API ────────────────────────────────────────────────────────────

async function fetchFromServer(role: string): Promise<AppNotification[]> {
  const token = loadToken();
  const res = await fetch(`/api/notifications?role=${role}`, {
    headers: token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API GET ${res.status}`);
  const json = await res.json() as { notifications?: AppNotification[] };
  return json.notifications || [];
}

async function postToServer(n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): Promise<AppNotification | null> {
  const token = loadToken();
  const res = await fetch('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {}),
    },
    body: JSON.stringify(n),
  });
  if (!res.ok) throw new Error(`API POST ${res.status}`);
  const json = await res.json() as { notification?: AppNotification };
  return json.notification || null;
}

async function markReadOnServer(ids: string[]): Promise<void> {
  const token = loadToken();
  await fetch('/api/notifications', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {}),
    },
    body: JSON.stringify({ ids }),
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Fetch notifications for the current user's role from CRM.
 * Falls back to localStorage cache on failure.
 */
export async function getNotifications(): Promise<AppNotification[]> {
  const role = loadRole() || 'investor';

  try {
    const serverNotifs = await fetchFromServer(role);
    saveLocal(serverNotifs);
    return serverNotifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.warn('[Notifications] Server fetch failed, using cache:', err);
  }

  const cached = loadLocal().filter(n => n.targetRole === role);
  return cached.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/** Returns the count of unread notifications for the current role. */
export async function getUnreadCount(): Promise<number> {
  const all = await getNotifications();
  return all.filter(n => !n.read).length;
}

/**
 * Add a new notification. Posts to CRM server, caches locally as fallback.
 * targetRole determines who will see this notification.
 */
export async function addNotification(
  n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
): Promise<AppNotification> {
  const notification: AppNotification = {
    ...n,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };

  // Post to server (fire-and-forget for UX, but await for reliability)
  try {
    const serverNotif = await postToServer(n);
    if (serverNotif) {
      notification.id = serverNotif.id;
      notification.timestamp = serverNotif.timestamp || notification.timestamp;
    }
  } catch (err) {
    console.warn('[Notifications] Server post failed, cached locally:', err);
  }

  // Only cache locally if targeted at the current user's role
  const myRole = loadRole() || 'investor';
  if (n.targetRole === myRole) {
    const existing = loadLocal();
    saveLocal([notification, ...existing]);
  }

  return notification;
}

/** Mark a single notification as read by its ID. */
export async function markAsRead(id: string): Promise<void> {
  // Update local cache immediately
  const all = loadLocal();
  const updated = all.map(n => (n.id === id ? { ...n, read: true } : n));
  saveLocal(updated);

  // Sync to server
  try {
    await markReadOnServer([id]);
  } catch (err) {
    console.warn('[Notifications] Mark read failed on server:', err);
  }
}

/** Mark every notification as read. */
export async function markAllAsRead(): Promise<void> {
  const all = loadLocal();
  const unreadIds = all.filter(n => !n.read).map(n => n.id);
  const updated = all.map(n => ({ ...n, read: true }));
  saveLocal(updated);

  if (unreadIds.length > 0) {
    try {
      await markReadOnServer(unreadIds);
    } catch (err) {
      console.warn('[Notifications] Mark all read failed on server:', err);
    }
  }
}

/** Remove all notifications from local cache. */
export function clearNotifications(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ok */ }
}

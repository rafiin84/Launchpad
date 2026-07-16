/**
 * notifications.ts
 *
 * CRM-backed notification service. Notifications are stored as My_Activities
 * records with Activity_Type='notification' and targetRole in Activity_Tags.
 *
 * All CRM calls go directly to Zoho via zohoApi.ts — no /api/* server proxy.
 * Falls back to localStorage for offline/error resilience.
 */

import { loadRole } from './oauth';
import { zohoCreate, zohoSearch } from './zohoApi';

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

// ─── CRM record mapper ────────────────────────────────────────────────────

function fromCRM(r: Record<string, unknown>): AppNotification {
  const s = (k: string) => (r[k] == null ? '' : String(r[k]));
  const content = s('Content');
  let parsed: Record<string, string> = {};
  try { parsed = JSON.parse(content); } catch { }
  return {
    id: s('id'),
    type: (parsed.type || 'announcement') as NotificationType,
    title: s('Name'),
    message: parsed.message || '',
    timestamp: s('Created_Time'),
    read: parsed.read === 'true',
    actor: s('Author_Name'),
    actorRole: (s('Author_Role') || 'investor') as 'investor' | 'founder',
    targetRole: (s('Activity_Tags') || 'investor') as 'investor' | 'founder',
    link: parsed.link || '',
  };
}

// ─── CRM helpers ───────────────────────────────────────────────────────────

async function fetchFromServer(role: string): Promise<AppNotification[]> {
  const records = await zohoSearch(
    'My_Activities',
    `(Activity_Type:equals:notification)and(Activity_Tags:equals:${role})`
  );
  return records.map(r => fromCRM(r as Record<string, unknown>));
}

async function postToServer(n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): Promise<AppNotification | null> {
  const content = JSON.stringify({ type: n.type, message: n.message, link: n.link || '', read: 'false' });
  const payload: Record<string, unknown> = {
    Name: n.title,
    Activity_Type: 'notification',
    Activity_Tags: n.targetRole,
    Content: content,
    Author_Name: n.actor,
    Author_Role: n.actorRole,
  };

  try {
    const id = await zohoCreate('My_Activities', payload);
    return {
      ...n,
      id,
      timestamp: new Date().toISOString(),
      read: false,
    };
  } catch (err) {
    console.warn('[Notifications] zohoCreate failed:', err);
    return null;
  }
}

// markReadOnServer: read state is ephemeral — silently succeed, no CRM write needed
async function markReadOnServer(_ids: string[]): Promise<void> {
  // Read state is local-only; CRM notifications don't track read status per-client
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
    console.warn('[Notifications] CRM fetch failed, using cache:', err);
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
 * Add a new notification. Posts to CRM, caches locally as fallback.
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

  // Post to CRM (fire-and-forget for UX, but await for reliability)
  try {
    const serverNotif = await postToServer(n);
    if (serverNotif) {
      notification.id = serverNotif.id;
      notification.timestamp = serverNotif.timestamp || notification.timestamp;
    }
  } catch (err) {
    console.warn('[Notifications] CRM post failed, cached locally:', err);
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

  // Sync to server (no-op for CRM — read state is ephemeral)
  try {
    await markReadOnServer([id]);
  } catch (err) {
    console.warn('[Notifications] Mark read failed:', err);
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
      console.warn('[Notifications] Mark all read failed:', err);
    }
  }
}

/** Remove all notifications from local cache. */
export function clearNotifications(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ok */ }
}

/**
 * notifications.ts
 *
 * localStorage-based notification service for both Investor (CRM) and
 * Founder (Portal) users sharing the same device/browser.
 *
 * Pure service — no React hooks. All localStorage access is wrapped in
 * try/catch to match the rest of the codebase.
 */

const STORAGE_KEY = 'lp_notifications';
const MAX_NOTIFICATIONS = 100;

// ─── Types ──────────────────────────────────────────────────────────────────

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
  timestamp: string; // ISO
  read: boolean;
  actor: string; // name of who triggered it
  actorRole: 'investor' | 'founder';
  link?: string; // optional route to navigate to
}

// ─── localStorage helpers ───────────────────────────────────────────────────

function loadAll(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveAll(notifications: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch { /* storage full — ok */ }
}

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Returns all notifications, sorted newest first. */
export function getNotifications(): AppNotification[] {
  const all = loadAll();
  return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/** Returns the count of unread notifications. */
export function getUnreadCount(): number {
  return loadAll().filter(n => !n.read).length;
}

/**
 * Add a new notification. Generates an ID and timestamp, sets read=false,
 * prepends to the list, and trims to the most recent 100.
 */
export function addNotification(
  n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
): AppNotification {
  const notification: AppNotification = {
    ...n,
    id: generateId(),
    timestamp: new Date().toISOString(),
    read: false,
  };

  const existing = loadAll();
  saveAll([notification, ...existing]);

  return notification;
}

/** Mark a single notification as read by its ID. */
export function markAsRead(id: string): void {
  const all = loadAll();
  const updated = all.map(n => (n.id === id ? { ...n, read: true } : n));
  saveAll(updated);
}

/** Mark every notification as read. */
export function markAllAsRead(): void {
  const all = loadAll();
  const updated = all.map(n => ({ ...n, read: true }));
  saveAll(updated);
}

/** Remove all notifications from storage. */
export function clearNotifications(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ok */ }
}

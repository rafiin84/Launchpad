/**
 * portalUsers.ts
 * Manages the registry of invited portal users.
 *
 * When an admin sends a portal invitation from the FounderDetail page,
 * the invitee's email and assigned role are stored here. When a portal
 * user later logs in via Zoho OAuth, we look them up by email to
 * determine their role and show the correct dashboard.
 *
 * Storage strategy:
 * - localStorage: always available, device-local
 * - CRM Contacts module: cross-device (when admin is logged in)
 *
 * The Lead_Source field on the Contact record is used to track the
 * portal role assignment since it's a standard field available on all
 * Zoho CRM instances (no custom fields needed).
 */

import type { UserRole } from '../types';

// ─── localStorage registry ──────────────────────────────────────────────────

const REGISTRY_KEY = 'lp_portal_users';

export type PortalUserStatus = 'invited' | 'active' | 'disabled';

export interface PortalUserEntry {
  email: string;
  role: UserRole;
  name: string;
  contactId: string;        // Zoho CRM Contact ID
  invitedAt: string;        // ISO timestamp
  active: boolean;          // Whether portal access is active
  status?: PortalUserStatus; // Explicit status (replaces `active` flag)
}

/**
 * Derive the canonical status from a PortalUserEntry,
 * handling legacy entries that only have the `active` boolean.
 */
export function getPortalUserStatus(entry: PortalUserEntry): PortalUserStatus {
  if (entry.status) {
    // Migrate legacy 'deactivated' to 'disabled'
    if ((entry.status as string) === 'deactivated') return 'disabled';
    return entry.status;
  }
  // Legacy fallback: entries created before `status` was added
  return entry.active ? 'invited' : 'disabled';
}

/**
 * Set an explicit status on a portal user entry.
 * Also keeps the legacy `active` boolean in sync.
 */
export function setPortalUserStatus(email: string, status: PortalUserStatus): PortalUserStatus {
  const registry = loadRegistry();
  const entry = registry.find(e => e.email.toLowerCase() === email.toLowerCase());
  if (!entry) return 'disabled';
  entry.status = status;
  entry.active = status === 'active';
  saveRegistry(registry);
  return status;
}

function loadRegistry(): PortalUserEntry[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveRegistry(entries: PortalUserEntry[]) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(entries));
  } catch { /* ok */ }
}

/**
 * Register an invited portal user.
 * Called when admin sends a portal invitation.
 */
export function registerPortalUser(entry: PortalUserEntry) {
  const registry = loadRegistry();
  // Upsert by email
  const existing = registry.findIndex(e => e.email.toLowerCase() === entry.email.toLowerCase());
  if (existing >= 0) {
    registry[existing] = entry;
  } else {
    registry.push(entry);
  }
  saveRegistry(registry);
}

/**
 * Look up a portal user by email.
 * Returns null if not found.
 */
export function findPortalUser(email: string): PortalUserEntry | null {
  const registry = loadRegistry();
  return registry.find(e => e.email.toLowerCase() === email.toLowerCase()) ?? null;
}

/**
 * Get all registered portal users.
 */
export function getAllPortalUsers(): PortalUserEntry[] {
  return loadRegistry();
}

/**
 * Toggle portal user active/inactive status.
 * Returns the new active state.
 */
export function togglePortalUserActive(email: string): boolean {
  const registry = loadRegistry();
  const entry = registry.find(e => e.email.toLowerCase() === email.toLowerCase());
  if (!entry) return false;
  entry.active = !entry.active;
  saveRegistry(registry);
  return entry.active;
}

/**
 * Remove a portal user from the registry.
 */
export function removePortalUser(email: string) {
  const registry = loadRegistry().filter(e => e.email.toLowerCase() !== email.toLowerCase());
  saveRegistry(registry);
}

// ─── Session persistence for portal user login ─────────────────────────────

const PORTAL_SESSION_KEY = 'lp_portal_session';

export interface PortalSession {
  email: string;
  name: string;
  role: UserRole;
  contactId: string;
  zuid: string;
  isPortalUser: true;
}

export function savePortalSession(session: PortalSession) {
  try {
    localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session));
  } catch { /* ok */ }
}

export function loadPortalSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem(PORTAL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearPortalSession() {
  try { localStorage.removeItem(PORTAL_SESSION_KEY); } catch { /* ok */ }
}

// ─── Pre-registered portal users (seeded from CRM) ─────────────────────────
// These are the known portal users from the CRM org. When a portal user logs in
// and API calls fail (portal tokens can't call zohoapis.in), we match by email
// (captured on the login page) or ZUID.

const KNOWN_PORTAL_USERS: Array<{ email: string; name: string; contactId: string; zuid: string }> = [
  { email: 'devanand@gmail.com', name: 'Dev Anand', contactId: '', zuid: '50043237416' },
  { email: 'sgharshkiran@gmail.com', name: 'Harsh Kiran', contactId: '', zuid: '50043237521' },
  { email: 'rafiin84@gmail.com', name: 'Mohammed Rafi', contactId: '1325828000000567004', zuid: '50043289168' },
  { email: 'sharathojas@gmail.com', name: 'Sharath Rajagopalan', contactId: '', zuid: '50043339345' },
];

/**
 * Seed the portal users registry with known CRM portal users.
 * Only adds users that don't already exist in the registry.
 */
export function seedKnownPortalUsers() {
  const registry = loadRegistry();
  let added = 0;
  for (const user of KNOWN_PORTAL_USERS) {
    const exists = registry.some(e => e.email.toLowerCase() === user.email.toLowerCase());
    if (!exists) {
      registry.push({
        email: user.email,
        role: 'founder',
        name: user.name,
        contactId: user.contactId,
        invitedAt: new Date().toISOString(),
        active: true,
        status: 'active',
      });
      added++;
    }
  }
  if (added > 0) saveRegistry(registry);
}

/**
 * Find a portal user by ZUID (Zoho User ID).
 * Used when we can't get the email from API calls but have the ZUID from somewhere.
 */
export function findPortalUserByZuid(zuid: string): PortalUserEntry | null {
  if (!zuid) return null;
  const known = KNOWN_PORTAL_USERS.find(u => u.zuid === zuid);
  if (!known) return null;
  return findPortalUser(known.email);
}

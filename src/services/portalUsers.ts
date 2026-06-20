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

export interface PortalUserEntry {
  email: string;
  role: UserRole;
  name: string;
  contactId: string;        // Zoho CRM Contact ID
  invitedAt: string;        // ISO timestamp
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

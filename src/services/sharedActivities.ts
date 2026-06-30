/**
 * sharedActivities.ts
 *
 * Shared activity feed that works for both Investor (CRM) and Founder (Portal) users.
 *
 * - Posts are saved to CRM for cross-device persistence.
 * - Admin/investor tokens use the standard CRM API (zohoapis.in).
 * - Portal tokens use the portal-domain CRM API (zcrmportals.in).
 * - localStorage is a cache/fallback for offline or when both APIs fail.
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity, fetchPortalActivities, createPortalActivity } from './crmActivities';

const STORAGE_KEY = 'lp_shared_activities';

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadLocal(): CRMActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveLocal(activities: CRMActivity[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities.slice(0, 200)));
  } catch { /* storage full — ok */ }
}

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all shared activities.
 * Tries standard CRM first, then portal-domain CRM, then localStorage fallback.
 */
export async function fetchSharedActivities(_isFounder?: boolean): Promise<CRMActivity[]> {
  const localActivities = loadLocal();

  let crmActivities: CRMActivity[] = [];

  // Try standard CRM API (works for admin/investor tokens)
  try {
    crmActivities = await fetchCRMActivities();
  } catch {
    // Standard CRM failed — try portal-domain API (works for portal tokens)
    try {
      crmActivities = await fetchPortalActivities();
    } catch {
      // Both APIs failed — fall back to localStorage only
    }
  }

  if (crmActivities.length === 0) return localActivities;

  const crmIds = new Set(crmActivities.map(a => a.id));
  const localOnly = localActivities.filter(a => !crmIds.has(a.id));
  const merged = [...localOnly, ...crmActivities];

  saveLocal(merged);
  return merged;
}

/**
 * Post a new activity.
 * Tries standard CRM, then portal-domain CRM, then localStorage-only.
 */
export async function postSharedActivity(
  fields: CRMActivityFields,
  _isFounder?: boolean
): Promise<CRMActivity> {
  let id: string;

  try {
    id = await createCRMActivity(fields);
  } catch {
    // Standard CRM failed — try portal domain
    try {
      id = await createPortalActivity(fields);
    } catch {
      // Both failed — local-only
      id = generateLocalId();
    }
  }

  const activity: CRMActivity = { id, ...fields };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

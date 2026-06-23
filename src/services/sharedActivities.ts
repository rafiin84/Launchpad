/**
 * sharedActivities.ts
 *
 * Shared activity feed that works for both Investor (CRM) and Founder (Portal) users.
 *
 * - All posts are saved to localStorage so both user types can see them on the same device.
 * - Investor posts are ALSO saved to the CRM My_Activities module for persistence.
 * - On load, investors get merged CRM + localStorage activities (deduplicated by ID).
 * - Founders get localStorage activities only (they can't access CRM custom modules).
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity } from './crmActivities';

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
    // Keep only the latest 200 activities to avoid storage bloat
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities.slice(0, 200)));
  } catch { /* storage full — ok */ }
}

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all shared activities.
 * - Investors: merges CRM + localStorage (deduped by ID, sorted by recency)
 * - Founders: returns localStorage only
 */
export async function fetchSharedActivities(isFounder: boolean): Promise<CRMActivity[]> {
  const localActivities = loadLocal();

  if (isFounder) {
    // Founders can only see localStorage activities
    return localActivities;
  }

  // Investors: fetch from CRM and merge with localStorage
  let crmActivities: CRMActivity[] = [];
  try {
    crmActivities = await fetchCRMActivities();
  } catch {
    // CRM unavailable — fall back to local only
  }

  // Merge: CRM activities take precedence (they have real IDs)
  const crmIds = new Set(crmActivities.map(a => a.id));
  const localOnly = localActivities.filter(a => !crmIds.has(a.id));

  // Combine and sort — local items first (most recent), then CRM
  return [...localOnly, ...crmActivities];
}

/**
 * Post a new activity.
 * - Always saves to localStorage (visible to all users on this device)
 * - If not a founder, also saves to CRM (for cross-device persistence)
 * Returns the created activity with its ID.
 */
export async function postSharedActivity(
  fields: CRMActivityFields,
  isFounder: boolean
): Promise<CRMActivity> {
  let id: string;

  if (!isFounder) {
    // Investor: save to CRM first to get real ID
    try {
      id = await createCRMActivity(fields);
    } catch {
      // CRM failed — save locally only
      id = generateLocalId();
    }
  } else {
    // Founder: local ID only
    id = generateLocalId();
  }

  const activity: CRMActivity = { id, ...fields };

  // Save to localStorage for shared visibility
  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

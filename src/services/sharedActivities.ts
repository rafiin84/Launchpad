/**
 * sharedActivities.ts
 *
 * Shared activity feed that works for both Investor (CRM) and Founder (Portal) users.
 *
 * - All posts are saved to localStorage so both user types can see them on the same device.
 * - Posts are ALSO saved to the CRM My_Activities module for persistence.
 * - On load, CRM + localStorage activities are merged (deduplicated by ID).
 * - If CRM is unreachable (token expired, portal scope limitation), falls back to localStorage.
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities.slice(0, 200)));
  } catch { /* storage full — ok */ }
}

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all shared activities.
 * Merges CRM + localStorage (deduped by ID). Falls back to localStorage if CRM is unreachable.
 */
export async function fetchSharedActivities(_isFounder?: boolean): Promise<CRMActivity[]> {
  const localActivities = loadLocal();

  let crmActivities: CRMActivity[] = [];
  try {
    crmActivities = await fetchCRMActivities();
  } catch {
    // CRM unavailable — fall back to local only
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
 * Saves to CRM for persistence, falls back to localStorage-only if CRM fails.
 */
export async function postSharedActivity(
  fields: CRMActivityFields,
  _isFounder?: boolean
): Promise<CRMActivity> {
  let id: string;

  try {
    id = await createCRMActivity(fields);
  } catch {
    id = generateLocalId();
  }

  const activity: CRMActivity = { id, ...fields };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

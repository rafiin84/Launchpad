/**
 * sharedActivities.ts
 *
 * Shared activity feed — pure client-side CRM calls via zohoapis.in.
 * The x-crmportal header makes portal tokens work on the standard API,
 * so all users (founders + investors) use the same endpoint and see
 * the same data.
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity } from './crmActivities';

const STORAGE_KEY = 'lp_shared_activities';

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
  } catch { /* storage full */ }
}

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function fetchSharedActivities(): Promise<CRMActivity[]> {
  const localActivities = loadLocal();

  try {
    const activities = await fetchCRMActivities();
    console.log('[Activities] Fetched from CRM:', activities.length);

    if (activities.length === 0) return localActivities;

    const serverIds = new Set(activities.map(a => a.id));
    const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
    const merged = [...localOnly, ...activities];

    saveLocal(merged);
    return merged;
  } catch (err) {
    console.warn('[Activities] CRM fetch failed:', err);
    return localActivities;
  }
}

export async function postSharedActivity(fields: CRMActivityFields): Promise<CRMActivity> {
  let id: string | null = null;

  try {
    id = await createCRMActivity(fields);
    console.log('[Activities] Posted to CRM, id:', id);
  } catch (err) {
    console.warn('[Activities] CRM post failed:', err);
  }

  const activity: CRMActivity = { id: id || generateLocalId(), ...fields };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

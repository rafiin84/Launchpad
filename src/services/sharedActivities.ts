/**
 * sharedActivities.ts
 *
 * Shared activity feed with role-based visibility:
 * - Investor sees ALL activities (own + all founder posts)
 * - Founder sees own posts + all investor posts (NOT other founders' posts)
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity } from './crmActivities';
import { loadRole } from './oauth';

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

function filterByVisibility(activities: CRMActivity[], viewerRole: string | null, viewerName: string): CRMActivity[] {
  if (viewerRole === 'investor') return activities;

  // Founder: see own posts + investor posts (not other founders' posts)
  return activities.filter(a => {
    if (a.authorRole === 'investor' || !a.authorRole) return true;
    if (a.authorName?.trim().toLowerCase() === viewerName.trim().toLowerCase()) return true;
    return false;
  });
}

export async function fetchSharedActivities(viewerName = ''): Promise<CRMActivity[]> {
  const localActivities = loadLocal();
  const role = loadRole();

  try {
    const activities = await fetchCRMActivities();
    console.log('[Activities] Fetched from CRM:', activities.length);

    if (activities.length === 0) return filterByVisibility(localActivities, role, viewerName);

    const serverIds = new Set(activities.map(a => a.id));
    const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
    const merged = [...localOnly, ...activities];

    saveLocal(merged);
    return filterByVisibility(merged, role, viewerName);
  } catch (err) {
    console.warn('[Activities] CRM fetch failed:', err);
    return filterByVisibility(localActivities, role, viewerName);
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

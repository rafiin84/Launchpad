/**
 * sharedActivities.ts
 *
 * Shared activity feed with role-based visibility:
 * - Investor sees ALL activities
 * - Portal user sees: own posts + investor posts (public) + other portal users'
 *   posts only if those users have Share_Activities_Public enabled
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity } from './crmActivities';
import { loadToken } from './oauth';
import { loadRole, loadUserName } from './oauth';

const STORAGE_KEY = 'lp_shared_activities';

function fromApiRecord(r: Record<string, unknown>): CRMActivity {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:           str('id'),
    title:        str('title'),
    activityType: str('activityType'),
    content:      str('content'),
    companyName:  str('companyName'),
    authorName:   str('authorName'),
    authorRole:   str('authorRole'),
    tags:         str('tags'),
    imageUrl:     str('imageUrl'),
    imageData:    str('imageData'),
    visibility:   str('visibility'),
    createdTime:  str('createdTime'),
  };
}

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

function filterByVisibility(activities: CRMActivity[]): CRMActivity[] {
  const role = loadRole();
  const isInvestor = role === 'investor';
  const myName = (loadUserName() || '').trim().toLowerCase();

  return activities.filter(a => {
    if (a.activityType?.toLowerCase() === 'notification') return false;

    // Investor sees everything
    if (isInvestor) return true;

    // Portal user sees:
    // 1. Investor posts (always visible to portal users)
    // 2. Their own posts (always)
    // 3. Other portal user posts ONLY if visibility is explicitly 'public'
    if (a.authorRole?.toLowerCase() === 'investor') return true;
    if (myName && a.authorName?.trim().toLowerCase() === myName) return true;
    if (a.visibility?.toLowerCase() === 'public') return true;

    return false;
  });
}

async function fetchViaApi(): Promise<CRMActivity[]> {
  const token = loadToken();
  const res = await fetch('/api/activities', {
    headers: token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API GET ${res.status}`);
  const json = await res.json() as { activities?: Array<Record<string, unknown>>, _strategy?: string };
  console.log('[Activities] API strategy:', json._strategy);
  if (json._strategy === 'none') throw new Error('API returned no activities (no working strategy)');
  return (json.activities || []).map(fromApiRecord);
}

async function postViaApi(fields: CRMActivityFields): Promise<string> {
  const token = loadToken();
  const res = await fetch('/api/activities', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {}),
    },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API POST ${res.status}: ${body}`);
  }
  const json = await res.json() as { activity?: { id: string } };
  if (!json.activity?.id) throw new Error('No activity id in API response');
  return json.activity.id;
}

export async function fetchSharedActivities(): Promise<CRMActivity[]> {
  const localActivities = loadLocal();

  // Try API endpoint first (has admin token on Vercel for full visibility)
  try {
    const activities = await fetchViaApi();
    console.log('[Activities] Fetched via API:', activities.length);

    const serverIds = new Set(activities.map(a => a.id));
    const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
    const merged = [...localOnly, ...activities];
    saveLocal(merged);
    return filterByVisibility(merged);
  } catch (err) {
    console.warn('[Activities] API fetch failed, trying direct CRM:', err);
  }

  // Fallback: direct CRM call (works for portal users with x-crmportal)
  try {
    const activities = await fetchCRMActivities();
    console.log('[Activities] Fetched from CRM (direct):', activities.length);

    if (activities.length === 0) return filterByVisibility(localActivities);

    const serverIds = new Set(activities.map(a => a.id));
    const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
    const merged = [...localOnly, ...activities];
    saveLocal(merged);
    return filterByVisibility(merged);
  } catch (err) {
    console.warn('[Activities] Direct CRM fetch also failed:', err);
    return filterByVisibility(localActivities);
  }
}

export async function postSharedActivity(fields: CRMActivityFields): Promise<CRMActivity & { synced: boolean }> {
  let id: string | null = null;
  let lastError: string | null = null;

  // Try API endpoint first (admin token creates with full field access)
  try {
    id = await postViaApi(fields);
    console.log('[Activities] Posted via API, id:', id);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.warn('[Activities] API post failed, trying direct CRM:', err);
  }

  // Fallback: direct CRM call
  if (!id) {
    try {
      id = await createCRMActivity(fields);
      console.log('[Activities] Posted to CRM (direct), id:', id);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn('[Activities] Direct CRM post also failed:', err);
    }
  }

  const synced = !!id;
  if (!synced) console.error('[Activities] Activity NOT synced to CRM:', lastError);

  const activity: CRMActivity & { synced: boolean } = {
    id: id || generateLocalId(), ...fields, createdTime: new Date().toISOString(), synced,
  };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

export async function deleteSharedActivity(id: string): Promise<void> {
  // Remove from localStorage cache immediately
  const local = loadLocal();
  saveLocal(local.filter(a => a.id !== id));

  if (id.startsWith('local_')) return;

  // Delete from CRM via API
  const token = loadToken();
  const res = await fetch(`/api/activities?id=${id}`, {
    method: 'DELETE',
    headers: token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DELETE ${res.status}: ${body}`);
  }
}

export async function syncUnsyncedActivities(): Promise<number> {
  const local = loadLocal();
  const unsynced = local.filter(a => a.id.startsWith('local_'));
  if (!unsynced.length) return 0;

  let synced = 0;
  for (const activity of unsynced) {
    const fields: CRMActivityFields = {
      title: activity.title, activityType: activity.activityType,
      content: activity.content, companyName: activity.companyName,
      authorName: activity.authorName, authorRole: activity.authorRole,
      tags: activity.tags, imageUrl: activity.imageUrl, imageData: activity.imageData,
      visibility: activity.visibility,
    };

    let newId: string | null = null;
    try { newId = await postViaApi(fields); } catch { /* continue */ }
    if (!newId) {
      try { newId = await createCRMActivity(fields); } catch { /* continue */ }
    }

    if (newId) {
      activity.id = newId;
      synced++;
    }
  }

  if (synced > 0) saveLocal(local);
  console.log(`[Activities] Synced ${synced}/${unsynced.length} local activities`);
  return synced;
}

// ─── Activity sharing permissions ────────────────────────────────────────────

export interface ActivityPermission {
  id: string;
  name: string;
  email: string;
  shareActivitiesPublic: boolean;
}

export async function fetchActivityPermissions(): Promise<ActivityPermission[]> {
  const token = loadToken();
  const res = await fetch('/api/activities?action=getPermissions', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GET permissions ${res.status}`);
  const json = await res.json() as { permissions: ActivityPermission[] };
  return json.permissions;
}

export async function setActivityPermission(contactId: string, share: boolean): Promise<void> {
  const token = loadToken();
  const res = await fetch('/api/activities?action=setPermission', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {}),
    },
    body: JSON.stringify({ contactId, share }),
  });
  if (!res.ok) throw new Error(`SET permission ${res.status}`);
}

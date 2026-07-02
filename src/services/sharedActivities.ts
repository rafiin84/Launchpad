/**
 * sharedActivities.ts
 *
 * Shared activity feed with role-based visibility:
 * - Investor sees ALL activities (own + all founder posts)
 * - Founder sees own posts + all investor posts (NOT other founders' posts)
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { loadRole, loadToken } from './oauth';

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

function filterByVisibility(activities: CRMActivity[], viewerRole: string | null, viewerName: string): CRMActivity[] {
  if (viewerRole === 'investor') return activities;

  // Founder: see own posts + investor posts (not other founders' posts)
  return activities.filter(a => {
    if (a.authorRole === 'investor' || !a.authorRole) return true;
    if (a.authorName?.trim().toLowerCase() === viewerName.trim().toLowerCase()) return true;
    return false;
  });
}

async function fetchViaApi(): Promise<CRMActivity[]> {
  const token = loadToken();
  const res = await fetch('/api/activities', {
    headers: token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API GET ${res.status}`);
  const json = await res.json() as { activities?: Array<Record<string, unknown>> };
  return (json.activities || []).map(fromApiRecord);
}

export async function fetchSharedActivities(viewerName = ''): Promise<CRMActivity[]> {
  const localActivities = loadLocal();
  const role = loadRole();

  try {
    const activities = await fetchViaApi();
    console.log('[Activities] Fetched via API:', activities.length);

    if (activities.length === 0) return filterByVisibility(localActivities, role, viewerName);

    const serverIds = new Set(activities.map(a => a.id));
    const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
    const merged = [...localOnly, ...activities];

    saveLocal(merged);
    return filterByVisibility(merged, role, viewerName);
  } catch (err) {
    console.warn('[Activities] API fetch failed:', err);
    return filterByVisibility(localActivities, role, viewerName);
  }
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

export async function postSharedActivity(fields: CRMActivityFields): Promise<CRMActivity> {
  let id: string | null = null;

  try {
    id = await postViaApi(fields);
    console.log('[Activities] Posted via API, id:', id);
  } catch (err) {
    console.warn('[Activities] API post failed:', err);
  }

  const activity: CRMActivity = { id: id || generateLocalId(), ...fields };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

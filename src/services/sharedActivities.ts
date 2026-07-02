/**
 * sharedActivities.ts
 *
 * Shared activity feed with role-based visibility:
 * - Investor sees ALL activities (own + all founder posts)
 * - Founder sees own posts + all investor posts (NOT other founders' posts)
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity } from './crmActivities';
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
    const role = a.authorRole?.toLowerCase() || '';
    if (role === 'investor' || !role) return true;
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

export async function fetchSharedActivities(viewerName = ''): Promise<CRMActivity[]> {
  const localActivities = loadLocal();
  const role = loadRole();

  // Try API endpoint first (has admin token on Vercel for full visibility)
  try {
    const activities = await fetchViaApi();
    console.log('[Activities] Fetched via API:', activities.length);

    const serverIds = new Set(activities.map(a => a.id));
    const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
    const merged = [...localOnly, ...activities];
    saveLocal(merged);
    return filterByVisibility(merged, role, viewerName);
  } catch (err) {
    console.warn('[Activities] API fetch failed, trying direct CRM:', err);
  }

  // Fallback: direct CRM call (works for portal users with x-crmportal)
  try {
    const activities = await fetchCRMActivities();
    console.log('[Activities] Fetched from CRM (direct):', activities.length);

    if (activities.length === 0) return filterByVisibility(localActivities, role, viewerName);

    const serverIds = new Set(activities.map(a => a.id));
    const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
    const merged = [...localOnly, ...activities];
    saveLocal(merged);
    return filterByVisibility(merged, role, viewerName);
  } catch (err) {
    console.warn('[Activities] Direct CRM fetch also failed:', err);
    return filterByVisibility(localActivities, role, viewerName);
  }
}

export async function postSharedActivity(fields: CRMActivityFields): Promise<CRMActivity> {
  let id: string | null = null;

  // Try API endpoint first (admin token creates with full field access)
  try {
    id = await postViaApi(fields);
    console.log('[Activities] Posted via API, id:', id);
  } catch (err) {
    console.warn('[Activities] API post failed, trying direct CRM:', err);
  }

  // Fallback: direct CRM call
  if (!id) {
    try {
      id = await createCRMActivity(fields);
      console.log('[Activities] Posted to CRM (direct), id:', id);
    } catch (err) {
      console.warn('[Activities] Direct CRM post also failed:', err);
    }
  }

  const activity: CRMActivity = { id: id || generateLocalId(), ...fields };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

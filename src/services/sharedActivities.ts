/**
 * sharedActivities.ts
 *
 * Shared activity feed with role-based visibility:
 * - Investor sees ALL activities
 * - Portal user sees: own posts + investor posts (public) + other portal users'
 *   posts only if those users have Share_Activities_Public enabled
 *
 * All CRM calls go directly to Zoho via zohoApi.ts — no /api/* server proxy.
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity, deleteCRMActivity } from './crmActivities';
import { loadToken, loadRole, loadUserName } from './oauth';
import { ZOHO_HOSTS } from '../config/auth';

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

function filterByVisibility(activities: CRMActivity[], localIds: Set<string>): CRMActivity[] {
  const role = loadRole();
  const myName = (loadUserName() || '').trim().toLowerCase();

  return activities.filter(a => {
    if (a.activityType?.toLowerCase() === 'notification') return false;

    // Investors see everything
    if (role === 'investor') return true;

    // Portal founders: show all non-notification activities the CRM returned.
    // The CRM portal already scopes what records are accessible — no need to
    // re-filter here. Only hide another founder's activity if it was explicitly
    // marked investor_only AND was not created by the current user.
    const isOwnPost = localIds.has(a.id) || (myName && a.authorName?.trim().toLowerCase() === myName);
    const isInvestorOnly = a.visibility?.toLowerCase() === 'investor_only';

    if (isOwnPost) return true;
    if (isInvestorOnly) return false;
    return true;
  });
}

export async function fetchSharedActivities(): Promise<CRMActivity[]> {
  const localActivities = loadLocal();
  // IDs of activities created by this user (saved locally when posted)
  const myLocalIds = new Set(localActivities.map(a => a.id).filter(id => !id.startsWith('local_')));

  // Direct CRM call (works for both investor and portal users)
  try {
    const activities = await fetchCRMActivities();
    console.log('[Activities] Fetched from CRM (direct):', activities.length);

    if (activities.length === 0) return filterByVisibility(localActivities, myLocalIds);

    const serverIds = new Set(activities.map(a => a.id));
    const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
    const merged = [...localOnly, ...activities];
    saveLocal(merged);
    return filterByVisibility(merged, myLocalIds);
  } catch (err) {
    console.warn('[Activities] CRM fetch failed, using local cache:', err);
    return filterByVisibility(localActivities, myLocalIds);
  }
}

export async function postSharedActivity(fields: CRMActivityFields): Promise<CRMActivity & { synced: boolean }> {
  let id: string | null = null;
  let lastError: string | null = null;

  // Direct CRM call
  try {
    id = await createCRMActivity(fields);
    console.log('[Activities] Posted to CRM (direct), id:', id);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.warn('[Activities] Direct CRM post failed:', err);
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
  const local = loadLocal();
  saveLocal(local.filter(a => a.id !== id));
  if (id.startsWith('local_')) return;
  await deleteCRMActivity(id);
}

export async function deleteAllSharedActivities(ids: string[]): Promise<void> {
  saveLocal([]);
  const crmIds = ids.filter(id => !id.startsWith('local_'));
  await Promise.allSettled(crmIds.map(id => deleteCRMActivity(id)));
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
    try { newId = await createCRMActivity(fields); } catch { /* continue */ }

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

function isPortalUser(): boolean {
  return loadRole() === 'founder';
}

function buildAuthHeaders(): HeadersInit {
  const token = loadToken();
  const headers: HeadersInit = token
    ? { 'Authorization': `Zoho-oauthtoken ${token}` }
    : {};
  if (isPortalUser()) {
    return { ...headers, 'x-crmportal': 'launchpad' };
  }
  return headers;
}

export async function fetchActivityPermissions(): Promise<ActivityPermission[]> {
  const token = loadToken();
  if (!token) throw new Error('Not authenticated');

  const url = `${ZOHO_HOSTS.crmApi}/crm/v2/Contacts?per_page=200&fields=Full_Name,Email,Share_Activities_Public`;
  const res = await fetch(url, { headers: buildAuthHeaders() });
  if (!res.ok) throw new Error(`GET Contacts permissions ${res.status}`);

  const json = await res.json() as { data?: Array<Record<string, unknown>> };
  const contacts = json.data || [];

  return contacts.map(c => ({
    id: String(c.id || ''),
    name: String(c.Full_Name || ''),
    email: String(c.Email || ''),
    shareActivitiesPublic: Boolean(c.Share_Activities_Public),
  }));
}

export async function setActivityPermission(contactId: string, share: boolean): Promise<void> {
  const token = loadToken();
  if (!token) throw new Error('Not authenticated');

  const url = `${ZOHO_HOSTS.crmApi}/crm/v2/Contacts`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({ data: [{ id: contactId, Share_Activities_Public: share }] }),
  });
  if (!res.ok) throw new Error(`PUT Contact permission ${res.status}`);
}

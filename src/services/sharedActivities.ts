/**
 * sharedActivities.ts
 *
 * Shared activity feed for both Founders (portal) and Investors (admin).
 *
 * All CRM operations go through /api/activities (server-side).
 * The server tries: admin token → portal-domain proxy → client token proxy.
 * localStorage is used as a cache for instant display.
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { loadToken } from './oauth';

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

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = loadToken();
  if (token) headers['Authorization'] = `Zoho-oauthtoken ${token}`;
  return headers;
}

export async function fetchSharedActivities(): Promise<CRMActivity[]> {
  const localActivities = loadLocal();

  try {
    const res = await fetch('/api/activities', { headers: authHeaders() });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error('Non-JSON response');
    const json = await res.json() as { activities?: CRMActivity[] };
    const serverActivities = json.activities || [];

    console.log('[Activities] Fetched from server:', serverActivities.length);

    if (serverActivities.length === 0) return localActivities;

    const serverIds = new Set(serverActivities.map(a => a.id));
    const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
    const merged = [...localOnly, ...serverActivities];

    saveLocal(merged);
    return merged;
  } catch (err) {
    console.warn('[Activities] Server fetch failed:', err);
    return localActivities;
  }
}

export async function postSharedActivity(fields: CRMActivityFields): Promise<CRMActivity> {
  let id: string | null = null;

  try {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json() as { activity?: { id: string } };
    id = json.activity?.id || null;
    if (id) console.log('[Activities] Posted via server, id:', id);
  } catch (err) {
    console.warn('[Activities] Server post failed:', err);
  }

  const activity: CRMActivity = { id: id || generateLocalId(), ...fields };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

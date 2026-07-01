/**
 * sharedActivities.ts
 *
 * Shared activity feed for both Founders (portal) and Investors (admin).
 *
 * Strategy cascade:
 * 1. Server API (/api/activities) — passes client token; server tries admin token,
 *    portal-domain proxy, and client-token proxy server-side
 * 2. Direct CRM (zohoapis.in) — works for admin/investor tokens from the browser
 * 3. localStorage — offline fallback (per-browser, not shared)
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity } from './crmActivities';
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

// ─── Server API ─────────────────────────────────────────────────────────────

async function fetchFromServerApi(): Promise<CRMActivity[]> {
  const res = await fetch('/api/activities', { headers: authHeaders() });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('Non-JSON response');
  const json = await res.json() as { activities?: CRMActivity[] };
  return json.activities || [];
}

async function postToServerApi(fields: CRMActivityFields): Promise<string> {
  const res = await fetch('/api/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`API POST ${res.status}`);
  const json = await res.json() as { activity?: { id: string } };
  if (!json.activity?.id) throw new Error('No activity ID');
  return json.activity.id;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchSharedActivities(): Promise<CRMActivity[]> {
  const localActivities = loadLocal();
  let serverActivities: CRMActivity[] = [];

  // Strategy 1: Server API (handles admin token + portal proxy + client proxy)
  try {
    serverActivities = await fetchFromServerApi();
    console.log('[Activities] Fetched from server API:', serverActivities.length);
  } catch (e1) {
    console.warn('[Activities] Server API failed:', e1);

    // Strategy 2: Direct CRM (works for investor/admin tokens from browser)
    try {
      serverActivities = await fetchCRMActivities();
      console.log('[Activities] Fetched from direct CRM:', serverActivities.length);
    } catch (e2) {
      console.warn('[Activities] Direct CRM failed:', e2);
    }
  }

  // If server returned empty but we got results, check if API returned 0 records
  // vs actual empty module — try direct CRM as backup
  if (serverActivities.length === 0) {
    try {
      const directActivities = await fetchCRMActivities();
      if (directActivities.length > 0) {
        console.log('[Activities] Direct CRM backup found:', directActivities.length);
        serverActivities = directActivities;
      }
    } catch { /* direct CRM not available (portal users) */ }
  }

  if (serverActivities.length === 0) return localActivities;

  const serverIds = new Set(serverActivities.map(a => a.id));
  const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
  const merged = [...localOnly, ...serverActivities];

  saveLocal(merged);
  return merged;
}

export async function postSharedActivity(fields: CRMActivityFields): Promise<CRMActivity> {
  let id: string | null = null;

  // Strategy 1: Server API
  try {
    id = await postToServerApi(fields);
    console.log('[Activities] Posted via server API, id:', id);
  } catch (e1) {
    console.warn('[Activities] Server API post failed:', e1);

    // Strategy 2: Direct CRM (works for investors)
    try {
      id = await createCRMActivity(fields);
      console.log('[Activities] Posted via direct CRM, id:', id);
    } catch (e2) {
      console.warn('[Activities] Direct CRM post failed:', e2);
    }
  }

  const activity: CRMActivity = { id: id || generateLocalId(), ...fields };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

/**
 * sharedActivities.ts
 *
 * Shared activity feed for both Founders (portal) and Investors (admin).
 *
 * In production: all read/write goes through /api/activities (server-side
 * admin token, bypasses portal token limitation).
 *
 * In dev: falls back to direct CRM calls (admin tokens work in dev).
 *
 * localStorage is always used as a cache for instant display.
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity } from './crmActivities';

const STORAGE_KEY = 'lp_shared_activities';
const isDev = import.meta.env.DEV;

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

// ─── Server API (production) ────────────────────────────────────────────────

async function fetchFromApi(): Promise<CRMActivity[]> {
  const res = await fetch('/api/activities');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as { activities: CRMActivity[] };
  return json.activities || [];
}

async function postToApi(fields: CRMActivityFields): Promise<CRMActivity> {
  const res = await fetch('/api/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as { activity: CRMActivity };
  return json.activity;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchSharedActivities(_isFounder?: boolean): Promise<CRMActivity[]> {
  const localActivities = loadLocal();

  let serverActivities: CRMActivity[] = [];
  try {
    serverActivities = isDev ? await fetchCRMActivities() : await fetchFromApi();
  } catch {
    return localActivities;
  }

  if (serverActivities.length === 0) return localActivities;

  const serverIds = new Set(serverActivities.map(a => a.id));
  const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
  const merged = [...localOnly, ...serverActivities];

  saveLocal(merged);
  return merged;
}

export async function postSharedActivity(
  fields: CRMActivityFields,
  _isFounder?: boolean,
): Promise<CRMActivity> {
  let activity: CRMActivity;

  try {
    if (isDev) {
      const id = await createCRMActivity(fields);
      activity = { id, ...fields };
    } else {
      activity = await postToApi(fields);
    }
  } catch {
    activity = { id: generateLocalId(), ...fields };
  }

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

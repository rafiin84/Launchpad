/**
 * sharedActivities.ts
 *
 * Shared activity feed for both Founders (portal) and Investors (admin).
 *
 * Strategy cascade for fetching/posting:
 * 1. Server API (/api/activities) — uses admin token, works for all users
 * 2. Standard CRM (zohoapis.in) — works for admin/investor tokens
 * 3. Portal-domain CRM (zcrmportals.in) — works for portal tokens
 * 4. localStorage — offline fallback (per-browser, not shared)
 *
 * localStorage is always used as a cache for instant display.
 */

import type { CRMActivity, CRMActivityFields } from './crmActivities';
import { fetchCRMActivities, createCRMActivity } from './crmActivities';
import { portalList, portalCreate, type ZohoRecord } from './zohoApi';

const STORAGE_KEY = 'lp_shared_activities';

const MODULE = 'My_Activities';
const FIELD_MAP: Record<string, string> = {
  title:        'Name',
  activityType: 'Activity_Type',
  content:      'Content',
  companyName:  'Company_Name',
  authorName:   'Author_Name',
  tags:         'Activity_Tags',
  imageUrl:     'Image_URL',
  imageData:    'Activity_Image_Data',
};
const ALL_FIELDS = Object.values(FIELD_MAP).join(',');

function fromRecord(r: ZohoRecord): CRMActivity {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:           r.id,
    title:        str(FIELD_MAP.title),
    activityType: str(FIELD_MAP.activityType),
    content:      str(FIELD_MAP.content),
    companyName:  str(FIELD_MAP.companyName),
    authorName:   str(FIELD_MAP.authorName),
    tags:         str(FIELD_MAP.tags),
    imageUrl:     str(FIELD_MAP.imageUrl),
    imageData:    str(FIELD_MAP.imageData),
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

// ─── Server API ──────────────────────────────────────────────────────────────

async function fetchFromApi(): Promise<CRMActivity[]> {
  const res = await fetch('/api/activities');
  if (!res.ok) throw new Error(`API ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('API returned non-JSON');
  const json = await res.json() as { activities?: CRMActivity[] };
  return json.activities || [];
}

async function postToApi(fields: CRMActivityFields): Promise<string> {
  const res = await fetch('/api/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json() as { activity?: { id: string } };
  if (!json.activity?.id) throw new Error('No activity ID in response');
  return json.activity.id;
}

// ─── Portal-domain CRM ──────────────────────────────────────────────────────

async function fetchFromPortal(): Promise<CRMActivity[]> {
  const records = await portalList(MODULE, {
    per_page: '200',
    sort_by: 'Modified_Time',
    sort_order: 'desc',
    fields: ALL_FIELDS,
  });
  return records.map(fromRecord);
}

async function postToPortal(fields: CRMActivityFields): Promise<string> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
    const raw = (fields as Record<string, string>)[formKey] ?? '';
    if (raw !== '') payload[crmKey] = raw;
  }
  return portalCreate(MODULE, payload);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchSharedActivities(_isFounder?: boolean): Promise<CRMActivity[]> {
  const localActivities = loadLocal();
  let serverActivities: CRMActivity[] = [];

  // Try server API first (admin token — works for everyone)
  try {
    serverActivities = await fetchFromApi();
    console.log('[Activities] Fetched from server API:', serverActivities.length);
  } catch (e1) {
    console.warn('[Activities] Server API failed:', e1);

    // Try standard CRM (works for admin/investor tokens)
    try {
      serverActivities = await fetchCRMActivities();
      console.log('[Activities] Fetched from CRM:', serverActivities.length);
    } catch (e2) {
      console.warn('[Activities] Standard CRM failed:', e2);

      // Try portal-domain CRM (works for portal tokens)
      try {
        serverActivities = await fetchFromPortal();
        console.log('[Activities] Fetched from portal CRM:', serverActivities.length);
      } catch (e3) {
        console.warn('[Activities] Portal CRM failed:', e3);
      }
    }
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
  let id: string | null = null;

  // Try server API first
  try {
    id = await postToApi(fields);
    console.log('[Activities] Posted via server API, id:', id);
  } catch (e1) {
    console.warn('[Activities] Server API post failed:', e1);

    // Try standard CRM
    try {
      id = await createCRMActivity(fields);
      console.log('[Activities] Posted via CRM, id:', id);
    } catch (e2) {
      console.warn('[Activities] Standard CRM post failed:', e2);

      // Try portal-domain CRM
      try {
        id = await postToPortal(fields);
        console.log('[Activities] Posted via portal CRM, id:', id);
      } catch (e3) {
        console.warn('[Activities] Portal CRM post failed:', e3);
      }
    }
  }

  const activity: CRMActivity = { id: id || generateLocalId(), ...fields };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

/**
 * sharedActivities.ts
 *
 * Shared activity feed — pure client-side CRM calls.
 *
 * Investors (admin tokens) → zohoapis.in (via zohoList/zohoCreate)
 * Founders (portal tokens) → zcrmportals.in (via portalList/portalCreate)
 * Fallback → localStorage cache
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

function isPortalUser(): boolean {
  try {
    const raw = localStorage.getItem('lp_portal_session');
    if (!raw) return false;
    const session = JSON.parse(raw);
    return session?.isPortalUser === true;
  } catch { return false; }
}

// ─── Portal-domain CRM (for founders) ──────────────────────────────────────

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

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchSharedActivities(): Promise<CRMActivity[]> {
  const localActivities = loadLocal();
  let activities: CRMActivity[] = [];
  const isFounder = isPortalUser();

  if (isFounder) {
    // Founders: try portal domain first, then standard CRM
    try {
      activities = await fetchFromPortal();
      console.log('[Activities] Fetched from portal CRM:', activities.length);
    } catch (e1) {
      console.warn('[Activities] Portal CRM failed:', e1);
      try {
        activities = await fetchCRMActivities();
        console.log('[Activities] Fetched from standard CRM:', activities.length);
      } catch (e2) {
        console.warn('[Activities] Standard CRM failed:', e2);
      }
    }
  } else {
    // Investors: try standard CRM first, then portal domain
    try {
      activities = await fetchCRMActivities();
      console.log('[Activities] Fetched from standard CRM:', activities.length);
    } catch (e1) {
      console.warn('[Activities] Standard CRM failed:', e1);
      try {
        activities = await fetchFromPortal();
        console.log('[Activities] Fetched from portal CRM:', activities.length);
      } catch (e2) {
        console.warn('[Activities] Portal CRM failed:', e2);
      }
    }
  }

  if (activities.length === 0) return localActivities;

  const serverIds = new Set(activities.map(a => a.id));
  const localOnly = localActivities.filter(a => a.id.startsWith('local_') && !serverIds.has(a.id));
  const merged = [...localOnly, ...activities];

  saveLocal(merged);
  return merged;
}

export async function postSharedActivity(fields: CRMActivityFields): Promise<CRMActivity> {
  let id: string | null = null;
  const isFounder = isPortalUser();

  if (isFounder) {
    // Founders: try portal domain first, then standard CRM
    try {
      id = await postToPortal(fields);
      console.log('[Activities] Posted via portal CRM, id:', id);
    } catch (e1) {
      console.warn('[Activities] Portal CRM post failed:', e1);
      try {
        id = await createCRMActivity(fields);
        console.log('[Activities] Posted via standard CRM, id:', id);
      } catch (e2) {
        console.warn('[Activities] Standard CRM post failed:', e2);
      }
    }
  } else {
    // Investors: try standard CRM first, then portal domain
    try {
      id = await createCRMActivity(fields);
      console.log('[Activities] Posted via standard CRM, id:', id);
    } catch (e1) {
      console.warn('[Activities] Standard CRM post failed:', e1);
      try {
        id = await postToPortal(fields);
        console.log('[Activities] Posted via portal CRM, id:', id);
      } catch (e2) {
        console.warn('[Activities] Portal CRM post failed:', e2);
      }
    }
  }

  const activity: CRMActivity = { id: id || generateLocalId(), ...fields };

  const local = loadLocal();
  saveLocal([activity, ...local]);

  return activity;
}

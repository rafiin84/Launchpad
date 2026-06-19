/**
 * crmAppUsers.ts
 * Service for the custom "appusers" CRM module.
 *
 * On every login the app upserts the current Zoho user into this module
 * (matched by Email) so we have a persistent, app-controlled profile record.
 * The record's photo is managed via the Zoho CRM Record Image API — this
 * is the single source of truth for the user's avatar across the app.
 */

import {
  zohoUpsert, zohoSearch, zohoUpdate,
  zohoUploadRecordPhoto, zohoGetRecordPhoto,
  type ZohoRecord,
} from './zohoApi';

// ─── Module & field mapping ──────────────────────────────────────────────────

const MODULE = 'appusers';

/** CRM field API names → local keys */
const FIELD_MAP = {
  name:        'Name',           // Single-line — user display name
  email:       'Email',          // Email field — also used as duplicate-check
  phone:       'Phone',          // Phone
  mobile:      'Mobile',         // Phone
  role:        'Role',           // Single-line (investor / founder)
  bio:         'Bio',            // Multi-line
  location:    'Location',       // Single-line
  linkedIn:    'LinkedIn',       // URL
  twitter:     'Twitter',        // Single-line
  expertise:   'Expertise',      // Single-line (comma-separated)
  zohoUserId:  'Zoho_User_Id',   // Single-line — Zoho CRM user ID
  jobTitle:    'Job_Title',      // Single-line
  state:       'State',          // Single-line
  country:     'Country',        // Single-line
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;          // CRM record ID
  name: string;
  email: string;
  phone: string;
  mobile: string;
  role: string;        // investor | founder
  bio: string;
  location: string;
  linkedIn: string;
  twitter: string;
  expertise: string[];
  zohoUserId: string;
  jobTitle: string;
  state: string;
  country: string;
}

export type AppUserFields = Omit<AppUser, 'id'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(r: ZohoRecord, key: string): string {
  const v = r[key];
  if (v === null || v === undefined) return '';
  return String(v);
}

function fromRecord(r: ZohoRecord): AppUser {
  const expertiseRaw = str(r, FIELD_MAP.expertise);
  return {
    id:          r.id,
    name:        str(r, FIELD_MAP.name),
    email:       str(r, FIELD_MAP.email),
    phone:       str(r, FIELD_MAP.phone),
    mobile:      str(r, FIELD_MAP.mobile),
    role:        str(r, FIELD_MAP.role),
    bio:         str(r, FIELD_MAP.bio),
    location:    str(r, FIELD_MAP.location),
    linkedIn:    str(r, FIELD_MAP.linkedIn),
    twitter:     str(r, FIELD_MAP.twitter),
    expertise:   expertiseRaw ? expertiseRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    zohoUserId:  str(r, FIELD_MAP.zohoUserId),
    jobTitle:    str(r, FIELD_MAP.jobTitle),
    state:       str(r, FIELD_MAP.state),
    country:     str(r, FIELD_MAP.country),
  };
}

function toPayload(fields: Partial<AppUserFields>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (fields.name !== undefined)       payload[FIELD_MAP.name]       = fields.name;
  if (fields.email !== undefined)      payload[FIELD_MAP.email]      = fields.email;
  if (fields.phone !== undefined)      payload[FIELD_MAP.phone]      = fields.phone;
  if (fields.mobile !== undefined)     payload[FIELD_MAP.mobile]     = fields.mobile;
  if (fields.role !== undefined)       payload[FIELD_MAP.role]       = fields.role;
  if (fields.bio !== undefined)        payload[FIELD_MAP.bio]        = fields.bio;
  if (fields.location !== undefined)   payload[FIELD_MAP.location]   = fields.location;
  if (fields.linkedIn !== undefined)   payload[FIELD_MAP.linkedIn]   = fields.linkedIn;
  if (fields.twitter !== undefined)    payload[FIELD_MAP.twitter]    = fields.twitter;
  if (fields.expertise !== undefined)  payload[FIELD_MAP.expertise]  = fields.expertise.join(', ');
  if (fields.zohoUserId !== undefined) payload[FIELD_MAP.zohoUserId] = fields.zohoUserId;
  if (fields.jobTitle !== undefined)   payload[FIELD_MAP.jobTitle]   = fields.jobTitle;
  if (fields.state !== undefined)      payload[FIELD_MAP.state]      = fields.state;
  if (fields.country !== undefined)    payload[FIELD_MAP.country]    = fields.country;
  return payload;
}

// ─── localStorage cache for record ID (avoids repeated searches) ─────────────

const RECORD_ID_KEY = 'lp_appuser_record_id';

function cacheRecordId(id: string) {
  try { localStorage.setItem(RECORD_ID_KEY, id); } catch { /* ok */ }
}

export function loadCachedRecordId(): string | null {
  try { return localStorage.getItem(RECORD_ID_KEY); } catch { return null; }
}

export function clearCachedRecordId() {
  try { localStorage.removeItem(RECORD_ID_KEY); } catch { /* ok */ }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Upsert (insert-or-update) the current user into the appusers module.
 * Uses Email as the duplicate check field.
 * Returns the record ID.
 */
export async function syncAppUser(fields: Partial<AppUserFields> & { email: string }): Promise<string> {
  const payload = toPayload(fields);
  const result = await zohoUpsert(MODULE, payload, [FIELD_MAP.email]);
  cacheRecordId(result.id);
  return result.id;
}

/**
 * Find the current user's appusers record by email.
 * Returns null if not found.
 */
export async function findAppUserByEmail(email: string): Promise<AppUser | null> {
  try {
    const records = await zohoSearch(MODULE, `(Email:equals:${email})`);
    if (records.length === 0) return null;
    const user = fromRecord(records[0]);
    cacheRecordId(user.id);
    return user;
  } catch {
    return null;
  }
}

/**
 * Update an existing appusers record (profile edits).
 */
export async function updateAppUser(recordId: string, fields: Partial<AppUserFields>): Promise<void> {
  const payload = toPayload(fields);
  return zohoUpdate(MODULE, recordId, payload);
}

/**
 * Upload a profile photo to the appusers record.
 * Accepts a File or Blob.
 */
export async function uploadAppUserPhoto(recordId: string, file: Blob, fileName = 'photo.jpg'): Promise<void> {
  return zohoUploadRecordPhoto(MODULE, recordId, file, fileName);
}

/**
 * Fetch the appusers record's photo as a data: URL.
 * Returns null if no photo is set.
 */
export async function fetchAppUserPhoto(recordId: string): Promise<string | null> {
  return zohoGetRecordPhoto(MODULE, recordId);
}

/**
 * crmAppUsers.ts
 * Service for the custom "appusers" CRM module.
 *
 * On every login the app upserts the current Zoho user into this module
 * (matched by Email) so we have a persistent, app-controlled profile record.
 * The record's photo is managed via the Zoho CRM Record Image API — this
 * is the single source of truth for the user's avatar across the app.
 *
 * If the appusers module doesn't exist yet, all operations gracefully
 * fall back to a no-op so the app still works.
 */

import {
  zohoUpsert, zohoSearch, zohoUpdate,
  zohoUploadRecordPhoto, zohoGetRecordPhoto,
  ZOHO_BASE,
  type ZohoRecord,
} from './zohoApi';
import { loadToken } from './oauth';

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

// ─── Module availability check ──────────────────────────────────────────────

const MODULE_STATUS_KEY = 'lp_appusers_module_status';
const MODULE_CHECK_INTERVAL = 5 * 60 * 1000; // Re-check every 5 minutes

interface ModuleStatus {
  available: boolean;
  checkedAt: number;
}

function getCachedModuleStatus(): ModuleStatus | null {
  try {
    const raw = localStorage.getItem(MODULE_STATUS_KEY);
    if (!raw) return null;
    const status = JSON.parse(raw) as ModuleStatus;
    // Only trust the cache for MODULE_CHECK_INTERVAL
    if (Date.now() - status.checkedAt < MODULE_CHECK_INTERVAL) return status;
    return null;
  } catch { return null; }
}

function setCachedModuleStatus(available: boolean) {
  try {
    localStorage.setItem(MODULE_STATUS_KEY, JSON.stringify({ available, checkedAt: Date.now() }));
  } catch { /* ok */ }
}

/**
 * Check if the appusers module exists in the CRM org.
 * Caches the result in localStorage to avoid repeated calls.
 */
export async function isModuleAvailable(): Promise<boolean> {
  const cached = getCachedModuleStatus();
  if (cached !== null) return cached.available;

  const token = loadToken();
  if (!token) return false;

  try {
    // Try fetching the module metadata — if it returns 200, the module exists
    const res = await fetch(`${ZOHO_BASE}/settings/modules/${MODULE}`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    });
    const available = res.ok;
    setCachedModuleStatus(available);
    return available;
  } catch {
    return false;
  }
}

/**
 * Clear the module status cache (e.g. after user creates the module).
 */
export function clearModuleStatusCache() {
  try { localStorage.removeItem(MODULE_STATUS_KEY); } catch { /* ok */ }
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

// ─── localStorage fallback for profile data ─────────────────────────────────
// When the appusers module isn't available yet, we persist profile edits
// in localStorage so users don't lose data. On next login, if the module
// becomes available, the cached data is synced up.

const PROFILE_CACHE_KEY = 'lp_appuser_profile_cache';

export function cacheProfileLocally(fields: Partial<AppUserFields>) {
  try {
    const existing = loadCachedProfile();
    const merged = { ...existing, ...fields };
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(merged));
  } catch { /* ok */ }
}

export function loadCachedProfile(): Partial<AppUserFields> | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearCachedProfile() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ok */ }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Upsert (insert-or-update) the current user into the appusers module.
 * Uses Email as the duplicate check field.
 * Returns the record ID, or null if the module isn't available.
 */
export async function syncAppUser(fields: Partial<AppUserFields> & { email: string }): Promise<string | null> {
  // Always cache locally as backup
  cacheProfileLocally(fields);

  const available = await isModuleAvailable();
  if (!available) {
    console.warn('[AppUsers] Module "appusers" not found in CRM — skipping sync. Profile saved locally.');
    return null;
  }

  try {
    const payload = toPayload(fields);
    const result = await zohoUpsert(MODULE, payload, [FIELD_MAP.email]);
    cacheRecordId(result.id);
    return result.id;
  } catch (err) {
    console.warn('[AppUsers] Sync failed:', err);
    return null;
  }
}

/**
 * Find the current user's appusers record by email.
 * Returns null if not found or module unavailable.
 */
export async function findAppUserByEmail(email: string): Promise<AppUser | null> {
  const available = await isModuleAvailable();
  if (!available) return null;

  try {
    const records = await zohoSearch(MODULE, `(Email:equals:${email})`);
    if (records.length === 0) return null;
    const user = fromRecord(records[0]);
    cacheRecordId(user.id);

    // Also update the local profile cache with CRM data
    cacheProfileLocally({
      name: user.name,
      email: user.email,
      phone: user.phone,
      mobile: user.mobile,
      role: user.role,
      bio: user.bio,
      location: user.location,
      linkedIn: user.linkedIn,
      twitter: user.twitter,
      expertise: user.expertise,
      zohoUserId: user.zohoUserId,
      jobTitle: user.jobTitle,
      state: user.state,
      country: user.country,
    });

    return user;
  } catch {
    return null;
  }
}

/**
 * Update an existing appusers record (profile edits).
 * Also updates local cache as fallback.
 * Returns true if CRM update succeeded, false otherwise.
 */
export async function updateAppUser(recordId: string, fields: Partial<AppUserFields>): Promise<boolean> {
  // Always update local cache
  cacheProfileLocally(fields);

  const available = await isModuleAvailable();
  if (!available) {
    console.warn('[AppUsers] Module unavailable — saved to local cache only.');
    return false;
  }

  try {
    const payload = toPayload(fields);
    await zohoUpdate(MODULE, recordId, payload);
    return true;
  } catch (err) {
    console.warn('[AppUsers] Update failed:', err);
    return false;
  }
}

/**
 * Upload a profile photo to the appusers record.
 * Accepts a File or Blob.
 * Returns true if upload succeeded, false otherwise.
 */
export async function uploadAppUserPhoto(recordId: string, file: Blob, fileName = 'photo.jpg'): Promise<boolean> {
  const available = await isModuleAvailable();
  if (!available) {
    console.warn('[AppUsers] Module unavailable — cannot upload photo.');
    return false;
  }

  try {
    await zohoUploadRecordPhoto(MODULE, recordId, file, fileName);
    return true;
  } catch (err) {
    console.warn('[AppUsers] Photo upload failed:', err);
    return false;
  }
}

/**
 * Fetch the appusers record's photo as a data: URL.
 * Returns null if no photo is set or module unavailable.
 */
export async function fetchAppUserPhoto(recordId: string): Promise<string | null> {
  const available = await isModuleAvailable();
  if (!available) return null;

  return zohoGetRecordPhoto(MODULE, recordId);
}

/**
 * Full profile sync: called on login.
 * 1. Upserts basic user data from Zoho /users API
 * 2. Merges any locally-cached profile edits (bio, location, etc.)
 * 3. Returns the record ID for photo operations.
 */
export async function fullProfileSync(
  zohoUserData: {
    email: string;
    name: string;
    phone?: string;
    mobile?: string;
    zohoUserId?: string;
    jobTitle?: string;
    state?: string;
    country?: string;
  },
  role: string,
): Promise<{ recordId: string | null; appUser: AppUser | null }> {
  // Merge locally cached profile data with Zoho user data
  const cached = loadCachedProfile();
  const fields: Partial<AppUserFields> & { email: string } = {
    email:       zohoUserData.email,
    name:        cached?.name || zohoUserData.name || 'User',
    phone:       zohoUserData.phone || cached?.phone || '',
    mobile:      zohoUserData.mobile || cached?.mobile || '',
    role:        role,
    zohoUserId:  zohoUserData.zohoUserId || '',
    jobTitle:    zohoUserData.jobTitle || cached?.jobTitle || '',
    state:       zohoUserData.state || cached?.state || '',
    country:     zohoUserData.country || cached?.country || '',
    // Preserve CRM/locally-edited fields — don't overwrite with blanks
    ...(cached?.bio ? { bio: cached.bio } : {}),
    ...(cached?.location ? { location: cached.location } : {}),
    ...(cached?.linkedIn ? { linkedIn: cached.linkedIn } : {}),
    ...(cached?.twitter ? { twitter: cached.twitter } : {}),
    ...(cached?.expertise?.length ? { expertise: cached.expertise } : {}),
  };

  const recordId = await syncAppUser(fields);

  // Now fetch the full record back to get the merged data
  let appUser: AppUser | null = null;
  if (recordId) {
    appUser = await findAppUserByEmail(zohoUserData.email);
  }

  return { recordId, appUser };
}

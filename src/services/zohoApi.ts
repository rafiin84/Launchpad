// Base Zoho CRM v2 API client (browser implicit-flow).
// Authorization uses the "Zoho-oauthtoken" header format required by Zoho.

import { loadToken } from './oauth';

export const ZOHO_BASE = 'https://www.zohoapis.in/crm/v2';

export class ZohoApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = '') {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ZohoApiError';
  }
}

export interface ZohoRecord {
  id: string;
  [key: string]: unknown;
}

interface ZohoListResponse {
  data: ZohoRecord[];
  info?: { page: number; per_page: number; count: number; more_records: boolean };
  // error shape
  code?: string;
  message?: string;
  status?: string;
}

interface ZohoCUDResponse {
  data: Array<{
    code: string;
    status: string;
    message: string;
    details: { id: string };
  }>;
  // error shape (some endpoints return top-level error)
  code?: string;
  message?: string;
}

function authHeaders(): HeadersInit {
  const token = loadToken();
  if (!token) throw new ZohoApiError(401, 'Not connected to Zoho. Please sign in first.', 'NO_TOKEN');
  return {
    'Authorization': `Zoho-oauthtoken ${token}`,
    'Content-Type': 'application/json',
  };
}

// Zoho sometimes returns HTTP 200 with an error body — check both.
function assertNoZohoError(json: ZohoListResponse | ZohoCUDResponse, httpStatus: number): void {
  if ('code' in json && json.code && json.code !== 'SUCCESS') {
    throw new ZohoApiError(httpStatus, (json as { message?: string }).message ?? json.code, json.code);
  }
}

export async function zohoList(module: string, params: Record<string, string> = {}): Promise<ZohoRecord[]> {
  const url = new URL(`${ZOHO_BASE}/${module}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (res.status === 204) return [];

  const json: ZohoListResponse = await res.json();

  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data ?? [];
}

export async function zohoGetById(module: string, id: string, fields?: string): Promise<ZohoRecord | null> {
  const url = fields ? `${ZOHO_BASE}/${module}/${id}?fields=${encodeURIComponent(fields)}` : `${ZOHO_BASE}/${module}/${id}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 404) return null;

  const json: ZohoListResponse = await res.json();

  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data?.[0] ?? null;
}

export async function zohoCreate(module: string, data: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${ZOHO_BASE}/${module}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ data: [data] }),
  });

  const json: ZohoCUDResponse = await res.json();

  // Top-level error (e.g. INVALID_MODULE on POST)
  if (json.code && json.code !== 'SUCCESS') {
    throw new ZohoApiError(res.status, json.message ?? json.code, json.code);
  }

  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') {
    throw new ZohoApiError(res.status, result?.message ?? 'Create failed', result?.code ?? '');
  }

  return result.details.id;
}

export async function zohoUpdate(module: string, id: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${ZOHO_BASE}/${module}/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ data: [{ id, ...data }] }),
  });

  const json: ZohoCUDResponse = await res.json();

  if (json.code && json.code !== 'SUCCESS') {
    throw new ZohoApiError(res.status, json.message ?? json.code, json.code);
  }

  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') {
    throw new ZohoApiError(res.status, result?.message ?? 'Update failed', result?.code ?? '');
  }
}

export async function zohoDelete(module: string, id: string): Promise<void> {
  const res = await fetch(`${ZOHO_BASE}/${module}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { message?: string; code?: string };
    throw new ZohoApiError(res.status, json.message ?? `Delete failed: ${res.status}`, json.code ?? '');
  }
}

// ─── Upsert (insert-or-update) ────────────────────────────────────────────────

export async function zohoUpsert(
  module: string,
  data: Record<string, unknown>,
  duplicateCheckFields: string[],
): Promise<{ id: string; action: 'insert' | 'update' }> {
  const res = await fetch(`${ZOHO_BASE}/${module}/upsert`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      data: [data],
      duplicate_check_fields: duplicateCheckFields,
    }),
  });

  const json: ZohoCUDResponse = await res.json();

  if (json.code && json.code !== 'SUCCESS') {
    throw new ZohoApiError(res.status, json.message ?? json.code, json.code);
  }

  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') {
    throw new ZohoApiError(res.status, result?.message ?? 'Upsert failed', result?.code ?? '');
  }

  return {
    id: result.details.id,
    action: (result as unknown as { action: string }).action === 'update' ? 'update' : 'insert',
  };
}

// ─── Search records (COQL or criteria) ───────────────────────────────────────

export async function zohoSearch(module: string, criteria: string): Promise<ZohoRecord[]> {
  const url = `${ZOHO_BASE}/${module}/search?criteria=${encodeURIComponent(criteria)}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 204) return [];
  const json: ZohoListResponse = await res.json();
  if (!res.ok && res.status !== 204) {
    throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  }
  return json.data ?? [];
}

// ─── Record Image API ─────────────────────────────────────────────────────────

/**
 * Upload a photo to a CRM record.
 * Uses the Record Image API: POST /crm/v2/{module}/{id}/photo
 */
export async function zohoUploadRecordPhoto(module: string, recordId: string, file: Blob, fileName = 'photo.jpg'): Promise<void> {
  const token = loadToken();
  if (!token) throw new ZohoApiError(401, 'Not connected', 'NO_TOKEN');

  const formData = new FormData();
  formData.append('file', file, fileName);

  const res = await fetch(`${ZOHO_BASE}/${module}/${recordId}/photo`, {
    method: 'POST',
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { message?: string; code?: string };
    throw new ZohoApiError(res.status, json.message ?? 'Photo upload failed', json.code ?? '');
  }
}

/**
 * Download a record's photo as a data: URL (for caching/display).
 * Uses: GET /crm/v2/{module}/{id}/photo
 * Returns null if no photo exists.
 */
export async function zohoGetRecordPhoto(module: string, recordId: string): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;

  try {
    const res = await fetch(`${ZOHO_BASE}/${module}/${recordId}/photo`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    });

    if (!res.ok || res.status === 204) return null;

    const blob = await res.blob();
    if (!blob.size || blob.type.includes('json') || blob.type.includes('html')) return null;

    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result?.startsWith('data:') ? result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Current user ─────────────────────────────────────────────────────────────

export interface ZohoCurrentUser {
  id: string;
  full_name: string;
  email: string;
  profile?: { name: string };
  Zuid?: string;
  zuid?: string;
}

export async function fetchCurrentZohoUser(): Promise<ZohoCurrentUser | null> {
  try {
    const res = await fetch(`${ZOHO_BASE}/users?type=CurrentUser`, { headers: authHeaders() });
    const json = await res.json() as { users?: ZohoCurrentUser[] };
    return json.users?.[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Zoho Accounts user info (works for ALL Zoho users including portal) ─────

export interface ZohoAccountsUser {
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  zuid: string;
  picture?: string;
}

/**
 * Fetch the authenticated user's identity from Zoho Accounts.
 * This works for ALL Zoho users — including portal users who don't
 * have a CRM user record. Uses the AaaServer.profile.READ scope.
 */
export async function fetchZohoAccountsUser(): Promise<ZohoAccountsUser | null> {
  const token = loadToken();
  if (!token) return null;

  try {
    const res = await fetch('https://accounts.zoho.in/oauth/user/info', {
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const email = (data.Email ?? data.email ?? '') as string;
    if (!email) return null;

    return {
      email,
      first_name:   (data.First_Name ?? data.first_name ?? '') as string,
      last_name:    (data.Last_Name ?? data.last_name ?? '') as string,
      display_name: (data.Display_Name ?? data.display_name ?? data.full_name ?? '') as string,
      zuid:         String(data.ZUID ?? data.zuid ?? ''),
      picture:      (data.picture ?? data.photo_url ?? data.imageURL ?? undefined) as string | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the current user's profile photo URL via the Zoho Accounts API.
 * Uses the AaaServer.profile.READ scope to call /oauth/user/info,
 * which returns user data including a publicly accessible photo URL.
 * This avoids CORS issues that plague the CRM photo endpoints.
 */
export async function fetchUserPhoto(): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;

  try {
    // Zoho Accounts user info endpoint — returns profile data including photo URL
    const res = await fetch('https://accounts.zoho.in/oauth/user/info', {
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    // The API returns a "picture" field with the photo URL
    const photoUrl = (data.picture ?? data.photo_url ?? data.imageURL ?? null) as string | null;
    if (photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('http')) {
      return photoUrl;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchZohoOrgName(): Promise<string | null> {
  try {
    const res = await fetch(`${ZOHO_BASE}/org`, { headers: authHeaders() });
    const json = await res.json() as { org?: Array<{ company_name?: string }> };
    return json.org?.[0]?.company_name ?? null;
  } catch {
    return null;
  }
}

// ─── Module discovery ─────────────────────────────────────────────────────────

export interface ZohoModule {
  id: string;
  module_name: string;       // display name
  api_name: string;          // use this in API calls
  plural_label: string;
  singular_label: string;
}

export async function fetchZohoModules(): Promise<ZohoModule[]> {
  const res = await fetch(`${ZOHO_BASE}/settings/modules`, { headers: authHeaders() });
  const json = await res.json() as { modules?: ZohoModule[] };
  return json.modules ?? [];
}

// Find module whose display name or api_name matches a keyword (case-insensitive).
export async function findModuleApiName(keyword: string): Promise<string | null> {
  const modules = await fetchZohoModules();
  const kw = keyword.toLowerCase();
  const found = modules.find(
    m => m.api_name.toLowerCase().includes(kw) || m.module_name.toLowerCase().includes(kw)
  );
  return found?.api_name ?? null;
}

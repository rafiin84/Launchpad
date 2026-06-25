// Base Zoho CRM API client (browser implicit-flow).
// Authorization uses the "Zoho-oauthtoken" header format required by Zoho.
// In local dev, requests go through Vite proxy to bypass CORS.
// In production (Vercel), requests go through serverless API proxy.
//
// Portal OAuth tokens (from zcrmportals.in) cannot be used with the standard
// CRM REST API (zohoapis.in). Portal user CRM requests are routed through a
// server-side proxy (/api/portal-crm-proxy) that uses the admin refresh token.

import { loadToken, OAuthConfig, loadRole } from './oauth';
import { loadPortalSession } from './portalUsers';

const isDev = import.meta.env.DEV;

function isPortalUser(): boolean {
  if (loadRole() === 'founder') return true;
  const session = loadPortalSession();
  return session?.isPortalUser === true;
}

// ─── Proxy helpers ───────────────────────────────────────────────────────────

function buildCrmUrl(apiPath: string): string {
  if (isPortalUser()) {
    // Portal OAuth tokens (zcrmportals.in) can't call the CRM REST API directly.
    // Route through server-side proxy that uses the admin refresh token.
    if (isDev) {
      // In dev, Vercel serverless functions aren't available.
      // Fall through to Vite proxy — will fail, but caller catches errors gracefully.
      return `/zoho-crm-proxy${apiPath}`;
    }
    return `/api/portal-crm-proxy?path=${encodeURIComponent(apiPath)}`;
  }
  if (isDev) {
    return `/zoho-crm-proxy${apiPath}`;
  }
  const token = loadToken();
  return `/api/zoho-crm-proxy?path=${encodeURIComponent(apiPath)}&token=${encodeURIComponent(token || '')}`;
}

function buildAccountsUrl(apiPath: string): string {
  // apiPath like "/oauth/user/info"
  if (isDev) {
    return `/zoho-accounts-proxy${apiPath}`;
  }
  const token = loadToken();
  return `/api/zoho-accounts-proxy?path=${encodeURIComponent(apiPath)}&token=${encodeURIComponent(token || '')}`;
}

/**
 * Headers to send with requests.
 * In dev: include Authorization header (Vite proxy forwards it).
 * In prod: token is in query param, so no Authorization header needed
 *          (the serverless proxy adds it server-side).
 */
function getHeaders(includeAuth = true): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (isDev && includeAuth) {
    const token = loadToken();
    if (!token) throw new ZohoApiError(401, 'Not connected to Zoho. Please sign in first.', 'NO_TOKEN');
    headers['Authorization'] = `Zoho-oauthtoken ${token}`;
  }
  return headers;
}

/** @deprecated Use buildCrmUrl(). Kept for backwards compat. */
export function getZohoBase(): string {
  if (isDev) return '/zoho-crm-proxy/crm/v2';
  return 'https://www.zohoapis.in/crm/v2';
}

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
  code?: string;
  message?: string;
}

function ensureToken(): string {
  const token = loadToken();
  if (!token) throw new ZohoApiError(401, 'Not connected to Zoho. Please sign in first.', 'NO_TOKEN');
  return token;
}

function assertNoZohoError(json: ZohoListResponse | ZohoCUDResponse, httpStatus: number): void {
  if ('code' in json && json.code && json.code !== 'SUCCESS') {
    throw new ZohoApiError(httpStatus, (json as { message?: string }).message ?? json.code, json.code);
  }
}

// ─── CRUD operations ────────────────────────────────────────────────────────

export async function zohoList(module: string, params: Record<string, string> = {}): Promise<ZohoRecord[]> {
  ensureToken();
  const qs = new URLSearchParams(params).toString();
  const apiPath = `/crm/v2/${module}${qs ? `?${qs}` : ''}`;
  const url = buildCrmUrl(apiPath);

  const res = await fetch(url, { headers: getHeaders() });
  if (res.status === 204) return [];

  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data ?? [];
}

export async function zohoGetById(module: string, id: string, fields?: string): Promise<ZohoRecord | null> {
  ensureToken();
  const apiPath = fields ? `/crm/v2/${module}/${id}?fields=${encodeURIComponent(fields)}` : `/crm/v2/${module}/${id}`;
  const url = buildCrmUrl(apiPath);

  const res = await fetch(url, { headers: getHeaders() });
  if (res.status === 404) return null;

  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data?.[0] ?? null;
}

export async function zohoCreate(module: string, data: Record<string, unknown>): Promise<string> {
  ensureToken();
  const url = buildCrmUrl(`/crm/v2/${module}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ data: [data] }),
  });

  const json: ZohoCUDResponse = await res.json();

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
  ensureToken();
  const url = buildCrmUrl(`/crm/v2/${module}/${id}`);

  const res = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
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
  ensureToken();
  const url = buildCrmUrl(`/crm/v2/${module}/${id}`);

  const res = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
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
  ensureToken();
  const url = buildCrmUrl(`/crm/v2/${module}/upsert`);

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
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
  ensureToken();
  const apiPath = `/crm/v2/${module}/search?criteria=${encodeURIComponent(criteria)}`;
  const url = buildCrmUrl(apiPath);

  const res = await fetch(url, { headers: getHeaders() });
  if (res.status === 204) return [];
  const json: ZohoListResponse = await res.json();
  if (!res.ok && res.status !== 204) {
    throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  }
  return json.data ?? [];
}

// ─── Record Image API ─────────────────────────────────────────────────────────

export async function zohoUploadRecordPhoto(module: string, recordId: string, file: Blob, fileName = 'photo.jpg'): Promise<void> {
  const token = ensureToken();

  // Portal users: photo upload not supported (would need server-side multipart proxy)
  if (isPortalUser()) {
    throw new ZohoApiError(403, 'Photo upload not available for portal users', 'PORTAL_UNSUPPORTED');
  }

  const base = isDev ? '/zoho-crm-proxy' : 'https://www.zohoapis.in';
  const formData = new FormData();
  formData.append('file', file, fileName);

  const res = await fetch(`${base}/crm/v2/${module}/${recordId}/photo`, {
    method: 'POST',
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { message?: string; code?: string };
    throw new ZohoApiError(res.status, json.message ?? 'Photo upload failed', json.code ?? '');
  }
}

export async function zohoGetRecordPhoto(module: string, recordId: string): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;

  // Portal users: skip direct photo fetch (would need server-side proxy)
  if (isPortalUser()) return null;

  const base = isDev ? '/zoho-crm-proxy' : 'https://www.zohoapis.in';
  try {
    const res = await fetch(`${base}/crm/v2/${module}/${recordId}/photo`, {
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
  if (isPortalUser()) return null;
  try {
    ensureToken();
    const url = buildCrmUrl('/crm/v2/users?type=CurrentUser');
    const res = await fetch(url, { headers: getHeaders() });
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

export async function fetchZohoAccountsUser(): Promise<ZohoAccountsUser | null> {
  const token = loadToken();
  if (!token) return null;

  try {
    const url = buildAccountsUrl('/oauth/user/info');
    const res = await fetch(url, {
      headers: isDev ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {},
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

export async function fetchUserPhoto(): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;

  try {
    const url = buildAccountsUrl('/oauth/user/info');
    const res = await fetch(url, {
      headers: isDev ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const photoUrl = (data.picture ?? data.photo_url ?? data.imageURL ?? null) as string | null;
    if (photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('http')) {
      return photoUrl;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Search for a CRM Contact by email and return their name + id.
 * Works with the portal user's own token via zoho-crm-proxy.
 * This is a client-side fallback for when /api/portal-identity is unavailable.
 */
export async function searchContactByEmail(email: string): Promise<{ name: string; contactId: string } | null> {
  const token = loadToken();
  if (!token || !email) return null;

  try {
    const url = buildCrmUrl(`/crm/v2/Contacts/search?email=${encodeURIComponent(email)}`);
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok || res.status === 204) return null;

    const json = await res.json() as { data?: Array<Record<string, unknown>> };
    const contact = json.data?.[0];
    if (!contact) return null;

    const firstName = (contact.First_Name || '') as string;
    const lastName = (contact.Last_Name || '') as string;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    return fullName ? { name: fullName, contactId: String(contact.id || '') } : null;
  } catch {
    return null;
  }
}

/**
 * Fetch the current portal user's Contact record from CRM.
 *
 * Since portal tokens can't call the CRM API directly, this uses the
 * server-side admin proxy. It looks up the Contact by email from the
 * portal session (or falls back to /crm/v2/Contacts?per_page=1 for
 * non-portal callers).
 */
export async function fetchPortalUserContact(): Promise<{ name: string; email: string; contactId: string } | null> {
  const token = loadToken();
  if (!token) return null;

  // For portal users, look up contact by email from portal session
  if (isPortalUser()) {
    const session = loadPortalSession();
    const email = session?.email;
    if (email) {
      return searchContactByEmail(email).then(result => {
        if (result) return { ...result, email };
        return null;
      }).catch(() => null);
    }
    return null;
  }

  // For non-portal users, fetch directly
  try {
    const url = buildCrmUrl('/crm/v2/Contacts?fields=First_Name,Last_Name,Email&per_page=1');
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok || res.status === 204) return null;

    const json = await res.json() as { data?: Array<Record<string, unknown>> };
    const contact = json.data?.[0];
    if (!contact) return null;

    const firstName = (contact.First_Name || '') as string;
    const lastName = (contact.Last_Name || '') as string;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const email = (contact.Email || '') as string;

    return {
      name: fullName || '',
      email: email.toLowerCase(),
      contactId: String(contact.id || ''),
    };
  } catch {
    return null;
  }
}

export async function fetchZohoOrgName(): Promise<string | null> {
  if (isPortalUser()) return null;
  try {
    ensureToken();
    const url = buildCrmUrl('/crm/v2/org');
    const res = await fetch(url, { headers: getHeaders() });
    const json = await res.json() as { org?: Array<{ company_name?: string }> };
    return json.org?.[0]?.company_name ?? null;
  } catch {
    return null;
  }
}

// ─── Module discovery ─────────────────────────────────────────────────────────

export interface ZohoModule {
  id: string;
  module_name: string;
  api_name: string;
  plural_label: string;
  singular_label: string;
}

export async function fetchZohoModules(): Promise<ZohoModule[]> {
  if (isPortalUser()) return [];
  ensureToken();
  const url = buildCrmUrl('/crm/v2/settings/modules');
  const res = await fetch(url, { headers: getHeaders() });
  const json = await res.json() as { modules?: ZohoModule[] };
  return json.modules ?? [];
}

export async function findModuleApiName(keyword: string): Promise<string | null> {
  const modules = await fetchZohoModules();
  const kw = keyword.toLowerCase();
  const found = modules.find(
    m => m.api_name.toLowerCase().includes(kw) || m.module_name.toLowerCase().includes(kw)
  );
  return found?.api_name ?? null;
}

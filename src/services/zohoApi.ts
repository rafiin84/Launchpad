// Base Zoho CRM v2 API client (browser implicit-flow).
// Authorization uses the "Zoho-oauthtoken" header format required by Zoho.
// India (.in) datacenter only.
// In local dev, requests go through Vite proxy to bypass CORS.

import { loadToken, OAuthConfig } from './oauth';

const isDev = import.meta.env.DEV;

// In dev: use Vite proxy prefix (same-origin, no CORS issues)
// In prod: call Zoho APIs directly (CORS works from deployed domain)
const CRM_BASE = isDev ? '/zoho-crm-proxy/crm/v2' : 'https://www.zohoapis.in/crm/v2';
const ACCOUNTS_BASE = isDev ? '/zoho-accounts-proxy' : 'https://accounts.zoho.in';

/** CRM API base URL (India .in datacenter) */
export function getZohoBase(): string {
  return CRM_BASE;
}

/** Zoho Accounts API base URL */
function getAccountsUrl(): string {
  return ACCOUNTS_BASE;
}

/** @deprecated Use getZohoBase(). Kept for backwards compat. */
export const ZOHO_BASE = CRM_BASE;

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

function authHeaders(): HeadersInit {
  const token = loadToken();
  if (!token) throw new ZohoApiError(401, 'Not connected to Zoho. Please sign in first.', 'NO_TOKEN');
  return {
    'Authorization': `Zoho-oauthtoken ${token}`,
    'Content-Type': 'application/json',
  };
}

function assertNoZohoError(json: ZohoListResponse | ZohoCUDResponse, httpStatus: number): void {
  if ('code' in json && json.code && json.code !== 'SUCCESS') {
    throw new ZohoApiError(httpStatus, (json as { message?: string }).message ?? json.code, json.code);
  }
}

export async function zohoList(module: string, params: Record<string, string> = {}): Promise<ZohoRecord[]> {
  const base = getZohoBase();
  const qs = new URLSearchParams(params).toString();
  const url = `${base}/${module}${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 204) return [];

  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data ?? [];
}

export async function zohoGetById(module: string, id: string, fields?: string): Promise<ZohoRecord | null> {
  const base = getZohoBase();
  const url = fields ? `${base}/${module}/${id}?fields=${encodeURIComponent(fields)}` : `${base}/${module}/${id}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 404) return null;

  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data?.[0] ?? null;
}

export async function zohoCreate(module: string, data: Record<string, unknown>): Promise<string> {
  const base = getZohoBase();
  const res = await fetch(`${base}/${module}`, {
    method: 'POST',
    headers: authHeaders(),
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
  const base = getZohoBase();
  const res = await fetch(`${base}/${module}/${id}`, {
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
  const base = getZohoBase();
  const res = await fetch(`${base}/${module}/${id}`, {
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
  const base = getZohoBase();
  const res = await fetch(`${base}/${module}/upsert`, {
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
  const base = getZohoBase();
  const url = `${base}/${module}/search?criteria=${encodeURIComponent(criteria)}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 204) return [];
  const json: ZohoListResponse = await res.json();
  if (!res.ok && res.status !== 204) {
    throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  }
  return json.data ?? [];
}

// ─── Record Image API ─────────────────────────────────────────────────────────

export async function zohoUploadRecordPhoto(module: string, recordId: string, file: Blob, fileName = 'photo.jpg'): Promise<void> {
  const token = loadToken();
  if (!token) throw new ZohoApiError(401, 'Not connected', 'NO_TOKEN');

  const base = getZohoBase();
  const formData = new FormData();
  formData.append('file', file, fileName);

  const res = await fetch(`${base}/${module}/${recordId}/photo`, {
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

  const base = getZohoBase();
  try {
    const res = await fetch(`${base}/${module}/${recordId}/photo`, {
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
  const base = getZohoBase();
  try {
    const res = await fetch(`${base}/users?type=CurrentUser`, { headers: authHeaders() });
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

  const accountsBase = getAccountsUrl();
  try {
    const res = await fetch(`${accountsBase}/oauth/user/info`, {
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

export async function fetchUserPhoto(): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;

  const accountsBase = getAccountsUrl();
  try {
    const res = await fetch(`${accountsBase}/oauth/user/info`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
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

export async function fetchZohoOrgName(): Promise<string | null> {
  const base = getZohoBase();
  try {
    const res = await fetch(`${base}/org`, { headers: authHeaders() });
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
  const base = getZohoBase();
  const res = await fetch(`${base}/settings/modules`, { headers: authHeaders() });
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

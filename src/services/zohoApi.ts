// Zoho CRM API client — calls Zoho APIs directly using the access token from localStorage.

import { loadToken, loadApiDomain, loadRole } from './oauth';
import { ZOHO_HOSTS } from '../config/auth';

function buildCrmUrl(apiPath: string): string {
  return `${ZOHO_HOSTS.crmApi}${apiPath}`;
}

function buildAccountsUrl(apiPath: string): string {
  return `${ZOHO_HOSTS.accounts}${apiPath}`;
}

function buildPortalCrmUrl(apiPath: string): string {
  return `${ZOHO_HOSTS.portalCrm}${apiPath}`;
}

function isPortalUser(): boolean {
  return loadRole() === 'founder';
}

function plainAuthHeader(): HeadersInit {
  const token = loadToken();
  if (!token) throw new ZohoApiError(401, 'Not connected to Zoho. Please sign in first.', 'NO_TOKEN');
  return {
    'Authorization': `Zoho-oauthtoken ${token}`,
  };
}

function authHeader(): HeadersInit {
  const headers = plainAuthHeader();
  if (isPortalUser()) {
    return { ...headers, 'x-crmportal': ZOHO_HOSTS.portalName };
  }
  return headers;
}

function jsonHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...plainAuthHeader(),
  };
  if (isPortalUser()) {
    return { ...headers, 'x-crmportal': ZOHO_HOSTS.portalName };
  }
  return headers;
}

/** @deprecated Use buildCrmUrl(). */
export function getZohoBase(): string {
  return buildCrmUrl('/crm/v2');
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

  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 204) return [];

  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data ?? [];
}

// Same as zohoList but uses plain auth (no x-crmportal header).
// Used by portal founders to fetch My_Activities without portal user-scoping,
// so investor-posted activities are included in the response.
export async function zohoListUnscoped(module: string, params: Record<string, string> = {}): Promise<ZohoRecord[]> {
  ensureToken();
  const qs = new URLSearchParams(params).toString();
  const apiPath = `/crm/v2/${module}${qs ? `?${qs}` : ''}`;
  const url = buildCrmUrl(apiPath);

  const res = await fetch(url, { headers: plainAuthHeader() });
  if (res.status === 204) return [];

  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data ?? [];
}

export async function zohoGetById(module: string, id: string, fields?: string): Promise<ZohoRecord | null> {
  ensureToken();
  const qs = fields ? `?fields=${fields}` : '';
  const apiPath = `/crm/v2/${module}/${id}${qs}`;
  const url = buildCrmUrl(apiPath);

  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 204 || res.status === 404) return null;

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
    headers: jsonHeaders(),
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
    headers: jsonHeaders(),
    body: JSON.stringify({ data: [{ id, ...data }] }),
  });

  const json: ZohoCUDResponse = await res.json();
  console.log('[CRM] zohoUpdate response:', JSON.stringify(json));

  if (json.code && json.code !== 'SUCCESS') {
    throw new ZohoApiError(res.status, json.message ?? json.code, json.code);
  }

  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') {
    const detail = result?.details ? JSON.stringify(result.details) : '';
    throw new ZohoApiError(res.status, `${result?.message ?? 'Update failed'}${detail ? ': ' + detail : ''}`, result?.code ?? '');
  }
}

export async function zohoDelete(module: string, id: string): Promise<void> {
  ensureToken();
  const url = buildCrmUrl(`/crm/v2/${module}/${id}`);

  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeader(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { message?: string; code?: string };
    throw new ZohoApiError(res.status, json.message ?? `Delete failed: ${res.status}`, json.code ?? '');
  }
}

// ─── Portal-domain CRUD (for portal tokens that fail on zohoapis.in) ─────────

export async function portalList(module: string, params: Record<string, string> = {}): Promise<ZohoRecord[]> {
  ensureToken();
  const qs = new URLSearchParams(params).toString();
  const apiPath = `/crm/v2/${module}${qs ? `?${qs}` : ''}`;
  const url = buildPortalCrmUrl(apiPath);

  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 204) return [];

  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data ?? [];
}

// Same as portalList but without the x-crmportal header.
// On zcrmportals.in, omitting the portal header returns ALL records the token
// can access (not just portal-scoped own records), which includes investor posts.
export async function portalListUnscoped(module: string, params: Record<string, string> = {}): Promise<ZohoRecord[]> {
  ensureToken();
  const qs = new URLSearchParams(params).toString();
  const apiPath = `/crm/v2/${module}${qs ? `?${qs}` : ''}`;
  const url = buildPortalCrmUrl(apiPath);

  const res = await fetch(url, { headers: plainAuthHeader() });
  if (res.status === 204) return [];

  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  assertNoZohoError(json, res.status);

  return json.data ?? [];
}

export async function portalGetById(module: string, id: string, fields?: string): Promise<ZohoRecord | null> {
  ensureToken();
  const qs = fields ? `?fields=${encodeURIComponent(fields)}` : '';
  const url = buildPortalCrmUrl(`/crm/v2/${module}/${id}${qs}`);

  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 204 || res.status === 404) return null;

  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');

  return json.data?.[0] ?? null;
}

export async function portalCreate(module: string, data: Record<string, unknown>): Promise<string> {
  ensureToken();
  const url = buildPortalCrmUrl(`/crm/v2/${module}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { ...jsonHeaders(), },
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
    headers: jsonHeaders(),
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

  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 204) return [];
  const json: ZohoListResponse = await res.json();
  if (!res.ok && res.status !== 204) {
    throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  }
  return json.data ?? [];
}

// ─── COQL query — returns textarea fields that list endpoint omits ────────────

// Portal-domain COQL — for portal user tokens that can't reach www.zohoapis.in
export async function portalCoql(query: string): Promise<ZohoRecord[]> {
  ensureToken();
  const url = buildPortalCrmUrl('/crm/v2.1/coql');
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...plainAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ select_query: query }),
  });
  if (res.status === 204) return [];
  const json = await res.json() as { data?: ZohoRecord[]; message?: string; code?: string };
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  return json.data ?? [];
}

export async function zohoCoql(query: string): Promise<ZohoRecord[]> {
  ensureToken();
  const url = buildCrmUrl('/crm/v2.1/coql');
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...plainAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ select_query: query }),
  });
  if (res.status === 204) return [];
  const json = await res.json() as { data?: ZohoRecord[]; message?: string; code?: string };
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  return json.data ?? [];
}

// ─── Record Image API ─────────────────────────────────────────────────────────

export async function zohoUploadRecordPhoto(module: string, recordId: string, file: Blob, fileName = 'photo.jpg'): Promise<void> {
  const token = ensureToken();

  const formData = new FormData();
  formData.append('file', file, fileName);

  const res = await fetch(`${buildCrmUrl(`/crm/v2/${module}/${recordId}/photo`)}`, {
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

  try {
    const res = await fetch(`${buildCrmUrl(`/crm/v2/${module}/${recordId}/photo`)}`, {
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

export async function portalUploadRecordPhoto(module: string, recordId: string, file: Blob, fileName = 'photo.jpg'): Promise<void> {
  const token = ensureToken();
  const formData = new FormData();
  formData.append('file', file, fileName);
  const res = await fetch(buildPortalCrmUrl(`/crm/v2/${module}/${recordId}/photo`), {
    method: 'POST',
    headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'x-crmportal': ZOHO_HOSTS.portalName },
    body: formData,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { message?: string; code?: string };
    throw new ZohoApiError(res.status, json.message ?? 'Photo upload failed', json.code ?? '');
  }
}

export async function portalGetRecordPhoto(module: string, recordId: string): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;
  try {
    const res = await fetch(buildPortalCrmUrl(`/crm/v2/${module}/${recordId}/photo`), {
      headers: { 'Authorization': `Zoho-oauthtoken ${token}`, 'x-crmportal': ZOHO_HOSTS.portalName },
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
    ensureToken();
    // Try zohoapis.in v2 (admin tokens — no x-crmportal header)
    for (const ver of ['/crm/v2/', '/crm/v6/']) {
      try {
        const url = buildCrmUrl(`${ver}users?type=CurrentUser`);
        const res = await fetch(url, { headers: plainAuthHeader() });
        if (res.ok) {
          const json = await res.json() as { users?: ZohoCurrentUser[] };
          if (json.users?.[0]) return json.users[0];
        }
      } catch { /* next */ }
    }
    // Try portal domain (portal tokens are only valid on zcrmportals.in)
    try {
      const url = buildPortalCrmUrl('/crm/v6/users?type=CurrentUser');
      console.log('[CRM] fetchCurrentZohoUser portal domain:', url);
      const res = await fetch(url, { headers: authHeader() });
      console.log('[CRM] fetchCurrentZohoUser portal domain status:', res.status);
      if (res.ok) {
        const json = await res.json() as { users?: ZohoCurrentUser[] };
        if (json.users?.[0]) return json.users[0];
      }
    } catch { /* ok */ }
    return null;
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

  try {
    const url = buildAccountsUrl('/oauth/user/info');
    const res = await fetch(url, {
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

/**
 * Search for a CRM Contact by email (v6 API — works with portal tokens).
 */
export async function searchContactByEmailV6(email: string): Promise<{ name: string; contactId: string } | null> {
  const token = loadToken();
  if (!token || !email) return null;

  try {
    const url = buildCrmUrl(`/crm/v6/Contacts/search?email=${encodeURIComponent(email)}`);
    console.log('[CRM] searchContactByEmailV6 URL:', url);
    const res = await fetch(url, { headers: authHeader() });
    console.log('[CRM] searchContactByEmailV6 status:', res.status);
    if (!res.ok || res.status === 204) return null;

    const json = await res.json() as { data?: Array<Record<string, unknown>> };
    const contact = json.data?.[0];
    if (!contact) return null;

    const firstName = (contact.First_Name || '') as string;
    const lastName = (contact.Last_Name || '') as string;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    return fullName ? { name: fullName, contactId: String(contact.id || '') } : null;
  } catch (err) {
    console.warn('[CRM] searchContactByEmailV6 error:', err);
    return null;
  }
}

/**
 * Search for a CRM Contact by email and return their name + id.
 * Uses v2 API — works with admin tokens.
 */
export async function searchContactByEmail(email: string): Promise<{ name: string; contactId: string } | null> {
  const token = loadToken();
  if (!token || !email) return null;

  try {
    const url = buildCrmUrl(`/crm/v2/Contacts/search?email=${encodeURIComponent(email)}`);
    console.log('[CRM] searchContactByEmail URL:', url);
    const res = await fetch(url, { headers: authHeader() });
    console.log('[CRM] searchContactByEmail response status:', res.status);
    if (!res.ok || res.status === 204) return null;

    const json = await res.json() as { data?: Array<Record<string, unknown>> };
    console.log('[CRM] searchContactByEmail response data:', json);
    const contact = json.data?.[0];
    if (!contact) return null;

    const firstName = (contact.First_Name || '') as string;
    const lastName = (contact.Last_Name || '') as string;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    return fullName ? { name: fullName, contactId: String(contact.id || '') } : null;
  } catch (err) {
    console.error('[CRM] searchContactByEmail error:', err);
    return null;
  }
}

function extractContact(contact: Record<string, unknown>): { name: string; email: string; contactId: string } | null {
  const firstName = (contact.First_Name || '') as string;
  const lastName = (contact.Last_Name || '') as string;
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const contactEmail = (contact.Email || '') as string;
  if (!fullName && !contactEmail) return null;
  return {
    name: fullName,
    email: contactEmail.toLowerCase(),
    contactId: String(contact.id || ''),
  };
}

/**
 * Fetch the current user's Contact record from CRM.
 * Portal tokens (from zcrmportals.in) are NOT recognized by www.zohoapis.in,
 * so we must call through the portal domain itself for portal users.
 * Tries: portal domain API → zohoapis.in v6 → zohoapis.in v2.
 */
export async function fetchPortalUserContact(): Promise<{ name: string; email: string; contactId: string } | null> {
  const token = loadToken();
  if (!token) return null;

  const { loadPortalSession } = await import('./portalUsers');
  const session = loadPortalSession();
  const email = session?.email;

  // If we already have the email from session, try search
  if (email) {
    for (const searchFn of [searchContactByEmailV6, searchContactByEmail]) {
      try {
        const result = await searchFn(email);
        if (result) return { ...result, email };
      } catch { /* next */ }
    }
  }

  // Strategy 1: Portal domain API — the portal's own server recognizes its tokens
  const portalPaths = [
    '/crm/v6/Contacts?per_page=1',
    '/crm/v2/Contacts?per_page=1',
    '/crm/v6/users?type=CurrentUser',
  ];
  for (const path of portalPaths) {
    try {
      const url = buildPortalCrmUrl(path);
      console.log('[CRM] Portal domain try:', url);
      const res = await fetch(url, { headers: authHeader() });
      console.log('[CRM] Portal domain response:', res.status);
      if (res.ok && res.status !== 204) {
        const json = await res.json() as Record<string, unknown>;

        // Handle /users response format
        if (path.includes('/users')) {
          const users = (json as { users?: Array<Record<string, unknown>> }).users;
          const user = users?.[0];
          if (user) {
            const firstName = (user.first_name || '') as string;
            const lastName = (user.last_name || '') as string;
            const fullName = (user.full_name || [firstName, lastName].filter(Boolean).join(' ')) as string;
            const userEmail = (user.email || '') as string;
            if (fullName || userEmail) {
              console.log('[CRM] Got user from portal domain:', fullName, userEmail);
              return { name: fullName, email: userEmail.toLowerCase(), contactId: String(user.id || '') };
            }
          }
          continue;
        }

        // Handle /Contacts response format
        const contacts = (json as { data?: Array<Record<string, unknown>> }).data;
        const contact = contacts?.[0];
        if (contact) {
          const result = extractContact(contact);
          if (result) {
            console.log('[CRM] Got contact from portal domain:', result);
            return result;
          }
        }
      }
    } catch (err) { console.warn('[CRM] Portal domain failed for', path, err); }
  }

  // Strategy 2: zohoapis.in v6 (in case portal token works with v6)
  for (const ver of ['/crm/v6/', '/crm/v2/']) {
    try {
      const url = buildCrmUrl(`${ver}Contacts?per_page=1`);
      const res = await fetch(url, { headers: authHeader() });
      if (res.ok && res.status !== 204) {
        const json = await res.json() as { data?: Array<Record<string, unknown>> };
        const contact = json.data?.[0];
        if (contact) {
          const result = extractContact(contact);
          if (result) return result;
        }
      }
    } catch { /* next */ }
  }

  return null;
}

export async function fetchZohoOrgName(): Promise<string | null> {
  try {
    ensureToken();
    // Try v6 first (portal tokens), then v2
    for (const ver of ['/crm/v6/org', '/crm/v2/org']) {
      const url = buildCrmUrl(ver);
      const res = await fetch(url, { headers: authHeader() });
      if (res.ok) {
        const json = await res.json() as { org?: Array<{ company_name?: string }> };
        if (json.org?.[0]?.company_name) return json.org[0].company_name;
      }
    }
    return null;
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
  ensureToken();
  const url = buildCrmUrl('/crm/v2/settings/modules');
  const res = await fetch(url, { headers: authHeader() });
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

export async function portalSearch(module: string, criteria: string): Promise<ZohoRecord[]> {
  ensureToken();
  const apiPath = `/crm/v2/${module}/search?criteria=${encodeURIComponent(criteria)}`;
  const url = buildPortalCrmUrl(apiPath);
  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 204) return [];
  const json: ZohoListResponse = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json.message ?? `HTTP ${res.status}`, json.code ?? '');
  return json.data ?? [];
}

export async function portalUpdate(module: string, id: string, data: Record<string, unknown>): Promise<void> {
  ensureToken();
  const url = buildPortalCrmUrl(`/crm/v2/${module}/${id}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ data: [{ id, ...data }] }),
  });
  const json: ZohoCUDResponse = await res.json();
  if (json.code && json.code !== 'SUCCESS') throw new ZohoApiError(res.status, json.message ?? json.code, json.code);
  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') throw new ZohoApiError(res.status, result?.message ?? 'Update failed', result?.code ?? '');
}

export async function portalUpsert(
  module: string,
  data: Record<string, unknown>,
  duplicateCheckFields: string[],
): Promise<{ id: string; action: 'insert' | 'update' }> {
  ensureToken();
  const url = buildPortalCrmUrl(`/crm/v2/${module}/upsert`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ data: [data], duplicate_check_fields: duplicateCheckFields }),
  });
  const json: ZohoCUDResponse = await res.json();
  if (json.code && json.code !== 'SUCCESS') throw new ZohoApiError(res.status, json.message ?? json.code, json.code);
  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') throw new ZohoApiError(res.status, result?.message ?? 'Upsert failed', result?.code ?? '');
  return { id: result.details.id, action: (result as unknown as { action: string }).action === 'update' ? 'update' : 'insert' };
}

export async function zohoGetAttachments(
  module: string,
  recordId: string,
): Promise<Array<{ id: string; File_Name: string; Size: string }>> {
  const token = loadToken();
  if (!token) return [];
  const res = await fetch(buildCrmUrl(`/crm/v2/${module}/${recordId}/Attachments`), {
    headers: authHeader(),
  });
  if (res.status === 204) return [];
  if (!res.ok) return [];
  const json = await res.json() as { data?: Array<{ id: string; File_Name: string; Size: string }> };
  return json.data || [];
}

export async function zohoDownloadAttachment(
  module: string,
  recordId: string,
  attachmentId: string,
): Promise<Blob | null> {
  const token = loadToken();
  if (!token) return null;
  const res = await fetch(
    buildCrmUrl(`/crm/v2/${module}/${recordId}/Attachments/${attachmentId}`),
    { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } },
  );
  if (!res.ok) return null;
  return res.blob();
}

export async function zohoUploadAttachment(
  module: string,
  recordId: string,
  file: Blob,
  fileName: string,
): Promise<boolean> {
  const token = ensureToken();
  const formData = new FormData();
  formData.append('file', file, fileName);
  const res = await fetch(buildCrmUrl(`/crm/v2/${module}/${recordId}/Attachments`), {
    method: 'POST',
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    body: formData,
  });
  return res.ok;
}

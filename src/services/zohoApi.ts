// Base Zoho CRM v2 API client (browser implicit-flow).
// Authorization uses the "Zoho-oauthtoken" header format required by Zoho.

import { loadToken } from './oauth';

export const ZOHO_BASE = 'https://www.zohoapis.in/crm/v2';

export class ZohoApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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
}

interface ZohoCUDResponse {
  data: Array<{
    code: string;
    status: string;
    message: string;
    details: { id: string };
  }>;
}

function headers(): HeadersInit {
  const token = loadToken();
  if (!token) throw new ZohoApiError(401, 'Not connected to Zoho. Please sign in first.');
  return {
    'Authorization': `Zoho-oauthtoken ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function zohoList(module: string, params: Record<string, string> = {}): Promise<ZohoRecord[]> {
  const url = new URL(`${ZOHO_BASE}/${module}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { headers: headers() });
  if (res.status === 204) return [];

  const json = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json?.message ?? `HTTP ${res.status}`);

  return (json as ZohoListResponse).data ?? [];
}

export async function zohoGetById(module: string, id: string): Promise<ZohoRecord | null> {
  const res = await fetch(`${ZOHO_BASE}/${module}/${id}`, { headers: headers() });
  if (res.status === 404) return null;

  const json = await res.json();
  if (!res.ok) throw new ZohoApiError(res.status, json?.message ?? `HTTP ${res.status}`);

  return (json as ZohoListResponse).data?.[0] ?? null;
}

export async function zohoCreate(module: string, data: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${ZOHO_BASE}/${module}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ data: [data] }),
  });

  const json: ZohoCUDResponse = await res.json();
  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') throw new ZohoApiError(res.status, result?.message ?? 'Create failed');

  return result.details.id;
}

export async function zohoUpdate(module: string, id: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${ZOHO_BASE}/${module}/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ data: [{ id, ...data }] }),
  });

  const json: ZohoCUDResponse = await res.json();
  const result = json.data?.[0];
  if (!result || result.code !== 'SUCCESS') throw new ZohoApiError(res.status, result?.message ?? 'Update failed');
}

export async function zohoDelete(module: string, id: string): Promise<void> {
  const res = await fetch(`${ZOHO_BASE}/${module}/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new ZohoApiError(res.status, `Delete failed: ${res.status}`);
}

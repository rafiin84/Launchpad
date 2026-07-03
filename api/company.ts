import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/company — Server-side storage for founder company profiles.
 *
 * Stores company profile JSON in the Contact's Description field in Zoho CRM.
 * Each founder is already a Contact — we find them by email and read/write Description.
 *
 * GET  /api/company?email=founder@example.com    → { data: CompanyData }
 * GET  /api/company?all=true                     → { profiles: [{email, data}] }
 * POST /api/company   body: { email, data }      → { success: true }
 */

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_BASE = 'https://www.zohoapis.in';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAdminToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Zoho env vars (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN)');
  }

  const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!data.access_token) throw new Error(`Token refresh failed: ${data.error || JSON.stringify(data)}`);

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function crmFetch(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const token = await getAdminToken();
  const opts: RequestInit = {
    method,
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${ZOHO_API_BASE}${path}`, opts);
  if (res.status === 204) return { status: 204, data: null };
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

const PROFILE_MARKER = '<!--LP_COMPANY_PROFILE-->';

interface ContactRecord {
  id: string;
  Email?: string;
  Description?: string;
}

function extractProfileJson(description: string | undefined): Record<string, unknown> | null {
  if (!description) return null;
  const idx = description.indexOf(PROFILE_MARKER);
  if (idx === -1) return null;
  const jsonStr = description.substring(idx + PROFILE_MARKER.length);
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildDescription(companyData: unknown): string {
  return `${PROFILE_MARKER}${JSON.stringify(companyData)}`;
}

async function findContactByEmail(email: string): Promise<ContactRecord | null> {
  const result = await crmFetch(
    'GET',
    `/crm/v2/Contacts/search?email=${encodeURIComponent(email)}&fields=Email,Description`,
  );
  const contacts = (result.data as { data?: ContactRecord[] })?.data;
  return contacts?.[0] ?? null;
}

async function findAllContactsWithProfiles(): Promise<ContactRecord[]> {
  const allWithProfiles: ContactRecord[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    const result = await crmFetch(
      'GET',
      `/crm/v2/Contacts?fields=Email,Description&per_page=200&page=${page}&sort_by=Modified_Time&sort_order=desc`,
    );
    const body = result.data as { data?: ContactRecord[]; info?: { more_records?: boolean } };
    const contacts = body?.data ?? [];
    for (const c of contacts) {
      if (c.Description?.includes(PROFILE_MARKER)) allWithProfiles.push(c);
    }
    hasMore = body?.info?.more_records ?? false;
    page++;
  }

  return allWithProfiles;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { email, all } = req.query;

      if (all === 'true') {
        const contacts = await findAllContactsWithProfiles();
        const profiles: Array<{ email: string; data: unknown }> = [];
        for (const c of contacts) {
          if (!c.Email) continue;
          const parsed = extractProfileJson(c.Description);
          if (parsed) profiles.push({ email: c.Email, data: parsed });
        }
        console.log('[company] GET all → found', profiles.length, 'profiles');
        return res.status(200).json({ profiles });
      }

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email query param required (or use all=true)' });
      }

      console.log('[company] GET email:', email);
      const contact = await findContactByEmail(email);

      if (contact) {
        const parsed = extractProfileJson(contact.Description);
        if (parsed) {
          console.log('[company] Found profile for', email);
          return res.status(200).json({ data: parsed, contactId: contact.id });
        }
      }

      console.log('[company] No profile found for', email);
      return res.status(200).json({ data: null });
    }

    if (req.method === 'POST') {
      const { email, data: companyData } = req.body || {};

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email is required in request body' });
      }
      if (!companyData || typeof companyData !== 'object') {
        return res.status(400).json({ error: 'data object is required in request body' });
      }

      const contact = await findContactByEmail(email);
      if (!contact) {
        console.error('[company] No Contact found for', email);
        return res.status(404).json({ error: `No Contact record found for ${email}` });
      }

      const newDescription = buildDescription(companyData);
      console.log('[company] Updating Contact', contact.id, 'for', email);

      const result = await crmFetch('PUT', `/crm/v2/Contacts/${contact.id}`, {
        data: [{ id: contact.id, Description: newDescription }],
      });
      console.log('[company] Update status:', result.status);

      const resultData = result.data as { data?: Array<{ code?: string; message?: string; status?: string }> };
      const entry = resultData?.data?.[0];

      if (result.status >= 400 || entry?.status === 'error') {
        console.error('[company] Update failed:', JSON.stringify(result.data));
        return res.status(500).json({
          error: 'CRM update failed',
          detail: entry?.message || result.data,
        });
      }

      console.log('[company] Updated successfully:', entry?.code);
      return res.status(200).json({ success: true, contactId: contact.id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[company] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

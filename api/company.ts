import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/company — Server-side storage for founder company profiles.
 *
 * Stores company data as a CRM Note record with a unique title per founder.
 *
 * GET  /api/company?email=founder@example.com    → { data: CompanyData }
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

async function crmRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
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

const NOTE_PREFIX = 'LP_Company_Profile::';

function noteTitle(email: string): string {
  return `${NOTE_PREFIX}${email.toLowerCase()}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email query param is required' });
      }

      const title = noteTitle(email);
      const searchResult = await crmRequest('POST', '/crm/v2/coql', {
        select_query: `select Note_Title, Note_Content from Notes where Note_Title = '${title}' limit 1`,
      });

      const data = searchResult.data as { data?: Array<{ Note_Content?: string; id?: string }> } | null;
      const note = data?.data?.[0];

      if (note?.Note_Content) {
        try {
          const parsed = JSON.parse(note.Note_Content);
          return res.status(200).json({ data: parsed, noteId: note.id });
        } catch {
          return res.status(200).json({ data: null });
        }
      }

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

      const title = noteTitle(email);
      const jsonContent = JSON.stringify(companyData);

      const searchResult = await crmRequest('POST', '/crm/v2/coql', {
        select_query: `select id from Notes where Note_Title = '${title}' limit 1`,
      });

      const existing = (searchResult.data as { data?: Array<{ id: string }> })?.data?.[0];

      if (existing) {
        await crmRequest('PUT', `/crm/v2/Notes/${existing.id}`, {
          data: [{ id: existing.id, Note_Title: title, Note_Content: jsonContent }],
        });
      } else {
        await crmRequest('POST', '/crm/v2/Notes', {
          data: [{ Note_Title: title, Note_Content: jsonContent }],
        });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/company] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

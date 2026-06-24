import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/portal-identity — Resolve a portal user's real name from CRM.
 *
 * Portal users can't call CRM Users API. This endpoint uses the admin
 * token to look up their Contact record and return name + email.
 *
 * GET /api/portal-identity?email=user@example.com
 *   → { name, email, contactId }
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

async function crmGet(path: string): Promise<unknown> {
  const token = await getAdminToken();
  const res = await fetch(`${ZOHO_API_BASE}${path}`, {
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 204) return null;
  return res.json().catch(() => ({}));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email query param is required' });
  }

  try {
    const data = await crmGet(`/crm/v2/Contacts/search?email=${encodeURIComponent(email)}`);
    const contact = (data as { data?: Array<Record<string, unknown>> } | null)?.data?.[0];

    if (contact) {
      const firstName = contact.First_Name || '';
      const lastName = contact.Last_Name || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      return res.status(200).json({
        name: fullName || email.split('@')[0],
        email: contact.Email || email,
        contactId: contact.id || '',
      });
    }

    return res.status(200).json({
      name: email.split('@')[0],
      email,
      contactId: '',
    });
  } catch (err) {
    console.error('[/api/portal-identity] Error:', err);
    return res.status(500).json({
      error: 'Failed to resolve identity',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

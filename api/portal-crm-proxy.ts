import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/portal-crm-proxy — Server-side CRM proxy for portal (founder) users.
 *
 * Portal OAuth tokens from zcrmportals.in cannot be used with the standard
 * CRM REST API (zohoapis.in). This proxy uses the admin refresh token to
 * make CRM API calls on behalf of portal users.
 *
 * Usage:
 *   GET  /api/portal-crm-proxy?path=/crm/v2/My_Activities&per_page=200
 *   POST /api/portal-crm-proxy?path=/crm/v2/My_Documents
 *        body: { data: [...] }
 *
 * Security: Only allows access to modules that portal users should see.
 */

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_BASE = 'https://www.zohoapis.in';

// Modules that portal (founder) users are allowed to access
const ALLOWED_MODULES = new Set([
  'contacts',
  'my_activities',
  'my_documents',
  'applications',
  'portfolios',
]);

// Allowed non-module paths (settings lookups, etc.)
const ALLOWED_PATH_PREFIXES = [
  '/crm/v2/Contacts/search',
];

function isAllowedPath(path: string): boolean {
  // Extract module name from path like /crm/v2/ModuleName or /crm/v2/ModuleName/...
  const match = path.match(/^\/crm\/v\d+\/([A-Za-z_]+)/);
  if (!match) return false;
  const moduleName = match[1].toLowerCase();
  if (ALLOWED_MODULES.has(moduleName)) return true;
  // Check allowed path prefixes
  return ALLOWED_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path, ...restParams } = req.query;

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path query param is required' });
  }

  if (!isAllowedPath(path)) {
    return res.status(403).json({ error: `Module not allowed for portal users: ${path}` });
  }

  // Build the Zoho API URL
  let url = `${ZOHO_API_BASE}${path}`;

  // Forward remaining query params (excluding token — we use admin token)
  const extraParams = new URLSearchParams();
  for (const [key, value] of Object.entries(restParams)) {
    if (key !== 'token' && typeof value === 'string') {
      extraParams.set(key, value);
    }
  }
  const extraQs = extraParams.toString();
  if (extraQs) {
    url += (url.includes('?') ? '&' : '?') + extraQs;
  }

  try {
    const token = await getAdminToken();

    const headers: Record<string, string> = {
      'Authorization': `Zoho-oauthtoken ${token}`,
    };

    const fetchOptions: RequestInit = {
      method: req.method || 'GET',
      headers,
    };

    // Forward body for POST/PUT
    if (req.method === 'POST' || req.method === 'PUT') {
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    console.log(`[Portal CRM Proxy] ${req.method} ${url}`);
    const response = await fetch(url, fetchOptions);

    if (response.status === 204) {
      return res.status(204).end();
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.log(`[Portal CRM Proxy] Error ${response.status}:`, JSON.stringify(data));
    }
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[Portal CRM Proxy] Error:', err);
    return res.status(500).json({
      error: 'Portal CRM proxy request failed',
      details: String(err),
    });
  }
}

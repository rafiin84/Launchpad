import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless proxy for Zoho CRM API.
 *
 * Some Zoho CRM v2 endpoints block the Authorization header via CORS
 * preflight from non-Zoho origins. This proxy fetches server-side.
 *
 * Usage:  GET  /api/zoho-crm-proxy?path=/crm/v2/Contacts&token=TOKEN&per_page=200
 *         POST /api/zoho-crm-proxy?path=/crm/v2/Contacts/123/actions/portal_invite&token=TOKEN
 *              body: { ... }
 *
 * The `path` and `token` params are consumed by the proxy. All other
 * query params are forwarded to the Zoho API as-is.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path, token, api_domain, ...restParams } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token query param is required' });
  }
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path query param is required' });
  }

  // Build the Zoho API URL: base + path + any extra query params
  // The path may already contain query params (e.g. portal_invite?user_type_id=...)
  // Portal tokens may need a different API domain (returned by OAuth callback)
  const baseDomain = (typeof api_domain === 'string' && api_domain) ? api_domain.replace(/\/$/, '') : 'https://www.zohoapis.in';
  let url = `${baseDomain}${path}`;

  // Forward remaining query params
  const extraParams = new URLSearchParams();
  for (const [key, value] of Object.entries(restParams)) {
    if (typeof value === 'string') {
      extraParams.set(key, value);
    }
  }
  const extraQs = extraParams.toString();
  if (extraQs) {
    url += (url.includes('?') ? '&' : '?') + extraQs;
  }

  try {
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

    console.log(`[CRM Proxy] ${req.method} ${url} (base: ${baseDomain})`);
    const response = await fetch(url, fetchOptions);

    // Handle 204 No Content
    if (response.status === 204) {
      return res.status(204).end();
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.log(`[CRM Proxy] Error ${response.status}:`, JSON.stringify(data));
    }
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy request failed', details: String(err) });
  }
}

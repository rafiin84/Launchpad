import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless proxy for Zoho Accounts API.
 *
 * The accounts.zoho.in/oauth/user/info endpoint does NOT send CORS
 * headers, so browser-side calls from Vercel fail. This proxy fetches
 * server-side and returns the JSON.
 *
 * Usage:  GET /api/zoho-accounts-proxy?path=/oauth/user/info&token=ZOHO_TOKEN
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path, token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token query param is required' });
  }
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path query param is required' });
  }

  const url = `https://accounts.zoho.in${path}`;

  try {
    const response = await fetch(url, {
      method: req.method || 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy request failed', details: String(err) });
  }
}

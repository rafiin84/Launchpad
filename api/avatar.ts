import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless proxy for Zoho profile photos.
 *
 * Zoho's profile photo URLs require either session cookies (desktop only)
 * or OAuth tokens with CORS headers (unreliable on mobile Safari).
 * This proxy fetches the photo server-side — no CORS issues — and
 * returns the image bytes with aggressive caching.
 *
 * Usage:  GET /api/avatar?token=ZOHO_TOKEN&zuid=ZUID&userId=USER_ID
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, zuid, userId } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }

  const authHeader = { Authorization: `Zoho-oauthtoken ${token}` };

  // Try multiple Zoho photo endpoints in order
  const endpoints: string[] = [];
  if (zuid && typeof zuid === 'string') {
    endpoints.push(`https://contacts.zoho.in/api/v1/photos/${zuid}`);
  }
  if (userId && typeof userId === 'string') {
    endpoints.push(`https://www.zohoapis.in/crm/v2/users/${userId}/photo`);
  }
  if (zuid && typeof zuid === 'string') {
    endpoints.push(`https://profile.zoho.in/file?ID=${zuid}&fs=medium`);
  }

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { headers: authHeader });
      if (!response.ok) continue;

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      // Skip if response is JSON (error response) or HTML (login page)
      if (contentType.includes('json') || contentType.includes('html')) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength < 100) continue; // too small to be a real image

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(buffer);
    } catch {
      continue;
    }
  }

  return res.status(404).json({ error: 'Photo not found from any Zoho endpoint' });
}

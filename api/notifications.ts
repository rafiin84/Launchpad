import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/notifications — CRM-backed notification storage.
 *
 * Stores notifications as My_Activities records with Activity_Type = 'notification'.
 * Uses Activity_Tags to store the targetRole (who should see it).
 *
 * GET  /api/notifications?role=investor  → notifications for that role
 * POST /api/notifications               → create a notification
 * PUT  /api/notifications                → mark as read (body: { ids: string[] })
 */

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_BASE = 'https://www.zohoapis.in';

const MODULE = 'My_Activities';

let cachedAdminToken: string | null = null;
let adminTokenExpiresAt = 0;

async function getAdminToken(): Promise<string> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing CRM credentials');
  }

  if (cachedAdminToken && Date.now() < adminTokenExpiresAt - 60_000) {
    return cachedAdminToken;
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Failed to get admin token');

  cachedAdminToken = data.access_token;
  adminTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedAdminToken;
}

interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actor: string;
  actorRole: string;
  targetRole: string;
  link: string;
}

function fromCRM(r: Record<string, unknown>): NotificationRecord {
  const s = (k: string) => (r[k] == null ? '' : String(r[k]));
  const content = s('Content');
  let parsed: Record<string, string> = {};
  try { parsed = JSON.parse(content); } catch { /* ignore */ }

  return {
    id: s('id'),
    type: parsed.type || 'announcement',
    title: s('Name'),
    message: parsed.message || '',
    timestamp: s('Created_Time'),
    read: parsed.read === 'true',
    actor: s('Author_Name'),
    actorRole: s('Author_Role'),
    targetRole: s('Activity_Tags'),
    link: parsed.link || '',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getAdminToken();

    if (req.method === 'GET') {
      const targetRole = (req.query.role as string) || '';
      if (!targetRole) return res.status(400).json({ error: 'role query param required' });

      const searchUrl = `${ZOHO_API_BASE}/crm/v2/${MODULE}/search?criteria=(Activity_Type:equals:notification)and(Activity_Tags:equals:${targetRole})&per_page=100&sort_by=Created_Time&sort_order=desc`;
      const crmRes = await fetch(searchUrl, {
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
      });

      if (crmRes.status === 204) {
        return res.status(200).json({ notifications: [] });
      }
      if (!crmRes.ok) {
        const errText = await crmRes.text();
        throw new Error(`CRM search ${crmRes.status}: ${errText}`);
      }

      const json = await crmRes.json() as { data?: Array<Record<string, unknown>> };
      const notifications = (json.data || []).map(fromCRM);
      return res.status(200).json({ notifications });
    }

    if (req.method === 'POST') {
      const body = req.body as {
        type?: string; title?: string; message?: string;
        actor?: string; actorRole?: string; targetRole?: string; link?: string;
      };

      if (!body.title || !body.targetRole) {
        return res.status(400).json({ error: 'title and targetRole required' });
      }

      const payload: Record<string, unknown> = {
        Name: body.title,
        Activity_Type: 'notification',
        Content: JSON.stringify({
          type: body.type || 'announcement',
          message: body.message || '',
          link: body.link || '',
          read: 'false',
        }),
        Author_Name: body.actor || 'System',
        Author_Role: body.actorRole || '',
        Activity_Tags: body.targetRole,
      };

      const createRes = await fetch(`${ZOHO_API_BASE}/crm/v2/${MODULE}`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: [payload] }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`CRM POST ${createRes.status}: ${errText}`);
      }

      const createJson = await createRes.json() as {
        data?: Array<{ code: string; details: { id: string } }>;
      };
      const record = createJson.data?.[0];
      if (!record || record.code !== 'SUCCESS') {
        throw new Error(`CRM create failed: ${JSON.stringify(record)}`);
      }

      return res.status(200).json({
        notification: {
          id: record.details.id,
          type: body.type,
          title: body.title,
          message: body.message,
          actor: body.actor,
          actorRole: body.actorRole,
          targetRole: body.targetRole,
          link: body.link,
          read: false,
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (req.method === 'PUT') {
      const { ids } = req.body as { ids?: string[] };
      if (!ids?.length) return res.status(400).json({ error: 'ids array required' });

      const updates = ids.map(id => ({
        id,
        Content: JSON.stringify({ read: 'true' }),
      }));

      const updateRes = await fetch(`${ZOHO_API_BASE}/crm/v2/${MODULE}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: updates }),
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`CRM PUT ${updateRes.status}: ${errText}`);
      }

      return res.status(200).json({ updated: ids.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[notifications] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

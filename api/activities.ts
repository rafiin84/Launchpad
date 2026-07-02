import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/activities — Server-side shared activity feed.
 *
 * Strategy cascade:
 * 1. Admin token (env vars) → zohoapis.in — guaranteed for all users
 * 2. Client's portal token → zcrmportals.in (server-side, bypasses CORS)
 *
 * GET  /api/activities  → { activities: Activity[] }
 * POST /api/activities  → { activity: Activity }
 */

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_BASE = 'https://www.zohoapis.in';
const PORTAL_CRM_BASE = 'https://launchpad.zcrmportals.in';

const MODULE = 'My_Activities';

const FIELD_MAP: Record<string, string> = {
  title:        'Name',
  activityType: 'Activity_Type',
  content:      'Content',
  companyName:  'Company_Name',
  authorName:   'Author_Name',
  authorRole:   'Author_Role',
  tags:         'Activity_Tags',
  imageUrl:     'Image_URL',
  imageData:    'Activity_Image_Data',
};

const ALL_FIELDS = Object.values(FIELD_MAP).join(',');

interface Activity {
  id: string;
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  authorName: string;
  authorRole: string;
  tags: string;
  imageUrl: string;
  imageData: string;
}

function fromRecord(r: Record<string, unknown>): Activity {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:           str('id'),
    title:        str(FIELD_MAP.title),
    activityType: str(FIELD_MAP.activityType),
    content:      str(FIELD_MAP.content),
    companyName:  str(FIELD_MAP.companyName),
    authorName:   str(FIELD_MAP.authorName),
    authorRole:   str(FIELD_MAP.authorRole),
    tags:         str(FIELD_MAP.tags),
    imageUrl:     str(FIELD_MAP.imageUrl),
    imageData:    str(FIELD_MAP.imageData),
  };
}

// ─── Admin token (env vars) ─────────────────────────────────────────────────

let cachedAdminToken: string | null = null;
let adminTokenExpiresAt = 0;

async function getAdminToken(): Promise<string | null> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

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
  if (!data.access_token) return null;

  cachedAdminToken = data.access_token;
  adminTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedAdminToken;
}

// ─── CRM request helpers ────────────────────────────────────────────────────

async function crmFetch(base: string, token: string, path: string): Promise<Activity[]> {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`CRM GET ${res.status}: ${await res.text()}`);
  const json = await res.json() as { data?: Array<Record<string, unknown>> };
  return (json.data || []).map(fromRecord);
}

async function crmPost(base: string, token: string, payload: Record<string, unknown>): Promise<string> {
  const url = `${base}/crm/v2/${MODULE}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: [payload] }),
  });
  if (!res.ok) throw new Error(`CRM POST ${res.status}: ${await res.text()}`);
  const json = await res.json() as {
    data?: Array<{ code: string; status: string; details: { id: string } }>;
  };
  const record = json.data?.[0];
  if (!record || record.code !== 'SUCCESS') {
    throw new Error(`CRM create failed: ${JSON.stringify(record)}`);
  }
  return record.details.id;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientToken = (req.headers.authorization || '').replace(/^Zoho-oauthtoken\s+/i, '');
  const listPath = `/crm/v2/${MODULE}?per_page=200&sort_by=Modified_Time&sort_order=desc&fields=${ALL_FIELDS}`;

  try {
    if (req.method === 'GET') {
      const debug: string[] = [];
      debug.push(`clientToken: ${clientToken ? 'yes (' + clientToken.substring(0, 10) + '...)' : 'none'}`);

      // Strategy 1: Admin token
      const adminToken = await getAdminToken().catch((e) => { debug.push(`admin: no env vars (${(e as Error).message})`); return null; });
      if (adminToken) {
        try {
          const activities = await crmFetch(ZOHO_API_BASE, adminToken, listPath);
          debug.push(`admin: OK (${activities.length})`);
          return res.status(200).json({ activities, _strategy: 'admin', _debug: debug });
        } catch (e) {
          debug.push(`admin: failed (${(e as Error).message})`);
        }
      }

      // Strategy 2: Client's portal token → portal domain
      if (clientToken) {
        try {
          const activities = await crmFetch(PORTAL_CRM_BASE, clientToken, listPath);
          debug.push(`portal-proxy: OK (${activities.length})`);
          return res.status(200).json({ activities, _strategy: 'portal-proxy', _debug: debug });
        } catch (e) {
          debug.push(`portal-proxy: failed (${(e as Error).message})`);
        }
      }

      // Strategy 3: Client's token → standard CRM (for investors)
      if (clientToken) {
        try {
          const activities = await crmFetch(ZOHO_API_BASE, clientToken, listPath);
          debug.push(`client-crm: OK (${activities.length})`);
          return res.status(200).json({ activities, _strategy: 'client-crm', _debug: debug });
        } catch (e) {
          debug.push(`client-crm: failed (${(e as Error).message})`);
        }
      }

      return res.status(200).json({ activities: [], _strategy: 'none', _debug: debug });
    }

    if (req.method === 'POST') {
      const fields = req.body;
      if (!fields || typeof fields !== 'object' || !fields.title) {
        return res.status(400).json({ error: 'Activity fields required' });
      }

      const payload: Record<string, unknown> = {};
      for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
        const val = (fields as Record<string, string>)[formKey] ?? '';
        if (val !== '') payload[crmKey] = val;
      }

      // Strategy 1: Admin token
      const adminToken = await getAdminToken().catch(() => null);
      if (adminToken) {
        try {
          const id = await crmPost(ZOHO_API_BASE, adminToken, payload);
          console.log('[activities] POST via admin token, id:', id);
          return res.status(200).json({ activity: { id, ...fields } });
        } catch (e) {
          console.warn('[activities] Admin POST failed:', e);
        }
      }

      // Strategy 2: Client's portal token → portal domain
      if (clientToken) {
        try {
          const id = await crmPost(PORTAL_CRM_BASE, clientToken, payload);
          console.log('[activities] POST via portal proxy, id:', id);
          return res.status(200).json({ activity: { id, ...fields } });
        } catch (e) {
          console.warn('[activities] Portal proxy POST failed:', e);
        }
      }

      // Strategy 3: Client's token → standard CRM
      if (clientToken) {
        try {
          const id = await crmPost(ZOHO_API_BASE, clientToken, payload);
          console.log('[activities] POST via client token, id:', id);
          return res.status(200).json({ activity: { id, ...fields } });
        } catch (e) {
          console.warn('[activities] Client CRM POST failed:', e);
        }
      }

      return res.status(500).json({ error: 'All CRM strategies failed' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[activities] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

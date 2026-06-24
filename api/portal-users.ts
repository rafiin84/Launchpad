import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/portal-users — Fetch all portal users with their real status from Zoho CRM.
 *
 * Uses the admin token to query Zoho CRM portal settings and return
 * each portal user's email, name, and status (active / disabled / invited).
 *
 * GET /api/portal-users
 *   → { users: [{ email, name, status }] }
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

interface PortalUserResult {
  email: string;
  name: string;
  status: 'active' | 'disabled' | 'invited';
}

function deriveStatus(entry: Record<string, unknown>, userObj: Record<string, unknown>): 'active' | 'disabled' | 'invited' {
  // Check string status fields (case-insensitive)
  for (const obj of [entry, userObj]) {
    const raw = String(obj.status ?? obj.Status ?? obj.portal_status ?? '').toLowerCase().trim();
    if (raw === 'active') return 'active';
    if (raw === 'disabled' || raw === 'deactivated' || raw === 'inactive') return 'disabled';
    if (raw === 'yet_to_confirm' || raw === 'yet to confirm' || raw === 'invited' || raw === 'pending' || raw === 'reinvited') return 'invited';
  }

  // Check boolean fields
  const isActive = entry.active ?? userObj.active;
  const isConfirmed = entry.confirm ?? entry.confirmed ?? userObj.confirm ?? userObj.confirmed;

  if (isActive === false) return 'disabled';
  if (isActive === true && isConfirmed === false) return 'invited';
  if (isActive === true) return 'active';

  return 'invited';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Get portals
    const portalsData = await crmGet('/crm/v2/settings/portals') as { portals?: Array<{ name: string; active: boolean }> } | null;
    const portals = portalsData?.portals ?? [];
    const activePortal = portals.find(p => p.active) ?? portals[0];

    if (!activePortal) {
      return res.status(200).json({ users: [], debug: 'No portal found' });
    }

    console.log('[portal-users] Portal:', activePortal.name);

    // 2. Get user types
    const utData = await crmGet(`/crm/v2/settings/portals/${encodeURIComponent(activePortal.name)}/user_type`) as { user_type?: Array<{ id: string; name: string }> } | null;
    const userTypes = utData?.user_type ?? [];

    console.log('[portal-users] User types:', JSON.stringify(userTypes));

    // 3. Fetch users for each user type
    const allUsers: PortalUserResult[] = [];

    for (const ut of userTypes) {
      const rawData = await crmGet(`/crm/v2/settings/portals/${encodeURIComponent(activePortal.name)}/user_type/${ut.id}/users`);

      console.log('[portal-users] Raw response for', ut.id, ':', JSON.stringify(rawData).slice(0, 2000));

      const usersArray = (
        (rawData as Record<string, unknown>)?.users ??
        (rawData as Record<string, unknown>)?.portal_users ??
        (rawData as Record<string, unknown>)?.data ??
        []
      ) as Array<Record<string, unknown>>;

      for (const entry of usersArray) {
        const userObj = (entry.user ?? entry) as Record<string, unknown>;

        const email = String(userObj.email ?? userObj.Email ?? entry.email ?? entry.Email ?? '').trim().toLowerCase();
        if (!email) continue;

        const name = String(userObj.name ?? userObj.Name ?? entry.name ?? entry.Name ?? email.split('@')[0]);
        const status = deriveStatus(entry, userObj);

        console.log('[portal-users]', email, '→', status);
        allUsers.push({ email, name, status });
      }
    }

    return res.status(200).json({ users: allUsers });
  } catch (err) {
    console.error('[portal-users] Error:', err);
    return res.status(500).json({
      error: 'Failed to fetch portal users',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

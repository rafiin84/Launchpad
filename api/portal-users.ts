import type { VercelRequest, VercelResponse } from '@vercel/node';
import { crmRequest } from './_zohoAdmin';

/**
 * /api/portal-users — Fetch all portal users with their real status.
 *
 * Uses the admin token to query Zoho CRM portal settings and return
 * each portal user's email and status (active / disabled / yet_to_confirm).
 *
 * GET /api/portal-users
 *   → { users: [{ email, name, status }] }
 *
 * This is the authoritative source for portal user statuses — client-side
 * token scopes often can't access the portal settings API.
 */

interface PortalUserResult {
  email: string;
  name: string;
  status: 'active' | 'disabled' | 'invited'; // invited = yet to confirm
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Get portals
    const portalsResult = await crmRequest('GET', '/crm/v2/settings/portals');
    const portalsData = portalsResult.data as { portals?: Array<{ name: string; active: boolean }> } | null;
    const portals = portalsData?.portals ?? [];
    const activePortal = portals.find(p => p.active) ?? portals[0];

    if (!activePortal) {
      return res.status(200).json({ users: [], debug: 'No portal found' });
    }

    console.log('[portal-users] Portal:', activePortal.name);

    // 2. Get user types
    const utResult = await crmRequest(
      'GET',
      `/crm/v2/settings/portals/${encodeURIComponent(activePortal.name)}/user_type`,
    );
    const utData = utResult.data as { user_type?: Array<{ id: string; name: string }> } | null;
    const userTypes = utData?.user_type ?? [];

    console.log('[portal-users] User types:', userTypes.map(u => ({ id: u.id, name: u.name })));

    // 3. For each user type, fetch users
    const allUsers: PortalUserResult[] = [];

    for (const ut of userTypes) {
      const usersResult = await crmRequest(
        'GET',
        `/crm/v2/settings/portals/${encodeURIComponent(activePortal.name)}/user_type/${ut.id}/users`,
      );

      const rawData = usersResult.data as Record<string, unknown>;
      console.log('[portal-users] Raw response for user_type', ut.id, ':', JSON.stringify(rawData).slice(0, 1000));

      // Try multiple possible response keys
      const usersArray = (
        rawData?.users ?? rawData?.portal_users ?? rawData?.data ?? []
      ) as Array<Record<string, unknown>>;

      for (const entry of usersArray) {
        // User data may be nested or flat
        const userObj = (entry.user ?? entry) as Record<string, unknown>;

        // Extract email — try multiple field names
        const email = String(
          userObj.email ?? userObj.Email ?? entry.email ?? entry.Email ?? ''
        ).trim().toLowerCase();

        if (!email) continue;

        // Extract name
        const name = String(
          userObj.name ?? userObj.Name ?? userObj.full_name ??
          entry.name ?? entry.Name ?? email.split('@')[0]
        );

        // Derive status from all available fields
        const status = deriveStatus(entry, userObj);

        console.log('[portal-users] User:', email, 'status:', status, 'raw:', {
          'entry.status': entry.status,
          'entry.active': entry.active,
          'entry.confirm': entry.confirm,
          'userObj.status': userObj.status,
          'userObj.active': userObj.active,
        });

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

/** Derive canonical status from raw Zoho response fields */
function deriveStatus(
  entry: Record<string, unknown>,
  userObj: Record<string, unknown>,
): 'active' | 'disabled' | 'invited' {
  // Check all possible status string fields (case-insensitive)
  for (const obj of [entry, userObj]) {
    const raw = String(obj.status ?? obj.Status ?? obj.portal_status ?? '').toLowerCase().trim();

    if (raw === 'active') return 'active';
    if (raw === 'disabled' || raw === 'deactivated' || raw === 'inactive') return 'disabled';
    if (
      raw === 'yet_to_confirm' || raw === 'yet to confirm' ||
      raw === 'invited' || raw === 'pending' ||
      raw === 'reinvited' || raw === 're-invited' || raw === 'waiting'
    ) return 'invited';
  }

  // Check boolean fields — Zoho may use active + confirm booleans
  // instead of a status string
  const isActive = entry.active ?? userObj.active;
  const isConfirmed = entry.confirm ?? entry.confirmed ?? userObj.confirm ?? userObj.confirmed;

  if (isActive === false) return 'disabled';
  if (isActive === true && isConfirmed === false) return 'invited';
  if (isActive === true && isConfirmed === true) return 'active';
  if (isActive === true) return 'active'; // active but no confirm field

  // Completely unknown — default to invited (safest)
  return 'invited';
}

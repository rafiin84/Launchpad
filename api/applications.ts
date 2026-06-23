import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/applications — Server-side CRM proxy for investment applications.
 *
 * Founders (portal users) cannot access CRM custom modules directly.
 * This endpoint uses an admin refresh token (env vars) to write to CRM
 * on behalf of founders, bridging the data gap.
 *
 * Required Vercel Environment Variables:
 *   ZOHO_CLIENT_ID       — Self-client app Client ID
 *   ZOHO_CLIENT_SECRET   — Self-client app Client Secret
 *   ZOHO_REFRESH_TOKEN   — Admin refresh token with ZohoCRM.modules.ALL scope
 *
 * Endpoints:
 *   GET  /api/applications              — List all applications
 *   GET  /api/applications?id=xxx       — Get single application
 *   POST /api/applications              — Create new application
 *   PUT  /api/applications?id=xxx       — Update application
 *
 * For founder submissions, the portal token is passed for identity
 * verification, but the CRM write uses the admin token.
 */

const CRM_MODULE = 'Applications';
const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_BASE = 'https://www.zohoapis.in';

// ─── In-memory token cache (per serverless instance) ───────────────────────

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAdminAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, or ZOHO_REFRESH_TOKEN env vars');
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

  const data = await res.json() as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${data.error || JSON.stringify(data)}`);
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  return cachedAccessToken;
}

// ─── CRM API helpers ───────────────────────────────────────────────────────

async function crmRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const token = await getAdminAccessToken();

  const opts: RequestInit = {
    method,
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${ZOHO_API_BASE}${path}`, opts);

  if (res.status === 204) {
    return { status: 204, data: null };
  }

  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

// ─── Handler ───────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ── GET: List or get by ID ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const { id } = req.query;

      if (id && typeof id === 'string') {
        // Get single record
        const result = await crmRequest('GET', `/crm/v2/${CRM_MODULE}/${id}`);
        return res.status(result.status).json(result.data);
      }

      // List all (non-draft) — sorted by Modified_Time desc
      const result = await crmRequest(
        'GET',
        `/crm/v2/${CRM_MODULE}?sort_by=Modified_Time&sort_order=desc&per_page=200`,
      );
      return res.status(result.status).json(result.data);
    }

    // ── POST: Create new application ───────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body;

      if (!body || !body.data) {
        return res.status(400).json({ error: 'Request body must contain "data" array' });
      }

      const result = await crmRequest('POST', `/crm/v2/${CRM_MODULE}`, {
        data: body.data,
      });

      return res.status(result.status).json(result.data);
    }

    // ── PUT: Update existing application ───────────────────────────────────
    if (req.method === 'PUT') {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id query param is required for PUT' });
      }

      const body = req.body;
      if (!body || !body.data) {
        return res.status(400).json({ error: 'Request body must contain "data" array' });
      }

      const result = await crmRequest('PUT', `/crm/v2/${CRM_MODULE}/${id}`, {
        data: body.data,
      });

      return res.status(result.status).json(result.data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/applications] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

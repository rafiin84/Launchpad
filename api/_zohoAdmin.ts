/**
 * Shared Zoho admin token helper for serverless functions.
 *
 * Uses ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN env vars
 * to get/refresh an admin CRM access token.
 */

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_BASE = 'https://www.zohoapis.in';

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

export async function getAdminAccessToken(): Promise<string> {
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

export async function crmRequest(
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

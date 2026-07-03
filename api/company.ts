import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/company — Server-side storage for founder company profiles.
 *
 * Uses the custom "Founders" module in Zoho CRM.
 * Each founder has one record keyed by Email.
 *
 * GET  /api/company?email=founder@example.com    → { data: CompanyData }
 * GET  /api/company?all=true                     → { profiles: [{email, data}] }
 * POST /api/company   body: { email, data }      → { success: true }
 */

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_BASE = 'https://www.zohoapis.in';
const MODULE = 'Founders';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAdminToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Zoho env vars');
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

async function crmFetch(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const token = await getAdminToken();
  const opts: RequestInit = {
    method,
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${ZOHO_API_BASE}${path}`, opts);
  if (res.status === 204) return { status: 204, data: null };
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

// CRM field API names → client-side CompanyData keys
const FIELD_MAP: Record<string, string> = {
  Email: 'email',
  Company_Name: 'name',
  Tagline: 'tagline',
  Description: 'description',
  Website: 'website',
  Industry: 'industry',
  Stage: 'stage',
  Founded_Year: 'foundedYear',
  Location: 'location',
  Founder_Names: 'founderNames',
  Team_Size: 'teamSize',
  Open_Roles: 'openRoles',
  Product_Description: 'productDescription',
  MRR: 'mrr',
  ARR: 'arr',
  Active_Customers: 'activeCustomers',
  MoM_Growth: 'momGrowth',
  Churn_Rate: 'churnRate',
  NPS: 'nps',
  Key_Metric: 'keyMetric',
  Key_Metric_Label: 'keyMetricLabel',
  Total_Raised: 'totalRaised',
  Last_Round_Size: 'lastRoundSize',
  Last_Round_Stage: 'lastRoundStage',
  Last_Round_Date: 'lastRoundDate',
  Pre_Money_Valuation: 'preMoneyValuation',
  Monthly_Burn: 'monthlyBurn',
  Runway: 'runway',
  Revenue_Model: 'revenueModel',
  TAM: 'tam',
  SAM: 'sam',
  SOM: 'som',
  Target_Market: 'targetMarket',
  Key_Competitors: 'keyCompetitors',
  Differentiator: 'differentiator',
  Current_Ask: 'currentAsk',
  Use_of_Funds: 'useOfFunds',
  Key_Risks: 'keyRisks',
  Next_Milestones: 'nextMilestones',
};

// Reverse map: client key → CRM field
const REVERSE_MAP: Record<string, string> = {};
for (const [crm, client] of Object.entries(FIELD_MAP)) {
  REVERSE_MAP[client] = crm;
}

const CRM_FIELDS = Object.keys(FIELD_MAP).join(',');

function recordToProfile(record: Record<string, unknown>): Record<string, string> {
  const profile: Record<string, string> = {};
  for (const [crmKey, clientKey] of Object.entries(FIELD_MAP)) {
    profile[clientKey] = record[crmKey] != null ? String(record[crmKey]) : '';
  }
  return profile;
}

function profileToRecord(data: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [clientKey, value] of Object.entries(data)) {
    const crmKey = REVERSE_MAP[clientKey];
    if (crmKey && value !== undefined && value !== null) {
      record[crmKey] = String(value);
    }
  }
  return record;
}

async function findByEmail(email: string): Promise<{ id: string; record: Record<string, unknown> } | null> {
  const result = await crmFetch(
    'GET',
    `/crm/v2/${MODULE}/search?email=${encodeURIComponent(email)}&fields=${CRM_FIELDS}`,
  );
  const records = (result.data as { data?: Array<Record<string, unknown>> })?.data;
  if (records?.[0]) return { id: records[0].id as string, record: records[0] };
  return null;
}

async function findAll(): Promise<Array<{ id: string; record: Record<string, unknown> }>> {
  const result = await crmFetch(
    'GET',
    `/crm/v2/${MODULE}?fields=${CRM_FIELDS}&per_page=200&sort_by=Modified_Time&sort_order=desc`,
  );
  const records = (result.data as { data?: Array<Record<string, unknown>> })?.data ?? [];
  return records.map(r => ({ id: r.id as string, record: r }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { email, all } = req.query;

      if (all === 'true') {
        const records = await findAll();
        const profiles = records
          .map(r => {
            const profile = recordToProfile(r.record);
            return { email: profile.email || (r.record.Email as string) || '', data: profile };
          })
          .filter(p => p.email);
        console.log('[company] GET all →', profiles.length, 'profiles');
        return res.status(200).json({ profiles });
      }

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email query param required (or use all=true)' });
      }

      const found = await findByEmail(email);
      if (found) {
        const profile = recordToProfile(found.record);
        console.log('[company] Found profile for', email, '→', profile.name);
        return res.status(200).json({ data: profile, recordId: found.id });
      }

      console.log('[company] No profile for', email);
      return res.status(200).json({ data: null });
    }

    if (req.method === 'POST') {
      const { email, data: companyData } = req.body || {};

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email is required' });
      }
      if (!companyData || typeof companyData !== 'object') {
        return res.status(400).json({ error: 'data object is required' });
      }

      const crmRecord = profileToRecord(companyData as Record<string, unknown>);
      crmRecord.Email = email;
      crmRecord.Name = (companyData as Record<string, string>).name || email;

      const existing = await findByEmail(email);

      if (existing) {
        console.log('[company] Updating record', existing.id, 'for', email);
        const result = await crmFetch('PUT', `/crm/v2/${MODULE}/${existing.id}`, {
          data: [{ id: existing.id, ...crmRecord }],
        });
        const entry = (result.data as { data?: Array<{ code?: string; status?: string; message?: string }> })?.data?.[0];
        if (result.status >= 400 || entry?.status === 'error') {
          console.error('[company] Update failed:', JSON.stringify(result.data));
          return res.status(500).json({ error: 'CRM update failed', detail: entry?.message || result.data });
        }
        console.log('[company] Updated:', entry?.code);
      } else {
        console.log('[company] Creating record for', email);
        const result = await crmFetch('POST', `/crm/v2/${MODULE}`, {
          data: [crmRecord],
        });
        const entry = (result.data as { data?: Array<{ code?: string; status?: string; message?: string }> })?.data?.[0];
        if (result.status >= 400 || entry?.status === 'error') {
          console.error('[company] Create failed:', JSON.stringify(result.data));
          return res.status(500).json({ error: 'CRM create failed', detail: entry?.message || result.data });
        }
        console.log('[company] Created:', entry?.code);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[company] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

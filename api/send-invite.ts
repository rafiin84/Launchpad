import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/send-invite — Send a portal invitation to an applicant.
 *
 * Strategy cascade:
 * 1. Zoho CRM portal invite API (sends Zoho's own invitation email)
 * 2. Zoho CRM send_mail API (sends custom email via CRM)
 *
 * POST /api/send-invite
 *   Body: { contactId, email, name, portalUrl }
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

interface StepResult {
  step: string;
  success: boolean;
  detail: string;
}

async function tryPortalInvite(token: string, contactId: string): Promise<StepResult> {
  const step = 'portal_invite';

  // 1. Get portals
  const portalsRes = await fetch(`${ZOHO_API_BASE}/crm/v2/settings/portals`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });
  if (!portalsRes.ok) {
    return { step, success: false, detail: `Portals API returned ${portalsRes.status}` };
  }
  const portalsData = await portalsRes.json().catch(() => ({})) as {
    portals?: Array<{ name: string; active: boolean }>;
  };
  const portal = portalsData?.portals?.find(p => p.active) ?? portalsData?.portals?.[0];
  if (!portal) {
    return { step, success: false, detail: 'No portal configured in CRM' };
  }

  // 2. Get user types
  const utRes = await fetch(
    `${ZOHO_API_BASE}/crm/v2/settings/portals/${encodeURIComponent(portal.name)}/user_type`,
    { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } },
  );
  if (!utRes.ok) {
    return { step, success: false, detail: `User types API returned ${utRes.status}` };
  }
  const utData = await utRes.json().catch(() => ({})) as {
    user_type?: Array<{ id: string; name: string; active: boolean }>;
  };
  const userType = utData?.user_type?.find(ut => ut.active) ?? utData?.user_type?.[0];
  if (!userType) {
    return { step, success: false, detail: 'No user type configured for portal' };
  }

  console.log('[send-invite] Portal:', portal.name, 'UserType:', userType.id, userType.name);

  // 3. Try invite then reinvite
  for (const type of ['invite', 'reinvite'] as const) {
    const qs = new URLSearchParams({ user_type_id: userType.id, language: 'en_US', type });
    const res = await fetch(
      `${ZOHO_API_BASE}/crm/v2/Contacts/${contactId}/actions/portal_invite?${qs}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
      },
    );
    const text = await res.text();
    console.log(`[send-invite] Portal ${type}: ${res.status}`, text);

    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text); } catch { /* not JSON */ }

    const inviteArr = (json as { portal_invite?: Array<{ code?: string; message?: string; status?: string }> }).portal_invite;
    const code = inviteArr?.[0]?.code || '';
    const msg = inviteArr?.[0]?.message || '';

    // Success cases
    if (code === 'SUCCESS') {
      return { step, success: true, detail: `${type}: ${msg || 'Invitation sent'}` };
    }
    // Already invited = success
    if (code === 'DUPLICATE_DATA' || msg.toLowerCase().includes('already')) {
      return { step, success: true, detail: `User already invited (${type})` };
    }

    // If invite failed, try reinvite next
    if (type === 'reinvite') {
      return { step, success: false, detail: `${type}: ${code} - ${msg || text.slice(0, 200)}` };
    }
  }

  return { step, success: false, detail: 'All portal invite attempts failed' };
}

async function trySendMail(token: string, contactId: string, toEmail: string, name: string, portalUrl: string): Promise<StepResult> {
  const step = 'crm_send_mail';

  // Get from email
  const usersRes = await fetch(`${ZOHO_API_BASE}/crm/v2/users?type=CurrentUser`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });
  const usersData = await usersRes.json().catch(() => ({})) as {
    users?: Array<{ email: string; full_name?: string }>;
  };
  const fromUser = usersData?.users?.[0];
  if (!fromUser?.email) {
    return { step, success: false, detail: 'Could not determine sender email' };
  }

  const firstName = name.split(' ')[0] || 'there';
  const htmlContent = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 0">
  <div style="text-align:center;margin-bottom:32px">
    <h1 style="font-size:24px;font-weight:700;color:#111827;margin:0">Launchpad</h1>
    <p style="font-size:13px;color:#9CA3AF;margin:4px 0 0">Private Founder + Investor Network</p>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:32px">
    <h2 style="font-size:20px;font-weight:600;color:#111827;margin:0 0 12px">Hi ${firstName}, you're invited!</h2>
    <p style="font-size:14px;line-height:1.6;color:#4B5563;margin:0 0 24px">
      You've been invited to join <strong>Launchpad</strong> — a private platform connecting founders with investors.
      Sign in to submit your application, share documents, and track your investment progress.
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="${portalUrl}" style="display:inline-block;background:#111827;color:#fff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none">
        Sign in to Launchpad
      </a>
    </div>
  </div>
</div>`.trim();

  const mailPayload = {
    data: [{
      from: { user_name: fromUser.full_name || 'Launchpad', email: fromUser.email },
      to: [{ user_name: name, email: toEmail }],
      subject: "You're invited to Launchpad — Sign in to get started",
      content: htmlContent,
      mail_format: 'html',
    }],
  };

  const res = await fetch(
    `${ZOHO_API_BASE}/crm/v2/Contacts/${contactId}/actions/send_mail`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailPayload),
    },
  );

  const text = await res.text();
  console.log('[send-invite] CRM send_mail:', res.status, text);

  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }

  const dataArr = (json as { data?: Array<{ code?: string; message?: string; status?: string }> }).data;
  if (dataArr?.[0]?.code === 'SUCCESS' || dataArr?.[0]?.status === 'success') {
    return { step, success: true, detail: 'Email sent via CRM' };
  }

  const errMsg = dataArr?.[0]?.message || (json as { message?: string }).message || text.slice(0, 200);
  return { step, success: false, detail: errMsg };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const steps: StepResult[] = [];

  try {
    const { contactId, email, name, portalUrl } = req.body as {
      contactId: string;
      email: string;
      name: string;
      portalUrl: string;
    };

    if (!contactId || !email) {
      return res.status(400).json({ error: 'contactId and email are required' });
    }

    console.log('[send-invite] Start:', { contactId, email, name });

    const token = await getAdminToken();
    console.log('[send-invite] Admin token obtained');

    // Strategy 1: Portal invite (sends Zoho's own invitation email)
    const portalResult = await tryPortalInvite(token, contactId);
    steps.push(portalResult);
    console.log('[send-invite] Portal result:', JSON.stringify(portalResult));

    // Strategy 2: CRM send_mail (custom branded email)
    const mailResult = await trySendMail(token, contactId, email, name || email, portalUrl || `https://launchpad-iota-ten.vercel.app/login`);
    steps.push(mailResult);
    console.log('[send-invite] Mail result:', JSON.stringify(mailResult));

    const anySuccess = steps.some(s => s.success);

    if (anySuccess) {
      const successStep = steps.find(s => s.success)!;
      return res.status(200).json({
        success: true,
        message: successStep.detail,
        steps,
      });
    }

    // All failed
    return res.status(500).json({
      error: 'Failed to send invitation',
      message: steps.map(s => `${s.step}: ${s.detail}`).join(' | '),
      steps,
    });
  } catch (err) {
    console.error('[send-invite] Error:', err);
    return res.status(500).json({
      error: 'Failed to send invitation',
      message: err instanceof Error ? err.message : String(err),
      steps,
    });
  }
}

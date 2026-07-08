import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/send-invite — Send a portal invitation email directly to an applicant.
 *
 * POST /api/send-invite
 *   Body: { contactId, email, name, portalUrl }
 *   → Sends invitation email via Zoho CRM Send Mail API
 *
 * Also invites the user to the CRM portal so they can authenticate.
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

function buildInviteHtml(name: string, portalUrl: string): string {
  const firstName = name.split(' ')[0] || 'there';
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">🚀 Launchpad</h1>
    <p style="font-size: 13px; color: #9CA3AF; margin: 4px 0 0;">Private Founder + Investor Network</p>
  </div>

  <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px;">
    <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 12px;">
      Hi ${firstName}, you're invited!
    </h2>
    <p style="font-size: 14px; line-height: 1.6; color: #4B5563; margin: 0 0 24px;">
      You've been invited to join <strong>Launchpad</strong> — a private platform connecting founders with investors.
      Sign in to submit your application, share documents, and track your investment progress.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${portalUrl}"
         style="display: inline-block; background: #111827; color: #FFFFFF; font-size: 14px; font-weight: 600; padding: 12px 32px; border-radius: 12px; text-decoration: none;">
        Sign in to Launchpad →
      </a>
    </div>

    <p style="font-size: 13px; color: #9CA3AF; margin: 24px 0 0; text-align: center;">
      Use your email <strong>${name}</strong> to sign in via the Founder portal.
    </p>
  </div>

  <p style="font-size: 11px; color: #D1D5DB; text-align: center; margin-top: 24px;">
    This invitation was sent from Launchpad. If you did not expect this, you can safely ignore it.
  </p>
</div>`.trim();
}

async function getFromAddress(token: string): Promise<{ email: string; userName: string }> {
  // Try CRM email settings first
  const emailsRes = await fetch(`${ZOHO_API_BASE}/crm/v2/settings/emails`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });
  if (emailsRes.ok) {
    const data = await emailsRes.json().catch(() => ({})) as {
      emails?: Array<{ from: string; user_name?: string }>;
    };
    if (data.emails?.[0]) {
      return { email: data.emails[0].from, userName: data.emails[0].user_name || 'Launchpad' };
    }
  }

  // Fallback: get current user's email
  const usersRes = await fetch(`${ZOHO_API_BASE}/crm/v2/users?type=CurrentUser`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });
  if (usersRes.ok) {
    const data = await usersRes.json().catch(() => ({})) as {
      users?: Array<{ email: string; full_name?: string }>;
    };
    if (data.users?.[0]) {
      return { email: data.users[0].email, userName: data.users[0].full_name || 'Launchpad' };
    }
  }

  throw new Error('Could not determine sender email address');
}

async function sendCRMEmail(
  token: string,
  contactId: string,
  toEmail: string,
  name: string,
  portalUrl: string,
): Promise<void> {
  const from = await getFromAddress(token);
  console.log('[send-invite] From:', from.email, 'To:', toEmail);

  const htmlContent = buildInviteHtml(name, portalUrl);

  // Zoho CRM Send Mail API v2
  const mailPayload = {
    data: [{
      from: { user_name: from.userName, email: from.email },
      to: [{ user_name: name, email: toEmail }],
      subject: "You're invited to Launchpad — Sign in to get started",
      content: htmlContent,
      mail_format: 'html',
    }],
  };

  console.log('[send-invite] Sending via CRM send_mail...');
  const mailRes = await fetch(
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

  const mailText = await mailRes.text();
  console.log('[send-invite] CRM send_mail response:', mailRes.status, mailText);

  let mailJson: Record<string, unknown> = {};
  try { mailJson = JSON.parse(mailText); } catch { /* not JSON */ }

  // Check for success
  const dataArr = (mailJson as { data?: Array<{ code?: string; message?: string; status?: string }> }).data;
  if (dataArr?.[0]?.code === 'SUCCESS' || dataArr?.[0]?.status === 'success') {
    console.log('[send-invite] Email sent successfully via CRM');
    return;
  }

  // If CRM send_mail fails, try Zoho Mail API as fallback
  console.warn('[send-invite] CRM send_mail failed, trying Zoho Mail API...');

  const zohoMailRes = await fetch('https://mail.zoho.in/api/accounts', {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });
  const zohoMailData = await zohoMailRes.json().catch(() => ({})) as {
    data?: Array<{ accountId: string; primaryEmailAddress: string }>;
  };

  const mailAccount = zohoMailData.data?.[0];
  if (mailAccount) {
    console.log('[send-invite] Using Zoho Mail account:', mailAccount.primaryEmailAddress);
    const sendRes = await fetch(
      `https://mail.zoho.in/api/accounts/${mailAccount.accountId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAddress: mailAccount.primaryEmailAddress,
          toAddress: toEmail,
          subject: "You're invited to Launchpad — Sign in to get started",
          content: htmlContent,
        }),
      },
    );
    const sendData = await sendRes.text();
    console.log('[send-invite] Zoho Mail response:', sendRes.status, sendData);

    if (sendRes.ok) {
      console.log('[send-invite] Email sent via Zoho Mail');
      return;
    }
  }

  // If both fail, report the CRM error
  const errMsg = dataArr?.[0]?.message
    || (mailJson as { message?: string }).message
    || `CRM send_mail returned ${mailRes.status}`;
  throw new Error(`Failed to send email: ${errMsg}`);
}

async function sendPortalInvite(token: string, contactId: string): Promise<void> {
  // 1. Get portal config
  const portalsRes = await fetch(`${ZOHO_API_BASE}/crm/v2/settings/portals`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });
  const portalsData = await portalsRes.json().catch(() => ({})) as {
    portals?: Array<{ name: string; active: boolean }>;
  };
  const portal = portalsData?.portals?.find(p => p.active) ?? portalsData?.portals?.[0];
  if (!portal) {
    console.warn('[send-invite] No portal found, skipping portal invite');
    return;
  }

  // 2. Get user types
  const utRes = await fetch(
    `${ZOHO_API_BASE}/crm/v2/settings/portals/${encodeURIComponent(portal.name)}/user_type`,
    { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } },
  );
  const utData = await utRes.json().catch(() => ({})) as {
    user_type?: Array<{ id: string; name: string; active: boolean }>;
  };
  const userType = utData?.user_type?.find(ut => ut.active) ?? utData?.user_type?.[0];
  if (!userType) {
    console.warn('[send-invite] No user type found, skipping portal invite');
    return;
  }

  // 3. Send portal invite (try invite, then reinvite)
  for (const type of ['invite', 'reinvite'] as const) {
    const qs = new URLSearchParams({ user_type_id: userType.id, language: 'en_US', type });
    const res = await fetch(
      `${ZOHO_API_BASE}/crm/v2/Contacts/${contactId}/actions/portal_invite?${qs}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
      },
    );
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log(`[send-invite] Portal ${type}:`, JSON.stringify(json));

    if (res.ok) return;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

    const token = await getAdminToken();

    // 1. Send the invitation email directly
    await sendCRMEmail(token, contactId, email, name || email, portalUrl || 'https://launchpad-gilt.vercel.app');

    // 2. Also add them as a portal user (so they can authenticate)
    await sendPortalInvite(token, contactId).catch(err => {
      console.warn('[send-invite] Portal invite failed (non-critical):', err);
    });

    return res.status(200).json({
      success: true,
      message: `Invitation email sent to ${email}`,
    });
  } catch (err) {
    console.error('[send-invite] Error:', err);
    return res.status(500).json({
      error: 'Failed to send invitation',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

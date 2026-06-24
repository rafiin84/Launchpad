import type { VercelRequest, VercelResponse } from '@vercel/node';
import { crmRequest } from './_zohoAdmin';

/**
 * /api/portal-identity — Resolve a portal user's real name from CRM.
 *
 * Portal users can't call CRM Users API. This endpoint uses the admin
 * token to look up their Contact record and return name + email.
 *
 * GET /api/portal-identity?email=user@example.com
 *   → { name, email, contactId }
 *
 * Also searches by portal token's ZUID if email lookup fails.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email query param is required' });
  }

  try {
    // Search Contacts by email
    const searchResult = await crmRequest(
      'GET',
      `/crm/v2/Contacts/search?email=${encodeURIComponent(email)}`,
    );

    const data = searchResult.data as { data?: Array<Record<string, unknown>> } | null;
    const contact = data?.data?.[0];

    if (contact) {
      const firstName = contact.First_Name || '';
      const lastName = contact.Last_Name || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      return res.status(200).json({
        name: fullName || email.split('@')[0],
        email: contact.Email || email,
        contactId: contact.id || '',
      });
    }

    // No contact found — return email-based name
    return res.status(200).json({
      name: email.split('@')[0],
      email,
      contactId: '',
    });
  } catch (err) {
    console.error('[/api/portal-identity] Error:', err);
    return res.status(500).json({
      error: 'Failed to resolve identity',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

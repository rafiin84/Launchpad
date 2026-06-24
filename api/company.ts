import type { VercelRequest, VercelResponse } from '@vercel/node';
import { crmRequest } from './_zohoAdmin';

/**
 * /api/company — Server-side storage for founder company profiles.
 *
 * Stores company data as a CRM Note record with a unique title per founder.
 * This avoids creating dozens of custom fields — the full JSON is the note body.
 *
 * GET  /api/company?email=founder@example.com    → { data: CompanyData }
 * POST /api/company   body: { email, data }      → { success: true }
 */

const NOTE_PREFIX = 'LP_Company_Profile::';

function noteTitle(email: string): string {
  return `${NOTE_PREFIX}${email.toLowerCase()}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: Retrieve company profile ──────────────────────────────────────
    if (req.method === 'GET') {
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email query param is required' });
      }

      const title = noteTitle(email);
      // Search for note by title using COQL
      const searchResult = await crmRequest(
        'POST',
        '/crm/v2/coql',
        {
          select_query: `select Note_Title, Note_Content from Notes where Note_Title = '${title}' limit 1`,
        },
      );

      const data = searchResult.data as { data?: Array<{ Note_Content?: string; id?: string }> } | null;
      const note = data?.data?.[0];

      if (note?.Note_Content) {
        try {
          const parsed = JSON.parse(note.Note_Content);
          return res.status(200).json({ data: parsed, noteId: note.id });
        } catch {
          return res.status(200).json({ data: null });
        }
      }

      return res.status(200).json({ data: null });
    }

    // ── POST: Save/update company profile ──────────────────────────────────
    if (req.method === 'POST') {
      const { email, data: companyData } = req.body || {};

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email is required in request body' });
      }
      if (!companyData || typeof companyData !== 'object') {
        return res.status(400).json({ error: 'data object is required in request body' });
      }

      const title = noteTitle(email);
      const jsonContent = JSON.stringify(companyData);

      // Check if note already exists
      const searchResult = await crmRequest(
        'POST',
        '/crm/v2/coql',
        {
          select_query: `select id from Notes where Note_Title = '${title}' limit 1`,
        },
      );

      const existing = (searchResult.data as { data?: Array<{ id: string }> })?.data?.[0];

      if (existing) {
        // Update existing note
        await crmRequest('PUT', `/crm/v2/Notes/${existing.id}`, {
          data: [{
            id: existing.id,
            Note_Title: title,
            Note_Content: jsonContent,
          }],
        });
      } else {
        // Create new note
        await crmRequest('POST', '/crm/v2/Notes', {
          data: [{
            Note_Title: title,
            Note_Content: jsonContent,
          }],
        });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/company] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

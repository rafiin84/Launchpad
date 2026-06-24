import type { VercelRequest, VercelResponse } from '@vercel/node';
import { crmRequest } from './_zohoAdmin';

/**
 * /api/applications — Server-side CRM proxy for investment applications.
 */

const CRM_MODULE = 'Applications';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { id } = req.query;

      if (id && typeof id === 'string') {
        const result = await crmRequest('GET', `/crm/v2/${CRM_MODULE}/${id}`);
        return res.status(result.status).json(result.data);
      }

      const result = await crmRequest(
        'GET',
        `/crm/v2/${CRM_MODULE}?sort_by=Modified_Time&sort_order=desc&per_page=200`,
      );
      return res.status(result.status).json(result.data);
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || !body.data) {
        return res.status(400).json({ error: 'Request body must contain "data" array' });
      }
      const result = await crmRequest('POST', `/crm/v2/${CRM_MODULE}`, { data: body.data });
      return res.status(result.status).json(result.data);
    }

    if (req.method === 'PUT') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id query param is required for PUT' });
      }
      const body = req.body;
      if (!body || !body.data) {
        return res.status(400).json({ error: 'Request body must contain "data" array' });
      }
      const result = await crmRequest('PUT', `/crm/v2/${CRM_MODULE}/${id}`, { data: body.data });
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

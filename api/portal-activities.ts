import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/portal-activities — Server-side proxy for portal-domain CRM.
 *
 * Portal tokens only work on zcrmportals.in, which blocks browser requests
 * via CORS. This proxy forwards the request server-side, bypassing CORS.
 *
 * The client passes its portal token in the Authorization header.
 *
 * GET  /api/portal-activities  → fetches My_Activities from portal domain
 * POST /api/portal-activities  → creates activity on portal domain
 */

const PORTAL_CRM_BASE = 'https://launchpad.zcrmportals.in';
const MODULE = 'My_Activities';

const FIELD_MAP: Record<string, string> = {
  title:        'Name',
  activityType: 'Activity_Type',
  content:      'Content',
  companyName:  'Company_Name',
  authorName:   'Author_Name',
  tags:         'Activity_Tags',
  imageUrl:     'Image_URL',
  imageData:    'Activity_Image_Data',
};

const ALL_FIELDS = Object.values(FIELD_MAP).join(',');

function fromRecord(r: Record<string, unknown>): Record<string, string> {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:           str('id'),
    title:        str(FIELD_MAP.title),
    activityType: str(FIELD_MAP.activityType),
    content:      str(FIELD_MAP.content),
    companyName:  str(FIELD_MAP.companyName),
    authorName:   str(FIELD_MAP.authorName),
    tags:         str(FIELD_MAP.tags),
    imageUrl:     str(FIELD_MAP.imageUrl),
    imageData:    str(FIELD_MAP.imageData),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  try {
    if (req.method === 'GET') {
      const url = `${PORTAL_CRM_BASE}/crm/v2/${MODULE}?per_page=200&sort_by=Modified_Time&sort_order=desc&fields=${ALL_FIELDS}`;

      const crmRes = await fetch(url, {
        headers: { 'Authorization': authHeader },
      });

      if (crmRes.status === 204) {
        return res.status(200).json({ activities: [] });
      }

      if (!crmRes.ok) {
        const text = await crmRes.text();
        console.error('[portal-activities] GET failed:', crmRes.status, text);
        return res.status(crmRes.status).json({ error: `Portal CRM ${crmRes.status}`, detail: text });
      }

      const json = await crmRes.json() as { data?: Array<Record<string, unknown>> };
      const activities = (json.data || []).map(fromRecord);

      return res.status(200).json({ activities });
    }

    if (req.method === 'POST') {
      const fields = req.body;
      if (!fields || typeof fields !== 'object' || !fields.title) {
        return res.status(400).json({ error: 'Activity fields required (title, content, etc.)' });
      }

      const payload: Record<string, unknown> = {};
      for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
        const val = (fields as Record<string, string>)[formKey] ?? '';
        if (val !== '') payload[crmKey] = val;
      }

      const url = `${PORTAL_CRM_BASE}/crm/v2/${MODULE}`;
      const crmRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: [payload] }),
      });

      if (!crmRes.ok) {
        const text = await crmRes.text();
        console.error('[portal-activities] POST failed:', crmRes.status, text);
        return res.status(crmRes.status).json({ error: `Portal CRM ${crmRes.status}`, detail: text });
      }

      const json = await crmRes.json() as {
        data?: Array<{ code: string; status: string; details: { id: string } }>;
      };
      const record = json.data?.[0];

      if (!record || record.code !== 'SUCCESS') {
        return res.status(500).json({ error: 'Failed to create activity', detail: record });
      }

      const activity = { id: record.details.id, ...fields };
      return res.status(200).json({ activity });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[portal-activities] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

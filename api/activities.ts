import type { VercelRequest, VercelResponse } from '@vercel/node';
import { crmRequest } from './_zohoAdmin';

/**
 * /api/activities — Server-side shared activity feed.
 *
 * Uses an admin CRM token so both Founders (portal users) and Investors
 * can read/write the My_Activities module without needing direct CRM access.
 *
 * GET  /api/activities                 → { activities: CRMActivity[] }
 * POST /api/activities   body: fields  → { activity: CRMActivity }
 */

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

interface Activity {
  id: string;
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  authorName: string;
  tags: string;
  imageUrl: string;
  imageData: string;
}

function fromRecord(r: Record<string, unknown>): Activity {
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const result = await crmRequest(
        'GET',
        `/crm/v2/${MODULE}?per_page=200&sort_by=Modified_Time&sort_order=desc&fields=${ALL_FIELDS}`,
      );

      const data = result.data as { data?: Array<Record<string, unknown>> } | null;
      const activities = (data?.data || []).map(fromRecord);

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

      const result = await crmRequest('POST', `/crm/v2/${MODULE}`, {
        data: [payload],
      });

      const responseData = result.data as {
        data?: Array<{ code: string; status: string; details: { id: string } }>;
      };
      const record = responseData?.data?.[0];

      if (!record || record.code !== 'SUCCESS') {
        return res.status(500).json({
          error: 'Failed to create activity in CRM',
          detail: record,
        });
      }

      const activity: Activity = { id: record.details.id, ...fields };
      return res.status(200).json({ activity });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/activities] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAccessToken } from './_zohoAdmin';

const ZOHO_API_BASE = 'https://www.zohoapis.in';
const CRM_MODULE = 'Applications';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getAdminAccessToken();
    const { id: recordId, attachmentId } = req.query;

    if (!recordId || typeof recordId !== 'string') {
      return res.status(400).json({ error: 'id query param (record ID) is required' });
    }

    if (req.method === 'POST') {
      const { fileName, fileData, mimeType } = req.body as {
        fileName?: string;
        fileData?: string;
        mimeType?: string;
      };

      if (!fileName || !fileData) {
        return res.status(400).json({ error: 'fileName and fileData (base64) are required' });
      }

      const buffer = Buffer.from(fileData, 'base64');
      const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });

      const formData = new FormData();
      formData.append('file', blob, fileName);

      const response = await fetch(
        `${ZOHO_API_BASE}/crm/v2/${CRM_MODULE}/${recordId}/Attachments`,
        {
          method: 'POST',
          headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
          body: formData,
        }
      );

      const json = await response.json().catch(() => ({}));
      return res.status(response.status).json(json);
    }

    if (req.method === 'GET') {
      if (attachmentId && typeof attachmentId === 'string') {
        const response = await fetch(
          `${ZOHO_API_BASE}/crm/v2/${CRM_MODULE}/${recordId}/Attachments/${attachmentId}`,
          { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } }
        );

        if (!response.ok) {
          return res.status(response.status).json({ error: 'Failed to download attachment' });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentDisposition = response.headers.get('content-disposition') || '';

        res.setHeader('Content-Type', contentType);
        if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);

        const arrayBuffer = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }

      const response = await fetch(
        `${ZOHO_API_BASE}/crm/v2/${CRM_MODULE}/${recordId}/Attachments`,
        { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } }
      );

      if (response.status === 204) return res.status(200).json({ data: [] });
      const json = await response.json().catch(() => ({}));
      return res.status(response.status).json(json);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/attachments] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_BASE = 'https://www.zohoapis.in';
const CRM_MODULE = 'Applications';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAdminToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

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

  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };

  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${data.error || JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

function uploadToCRM(
  token: string,
  recordId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const boundary = '----ZohoBoundary' + Date.now();
    const crlf = '\r\n';

    const preamble = Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"${crlf}` +
      `Content-Type: ${mimeType}${crlf}${crlf}`
    );
    const epilogue = Buffer.from(`${crlf}--${boundary}--${crlf}`);
    const payload = Buffer.concat([preamble, buffer, epilogue]);

    const url = new URL(`${ZOHO_API_BASE}/crm/v2/${CRM_MODULE}/${recordId}/Attachments`);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let body: any;
        try { body = JSON.parse(raw); } catch { body = { raw }; }
        resolve({ status: res.statusCode || 500, body });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getAdminToken();
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
      const result = await uploadToCRM(token, recordId, fileName, buffer, mimeType || 'application/octet-stream');
      return res.status(result.status).json(result.body);
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

        const ct = response.headers.get('content-type') || 'application/octet-stream';
        const cd = response.headers.get('content-disposition') || '';

        res.setHeader('Content-Type', ct);
        if (cd) res.setHeader('Content-Disposition', cd);

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

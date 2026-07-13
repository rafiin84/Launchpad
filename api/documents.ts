import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';
import { getAdminAccessToken } from './_zohoAdmin.js';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const ZOHO_API_BASE = 'https://www.zohoapis.in';
const MODULE = 'My_Documents';

const FIELD_MAP: Record<string, string> = {
  documentName:  'Name',
  documentType:  'Document_Type',
  relatedCompany:'Related_Company',
  description:   'Document_Description',
  visibility:    'Visibility',
  fileName:      'File_Name',
  fileSize:      'File_Size',
  authorName:    'Author_Name',
  authorRole:    'Author_Role',
};

const ALL_FIELDS = Object.values(FIELD_MAP).join(',') + ',Created_Time';

interface Document {
  id: string;
  documentName: string;
  documentType: string;
  relatedCompany: string;
  description: string;
  visibility: string;
  fileName: string;
  fileSize: string;
  authorName: string;
  authorRole: string;
  createdTime: string;
}

function fromRecord(r: Record<string, unknown>): Document {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:             str('id'),
    documentName:   str(FIELD_MAP.documentName),
    documentType:   str(FIELD_MAP.documentType),
    relatedCompany: str(FIELD_MAP.relatedCompany),
    description:    str(FIELD_MAP.description),
    visibility:     str(FIELD_MAP.visibility),
    fileName:       str(FIELD_MAP.fileName),
    fileSize:       str(FIELD_MAP.fileSize),
    authorName:     str(FIELD_MAP.authorName),
    authorRole:     str(FIELD_MAP.authorRole),
    createdTime:    str('Created_Time'),
  };
}

function uploadAttachment(
  token: string,
  recordId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const boundary = '----ZohoBoundary' + Date.now();
    const crlf = '\r\n';
    const preamble = Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${fileName}"${crlf}Content-Type: ${mimeType}${crlf}${crlf}`
    );
    const epilogue = Buffer.from(`${crlf}--${boundary}--${crlf}`);
    const payload = Buffer.concat([preamble, buffer, epilogue]);

    const url = new URL(`${ZOHO_API_BASE}/crm/v2/${MODULE}/${recordId}/Attachments`);
    const opts: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
      },
    };

    const req = https.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        let body: unknown;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getAdminAccessToken();

    // GET — list documents or download attachment
    if (req.method === 'GET') {
      const { id, attachmentId } = req.query;

      // Download a specific attachment
      if (id && attachmentId && typeof id === 'string' && typeof attachmentId === 'string') {
        const dlRes = await fetch(
          `${ZOHO_API_BASE}/crm/v2/${MODULE}/${id}/Attachments/${attachmentId}`,
          { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } },
        );
        if (!dlRes.ok) return res.status(dlRes.status).json({ error: 'Download failed' });

        const ct = dlRes.headers.get('content-type') || 'application/octet-stream';
        const cd = dlRes.headers.get('content-disposition') || '';
        res.setHeader('Content-Type', ct);
        if (cd) res.setHeader('Content-Disposition', cd);
        return res.send(Buffer.from(await dlRes.arrayBuffer()));
      }

      // List attachments for a record
      if (id && typeof id === 'string') {
        const attRes = await fetch(
          `${ZOHO_API_BASE}/crm/v2/${MODULE}/${id}/Attachments`,
          { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } },
        );
        if (attRes.status === 204) return res.status(200).json({ data: [] });
        const json = await attRes.json().catch(() => ({}));
        return res.status(attRes.status).json(json);
      }

      // List all documents
      const listPath = `/crm/v2/${MODULE}?per_page=200&sort_by=Created_Time&sort_order=desc&fields=${ALL_FIELDS}`;
      const listRes = await fetch(`${ZOHO_API_BASE}${listPath}`, {
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
      });
      if (listRes.status === 204) return res.status(200).json({ documents: [] });
      if (!listRes.ok) {
        const errorText = await listRes.text();
        console.error(`[/api/documents] CRM GET failed (${listRes.status}):`, errorText);
        if (listRes.status === 400 || listRes.status === 404) {
          return res.status(200).json({ documents: [], warning: 'My_Documents module may not exist in CRM' });
        }
        throw new Error(`CRM GET ${listRes.status}: ${errorText}`);
      }
      const listJson = await listRes.json() as { data?: Array<Record<string, unknown>> };
      const documents = (listJson.data || []).map(fromRecord);
      return res.status(200).json({ documents });
    }

    // POST — create document record + optionally attach file
    if (req.method === 'POST') {
      const body = req.body as Record<string, string>;
      if (!body || !body.documentName) {
        return res.status(400).json({ error: 'documentName is required' });
      }

      const payload: Record<string, unknown> = {};
      for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
        const val = body[formKey] ?? '';
        if (val !== '') payload[crmKey] = val;
      }

      // Create CRM record
      const createRes = await fetch(`${ZOHO_API_BASE}/crm/v2/${MODULE}`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: [payload] }),
      });
      if (!createRes.ok) throw new Error(`CRM POST ${createRes.status}: ${await createRes.text()}`);
      const createJson = await createRes.json() as {
        data?: Array<{ code: string; details: { id: string } }>;
      };
      const record = createJson.data?.[0];
      if (!record || record.code !== 'SUCCESS') {
        throw new Error(`CRM create failed: ${JSON.stringify(record)}`);
      }
      const recordId = record.details.id;

      // Attach file if provided
      let attachmentResult: unknown = null;
      if (body.fileData && body.fileName) {
        const base64 = body.fileData.includes(',')
          ? body.fileData.split(',')[1]
          : body.fileData;
        const buffer = Buffer.from(base64, 'base64');
        const mimeType = body.mimeType || 'application/octet-stream';
        const att = await uploadAttachment(token, recordId, body.fileName, buffer, mimeType);
        attachmentResult = att.body;
      }

      return res.status(200).json({ document: { id: recordId }, attachment: attachmentResult });
    }

    // DELETE — remove document record
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id query param required' });
      }
      const delRes = await fetch(`${ZOHO_API_BASE}/crm/v2/${MODULE}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
      });
      if (!delRes.ok) throw new Error(`CRM DELETE ${delRes.status}: ${await delRes.text()}`);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/documents] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

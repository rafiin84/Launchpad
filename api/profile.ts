import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAccessToken } from './_zohoAdmin.js';

/**
 * /api/profile — Server-side profile management for the appusers CRM module.
 *
 * GET  /api/profile?email=x          → fetch profile by email
 * GET  /api/profile?email=x&photo=1  → fetch profile photo as base64
 * PUT  /api/profile                  → update profile fields (body: { email, fields })
 * POST /api/profile                  → upload photo or cover (body: multipart or JSON)
 */

const ZOHO_API_BASE = 'https://www.zohoapis.in';
const MODULE = 'appusers';

const FIELD_MAP: Record<string, string> = {
  name:       'Name',
  email:      'Email',
  phone:      'Phone',
  mobile:     'Mobile',
  role:       'Role',
  bio:        'Bio',
  location:   'Location',
  linkedIn:   'LinkedIn',
  twitter:    'Twitter',
  expertise:  'Expertise',
  zohoUserId: 'Zoho_User_Id',
  jobTitle:   'Job_Title',
  state:      'State',
  country:    'Country',
  coverImage: 'Cover_Image',
  languagePreference: 'Language_Preference',
};

interface ProfileRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  bio: string;
  location: string;
  linkedIn: string;
  twitter: string;
  expertise: string;
  coverImage: string;
  [key: string]: string;
}

function fromCRM(r: Record<string, unknown>): ProfileRecord {
  const s = (k: string) => (r[k] == null ? '' : String(r[k]));
  return {
    id: s('id'),
    name: s('Name'),
    email: s('Email'),
    role: s('Role'),
    bio: s('Bio'),
    location: s('Location'),
    linkedIn: s('LinkedIn'),
    twitter: s('Twitter'),
    expertise: s('Expertise'),
    coverImage: s('Cover_Image'),
    zohoUserId: s('Zoho_User_Id'),
    jobTitle: s('Job_Title'),
    state: s('State'),
    country: s('Country'),
    languagePreference: s('Language_Preference'),
  };
}

async function findByEmail(token: string, email: string): Promise<{ id: string; record: ProfileRecord } | null> {
  const url = `${ZOHO_API_BASE}/crm/v2/${MODULE}/search?criteria=(Email:equals:${email})`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });
  if (res.status === 204) return null;
  if (!res.ok) return null;
  const json = await res.json() as { data?: Array<Record<string, unknown>> };
  const rec = json.data?.[0];
  if (!rec) return null;
  const profile = fromCRM(rec);
  return { id: profile.id, record: profile };
}

async function upsertProfile(token: string, fields: Record<string, unknown>): Promise<string> {
  const url = `${ZOHO_API_BASE}/crm/v2/${MODULE}/upsert`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [fields],
      duplicate_check_fields: ['Email'],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`CRM upsert ${res.status}: ${errText}`);
  }
  const json = await res.json() as {
    data?: Array<{ code: string; details: { id: string }; status: string }>;
  };
  const record = json.data?.[0];
  if (!record || (record.code !== 'SUCCESS' && record.status !== 'success')) {
    throw new Error(`CRM upsert failed: ${JSON.stringify(record)}`);
  }
  return record.details.id;
}

async function fetchPhoto(token: string, recordId: string): Promise<string | null> {
  const url = `${ZOHO_API_BASE}/crm/v2/${MODULE}/${recordId}/photo`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.byteLength < 200) return null;
  const base64 = buffer.toString('base64');
  const mime = res.headers.get('content-type') || 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

async function uploadPhoto(token: string, recordId: string, base64Data: string, module = MODULE): Promise<boolean> {
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return false;
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, 'base64');

  const boundary = '----FormBoundary' + Date.now().toString(36);
  const fileName = 'photo.' + (mime.includes('png') ? 'png' : 'jpg');

  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
    `Content-Type: ${mime}\r\n\r\n`,
  ];
  const header = Buffer.from(bodyParts.join(''));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, buffer, footer]);

  const url = `${ZOHO_API_BASE}/crm/v2/${module}/${recordId}/photo`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  return res.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getAdminAccessToken();

    // GET — fetch profile, photo, or contact photos
    if (req.method === 'GET') {
      // Bulk fetch contact photos for founders page
      if (req.query.contactPhotos === '1') {
        const contactsRes = await fetch(
          `${ZOHO_API_BASE}/crm/v2/Contacts?per_page=200&fields=Email,Full_Name`,
          { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } },
        );
        if (contactsRes.status === 204) return res.status(200).json({ photos: {} });
        if (!contactsRes.ok) throw new Error(`Contacts GET ${contactsRes.status}`);
        const contactsJson = await contactsRes.json() as { data?: Array<{ id: string; Email: string; Full_Name: string }> };
        const contacts = contactsJson.data || [];

        const photos: Record<string, string> = {};
        await Promise.all(contacts.map(async (c) => {
          if (!c.Email) return;
          try {
            const photoRes = await fetch(
              `${ZOHO_API_BASE}/crm/v2/Contacts/${c.id}/photo`,
              { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } },
            );
            if (!photoRes.ok) return;
            const ct = photoRes.headers.get('content-type') || 'image/jpeg';
            if (ct.includes('json') || ct.includes('html')) return;
            const buf = Buffer.from(await photoRes.arrayBuffer());
            if (buf.byteLength < 100) return;
            photos[c.Email.toLowerCase()] = `data:${ct};base64,${buf.toString('base64')}`;
          } catch { /* skip */ }
        }));

        return res.status(200).json({ photos });
      }

      const email = req.query.email as string;
      const wantPhoto = req.query.photo === '1';
      if (!email) return res.status(400).json({ error: 'email query param required' });

      const result = await findByEmail(token, email);
      if (!result) return res.status(200).json({ profile: null });

      if (wantPhoto) {
        const photoUrl = await fetchPhoto(token, result.id);
        return res.status(200).json({ photo: photoUrl });
      }

      return res.status(200).json({ profile: result.record, recordId: result.id });
    }

    // PUT — update profile fields
    if (req.method === 'PUT') {
      const { email, fields } = req.body as {
        email?: string;
        fields?: Record<string, unknown>;
      };
      if (!email || !fields) {
        return res.status(400).json({ error: 'email and fields required' });
      }

      const payload: Record<string, unknown> = { Email: email };
      for (const [key, crmKey] of Object.entries(FIELD_MAP)) {
        if (key in fields && fields[key] !== undefined) {
          payload[crmKey] = fields[key];
        }
      }

      const recordId = await upsertProfile(token, payload);

      // Also update the Contacts module name if name was changed
      if (fields.name) {
        try {
          const contactSearch = `${ZOHO_API_BASE}/crm/v2/Contacts/search?criteria=(Email:equals:${email})`;
          const contactRes = await fetch(contactSearch, {
            headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
          });
          if (contactRes.ok && contactRes.status !== 204) {
            const contactJson = await contactRes.json() as { data?: Array<{ id: string }> };
            const contactId = contactJson.data?.[0]?.id;
            if (contactId) {
              const nameParts = String(fields.name).trim().split(/\s+/);
              const lastName = nameParts.pop() || String(fields.name);
              const firstName = nameParts.join(' ') || '';
              await fetch(`${ZOHO_API_BASE}/crm/v2/Contacts/${contactId}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Zoho-oauthtoken ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  data: [{ First_Name: firstName, Last_Name: lastName }],
                }),
              });
            }
          }
        } catch (err) {
          console.warn('[profile] Contact name update failed:', err);
        }
      }

      return res.status(200).json({ recordId });
    }

    // POST — upload photo or save cover image
    if (req.method === 'POST') {
      const { email, type, data: imageData } = req.body as {
        email?: string;
        type?: 'photo' | 'cover';
        data?: string;
      };
      if (!email || !type || !imageData) {
        return res.status(400).json({ error: 'email, type, and data required' });
      }

      // Find or create the record
      let result = await findByEmail(token, email);
      if (!result) {
        const id = await upsertProfile(token, { Email: email, Name: 'User' });
        result = { id, record: { id } as ProfileRecord };
      }

      if (type === 'photo') {
        const ok = await uploadPhoto(token, result.id, imageData);
        if (!ok) return res.status(500).json({ error: 'Photo upload failed' });

        // Also sync photo to the Contacts record
        try {
          const contactSearch = `${ZOHO_API_BASE}/crm/v2/Contacts/search?criteria=(Email:equals:${email})`;
          const contactRes = await fetch(contactSearch, {
            headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
          });
          if (contactRes.ok && contactRes.status !== 204) {
            const contactJson = await contactRes.json() as { data?: Array<{ id: string }> };
            const contactId = contactJson.data?.[0]?.id;
            if (contactId) {
              await uploadPhoto(token, contactId, imageData, 'Contacts');
            }
          }
        } catch (err) {
          console.warn('[profile] Contact photo sync failed:', err);
        }

        return res.status(200).json({ success: true, recordId: result.id });
      }

      if (type === 'cover') {
        // Store cover image data in the Cover_Image field
        await fetch(`${ZOHO_API_BASE}/crm/v2/${MODULE}/${result.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: [{ Cover_Image: imageData }] }),
        });
        return res.status(200).json({ success: true, recordId: result.id });
      }

      return res.status(400).json({ error: 'type must be "photo" or "cover"' });
    }

    // DELETE — remove profile photo
    if (req.method === 'DELETE') {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: 'email query param required' });

      const result = await findByEmail(token, email);
      if (!result) return res.status(404).json({ error: 'Profile not found' });

      const url = `${ZOHO_API_BASE}/crm/v2/${MODULE}/${result.id}/photo`;
      const delRes = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
      });
      return res.status(delRes.ok ? 200 : 500).json({ success: delRes.ok });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[profile] Error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

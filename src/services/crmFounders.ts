import {
  zohoList, zohoGetById, zohoCreate, zohoDelete, zohoSearch, type ZohoRecord,
  portalGetById, portalUpdate, portalUploadRecordPhoto, portalGetRecordPhoto, portalDeleteRecordPhoto,
  fetchPortalUserContact,
} from './zohoApi';
import { loadToken } from './oauth';
import { ZOHO_HOSTS } from '../config/auth';

/** Direct CRM API URL — no proxy. */
function crmUrl(apiPath: string): string {
  return `${ZOHO_HOSTS.crmApi}${apiPath}`;
}

/** Send the user's own token directly on every call. */
function crmHeaders(): Record<string, string> {
  const token = loadToken();
  return token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {};
}

// Founders are stored as Contacts in Zoho CRM
const MODULE = 'Contacts';

export interface CRMFounder {
  id: string;
  salutation: string;
  firstName: string;
  lastName: string;       // Required by CRM
  email: string;
  secondaryEmail: string;
  phone: string;
  mobile: string;
  title: string;          // Designation / Job Title
  department: string;
  company: string;
  leadSource: string;
  mailingCity: string;
  mailingState: string;
  mailingCountry: string;
  description: string;
  bio: string;
  location: string;
  linkedIn: string;
  twitter: string;
  skills: string[];
  createdTime: string;
}

export interface CRMFounderFields {
  salutation?: string;
  firstName: string;
  lastName: string;       // Required
  email: string;
  secondaryEmail?: string;
  phone?: string;
  mobile?: string;
  title?: string;
  department?: string;
  company?: string;
  leadSource?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingCountry?: string;
  mailingStreet?: string;
  mailingZip?: string;
  description?: string;
  bio?: string;
  location?: string;
  linkedIn?: string;
  twitter?: string;
  skills?: string[];
}

function fromRecord(r: ZohoRecord): CRMFounder {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  const skillsRaw = str('Skills_Expertise');
  return {
    id:             r.id,
    salutation:     str('Salutation'),
    firstName:      str('First_Name'),
    lastName:       str('Last_Name'),
    email:          str('Email'),
    secondaryEmail: str('Secondary_Email'),
    phone:          str('Phone'),
    mobile:         str('Mobile'),
    title:          str('Title'),
    department:     str('Department'),
    company:        str('Company') || ((r['Account_Name'] as Record<string, string>)?.name ?? ''),
    leadSource:     str('Lead_Source'),
    mailingCity:    str('Mailing_City'),
    mailingState:   str('Mailing_State'),
    mailingCountry: str('Mailing_Country'),
    description:    str('Description'),
    bio:            str('Bio'),
    location:       str('Location'),
    linkedIn:       str('LinkedIn'),
    twitter:        str('Twitter'),
    skills:         skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    createdTime:    str('Created_Time'),
  };
}

const FIELDS = [
  'Salutation', 'First_Name', 'Last_Name', 'Email', 'Secondary_Email',
  'Phone', 'Mobile', 'Title', 'Department', 'Company', 'Account_Name',
  'Lead_Source', 'Mailing_City', 'Mailing_State', 'Mailing_Country',
  'Description', 'Bio', 'Location', 'LinkedIn', 'Twitter', 'Skills_Expertise',
  'Created_Time',
].join(',');

// Builds a Contacts CRM payload from partial CRMFounder fields — shared by
// createCRMFounder (investor creating a founder) and updateMyFounderProfile
// (a founder editing their own Contact record).
function toContactPayload(fields: Partial<CRMFounderFields>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (fields.salutation !== undefined)     payload.Salutation     = fields.salutation;
  if (fields.firstName !== undefined)      payload.First_Name     = fields.firstName;
  if (fields.lastName !== undefined)       payload.Last_Name      = fields.lastName;
  if (fields.email !== undefined)          payload.Email          = fields.email;
  if (fields.secondaryEmail !== undefined) payload.Secondary_Email = fields.secondaryEmail;
  if (fields.phone !== undefined)          payload.Phone          = fields.phone;
  if (fields.mobile !== undefined)         payload.Mobile         = fields.mobile;
  if (fields.title !== undefined)          payload.Title          = fields.title;
  if (fields.department !== undefined)     payload.Department     = fields.department;
  if (fields.company !== undefined)        payload.Company        = fields.company;
  if (fields.leadSource !== undefined)     payload.Lead_Source    = fields.leadSource;
  if (fields.mailingCity !== undefined)    payload.Mailing_City   = fields.mailingCity;
  if (fields.mailingState !== undefined)   payload.Mailing_State  = fields.mailingState;
  if (fields.mailingCountry !== undefined) payload.Mailing_Country = fields.mailingCountry;
  if (fields.mailingStreet !== undefined)  payload.Mailing_Street = fields.mailingStreet;
  if (fields.mailingZip !== undefined)     payload.Mailing_Zip    = fields.mailingZip;
  if (fields.description !== undefined)    payload.Description    = fields.description;
  if (fields.bio !== undefined)            payload.Bio            = fields.bio;
  if (fields.location !== undefined)       payload.Location       = fields.location;
  if (fields.linkedIn !== undefined)       payload.LinkedIn       = fields.linkedIn;
  if (fields.twitter !== undefined)        payload.Twitter        = fields.twitter;
  if (fields.skills !== undefined)         payload.Skills_Expertise = fields.skills.join(', ');
  return payload;
}

export async function getCRMFounder(id: string): Promise<CRMFounder> {
  const record = await zohoGetById(MODULE, id, FIELDS);
  if (!record) throw new Error('Founder not found');
  return fromRecord(record);
}

export async function fetchCRMFounders(): Promise<CRMFounder[]> {
  const records = await zohoList(MODULE, {
    per_page: '200',
    sort_by: 'Created_Time',
    sort_order: 'desc',
    fields: FIELDS,
  });
  return records
    .map(fromRecord)
    .filter(f => !f.email.endsWith('@noemail.invalid') && !f.lastName.includes('(Sample)'));
}

// ─── Founder's own profile (portal token, self-service) ──────────────────────
// A founder's portal identity maps 1:1 to a Contacts record. Unlike the
// "appusers" module (admin-only, see crmAppUsers.ts), Contacts is readable
// and writable via the portal API, so this is the source of truth for the
// founder-editable profile fields on the Profile page.

/** Resolves the current founder's own Contact id via their portal token. */
export async function fetchMyContactId(): Promise<string | null> {
  const contact = await fetchPortalUserContact();
  return contact?.contactId || null;
}

export async function fetchMyFounderProfile(contactId: string): Promise<CRMFounder | null> {
  const record = await portalGetById(MODULE, contactId, FIELDS).catch(() => portalGetById(MODULE, contactId));
  return record ? fromRecord(record) : null;
}

export async function updateMyFounderProfile(contactId: string, fields: Partial<CRMFounderFields>): Promise<void> {
  // Zoho rejects the ENTIRE update with NOT_ALLOWED ("portal users cannot
  // edit invited field value") if Email is included at all — it's the
  // field tied to the portal invite/login identity. Strip it defensively
  // here so no caller can accidentally break every other field in the
  // same update by passing it.
  const rest = { ...fields };
  delete rest.email;
  await portalUpdate(MODULE, contactId, toContactPayload(rest));
}

export async function uploadMyFounderPhoto(contactId: string, file: Blob, fileName = 'photo.jpg'): Promise<void> {
  await portalUploadRecordPhoto(MODULE, contactId, file, fileName);
}

export async function fetchMyFounderPhoto(contactId: string): Promise<string | null> {
  return portalGetRecordPhoto(MODULE, contactId);
}

export async function deleteMyFounderPhoto(contactId: string): Promise<boolean> {
  return portalDeleteRecordPhoto(MODULE, contactId);
}

export async function createCRMFounder(fields: CRMFounderFields): Promise<string> {
  const payload = toContactPayload(fields);
  payload.Last_Name = fields.lastName; // Only required field
  const contactId = await zohoCreate(MODULE, payload);

  // Also create a record in the Founders module so investors can see this founder's profile
  if (fields.email) {
    const founderName = [fields.firstName, fields.lastName].filter(Boolean).join(' ');
    const location = [fields.mailingCity, fields.mailingState, fields.mailingCountry].filter(Boolean).join(', ');
    fetch('/api/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fields.email,
        data: {
          name: fields.company || founderName,
          founderNames: founderName,
          description: fields.description || '',
          location,
        },
      }),
    }).catch(err => console.warn('[CRMFounders] Failed to sync to Founders module:', err));
  }

  return contactId;
}

export async function findContactByEmail(email: string): Promise<string | null> {
  try {
    const records = await zohoSearch(MODULE, `(Email:equals:${email})`);
    return records[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function deleteCRMFounder(id: string): Promise<void> {
  return zohoDelete(MODULE, id);
}

// Lead Source picklist values from CRM
export const LEAD_SOURCE_OPTIONS = [
  'Advertisement', 'Cold Call', 'Employee Referral', 'External Referral',
  'Online Store', 'Partner', 'Public Relations', 'Sales Email Alias',
  'Seminar Partner', 'Internal Seminar', 'Trade Show', 'Web Download',
  'Web Research', 'Web Cases', 'Web Mail', 'Chat', 'X (Twitter)', 'Facebook',
];

export const SALUTATION_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];

/**
 * Fetch available portals from Zoho CRM settings.
 */
async function fetchPortals(): Promise<{ name: string; active: boolean }[]> {
  const token = loadToken();
  if (!token) return [];

  const url = crmUrl('/crm/v2/settings/portals');
  const res = await fetch(url, { headers: crmHeaders() });

  if (!res.ok) return [];
  const json = await res.json().catch(() => ({})) as { portals?: Array<{ name: string; active: boolean }> };
  return json.portals ?? [];
}

/**
 * Fetch user types for a given portal.
 * GET /crm/v2/settings/portals/{portal_name}/user_type
 */
async function fetchPortalUserTypes(portalName: string): Promise<{ id: string; name: string; active: boolean }[]> {
  const token = loadToken();
  if (!token) return [];

  const url = crmUrl(`/crm/v2/settings/portals/${encodeURIComponent(portalName)}/user_type`);
  const res = await fetch(url, { headers: crmHeaders() });

  if (!res.ok) return [];
  const json = await res.json().catch(() => ({})) as { user_type?: Array<{ id: string; name: string; active: boolean }> };
  return json.user_type ?? [];
}

/**
 * Send a portal invitation to a Contact.
 * Zoho CRM API: POST /crm/v2/Contacts/{record_id}/actions/portal_invite?user_type_id={id}&type=invite
 * Automatically fetches portal config and user type, then sends the invite.
 * If the user was already invited, automatically retries with type=reinvite.
 * Requires the contact to have an email address.
 */
export interface PortalInviteResult {
  message: string;
  wasReinvite: boolean;
}

/**
 * Check portal user status for a Contact by querying the Zoho CRM portal users API.
 * Returns the user's portal status: 'active', 'invited', 'disabled', or null if not found.
 *
 * Zoho CRM portal user statuses:
 *   "active"          → user accepted and can log in
 *   "disabled"        → admin disabled the user
 *   "yet_to_confirm"  → invitation sent, waiting for user to accept
 */
export type PortalUserAPIStatus = 'active' | 'invited' | 'disabled';


export async function checkPortalStatus(contactEmail: string): Promise<PortalUserAPIStatus | null> {
  if (!contactEmail) return null;

  try {
    const allStatuses = await fetchAllPortalUserStatuses();
    return allStatuses.get(contactEmail.toLowerCase()) ?? null;
  } catch (err) {
    console.warn('[Portal] Failed to check portal status:', err);
  }

  return null;
}

/**
 * Fetch all portal users and their statuses via the server-side admin API.
 *
 * Uses /api/portal-users which has the admin refresh token and full access
 * to Zoho CRM portal settings — much more reliable than the client-side
 * implicit-flow token which often lacks portal settings scopes.
 */
export async function fetchAllPortalUserStatuses(): Promise<Map<string, PortalUserAPIStatus>> {
  const result = new Map<string, PortalUserAPIStatus>();

  try {
    const res = await fetch('/api/portal-users');
    if (!res.ok) {
      console.warn('[Portal] Server API returned', res.status);
      return result;
    }

    const json = await res.json() as {
      users?: Array<{ email: string; name: string; status: 'active' | 'disabled' | 'invited' }>;
      debug?: string;
    };

    console.log('[Portal] Server response:', json);

    for (const u of json.users ?? []) {
      if (!u.email) continue;
      result.set(u.email.toLowerCase(), u.status);
    }

    console.log('[Portal] Status map:', Object.fromEntries(result));
  } catch (err) {
    console.warn('[Portal] Failed to fetch portal user statuses:', err);
  }

  return result;
}

/**
 * Send invitation email directly to an applicant via the server-side API.
 * This sends a branded email with a portal login link AND creates the
 * portal user in Zoho CRM so they can authenticate.
 */
export async function sendInviteEmail(contactId: string, email: string, name: string): Promise<{ message: string }> {
  const portalUrl = `${window.location.origin}/login`;

  const res = await fetch('/api/send-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactId, email, name, portalUrl }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
    throw new Error(body.message || `Failed to send invitation (${res.status})`);
  }

  const json = await res.json() as { message?: string };
  return { message: json.message || `Invitation sent to ${email}` };
}

/**
 * @deprecated Use sendInviteEmail instead — sends email directly from the app.
 * Kept for backward compatibility.
 */
export async function sendPortalInvitation(contactId: string, email?: string, name?: string): Promise<PortalInviteResult> {
  if (email) {
    const result = await sendInviteEmail(contactId, email, name || email);
    return { message: result.message, wasReinvite: false };
  }

  const token = loadToken();
  if (!token) throw new Error('Not connected to Zoho. Please sign in first.');

  const portals = await fetchPortals();
  const activePortal = portals.find(p => p.active) ?? portals[0];
  if (!activePortal) throw new Error('No portal configured in your Zoho CRM.');

  const userTypes = await fetchPortalUserTypes(activePortal.name);
  const activeUserType = userTypes.find(ut => ut.active) ?? userTypes[0];
  if (!activeUserType) throw new Error('No user type configured for this portal.');

  for (const type of ['invite', 'reinvite'] as const) {
    const qs = new URLSearchParams({ user_type_id: activeUserType.id, language: 'en_US', type });
    const invitePath = `/crm/v2/${MODULE}/${contactId}/actions/portal_invite?${qs}`;
    const url = crmUrl(invitePath);
    const res = await fetch(url, { method: 'POST', headers: crmHeaders() });
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (res.ok) {
      return { message: `Portal invitation sent successfully`, wasReinvite: type === 'reinvite' };
    }
    console.log(`[Portal] type=${type}:`, res.status, JSON.stringify(json));
  }
  throw new Error('Failed to send portal invitation');
}

import { zohoList, zohoGetById, zohoCreate, zohoDelete, type ZohoRecord } from './zohoApi';
import { loadToken } from './oauth';

const isDev = import.meta.env.DEV;

/** Build a URL for CRM API calls that works in both dev (Vite proxy) and prod (Vercel proxy) */
function crmUrl(apiPath: string): string {
  if (isDev) return `/zoho-crm-proxy${apiPath}`;
  const token = loadToken();
  return `/api/zoho-crm-proxy?path=${encodeURIComponent(apiPath)}&token=${encodeURIComponent(token || '')}`;
}

/** Headers: in dev include Authorization (Vite proxy forwards it), in prod the serverless proxy handles auth */
function crmHeaders(): Record<string, string> {
  if (isDev) {
    const token = loadToken();
    return token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {};
  }
  return {};
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
}

function fromRecord(r: ZohoRecord): CRMFounder {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
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
    createdTime:    str('Created_Time'),
  };
}

const FIELDS = [
  'Salutation', 'First_Name', 'Last_Name', 'Email', 'Secondary_Email',
  'Phone', 'Mobile', 'Title', 'Department', 'Company', 'Account_Name',
  'Lead_Source', 'Mailing_City', 'Mailing_State', 'Mailing_Country',
  'Description', 'Created_Time',
].join(',');

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
  return records.map(fromRecord);
}

export async function createCRMFounder(fields: CRMFounderFields): Promise<string> {
  const payload: Record<string, unknown> = {
    Last_Name: fields.lastName,   // Only required field
  };
  if (fields.salutation)     payload.Salutation     = fields.salutation;
  if (fields.firstName)      payload.First_Name     = fields.firstName;
  if (fields.email)          payload.Email           = fields.email;
  if (fields.secondaryEmail) payload.Secondary_Email = fields.secondaryEmail;
  if (fields.phone)          payload.Phone           = fields.phone;
  if (fields.mobile)         payload.Mobile          = fields.mobile;
  if (fields.title)          payload.Title           = fields.title;
  if (fields.department)     payload.Department      = fields.department;
  if (fields.company)        payload.Company         = fields.company;
  if (fields.leadSource)     payload.Lead_Source     = fields.leadSource;
  if (fields.mailingCity)    payload.Mailing_City    = fields.mailingCity;
  if (fields.mailingState)   payload.Mailing_State   = fields.mailingState;
  if (fields.mailingCountry) payload.Mailing_Country = fields.mailingCountry;
  if (fields.mailingStreet)  payload.Mailing_Street  = fields.mailingStreet;
  if (fields.mailingZip)     payload.Mailing_Zip     = fields.mailingZip;
  if (fields.description)    payload.Description     = fields.description;
  return zohoCreate(MODULE, payload);
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

/** Map a raw Zoho portal status string to our canonical status */
function derivePortalStatus(raw: Record<string, unknown>): PortalUserAPIStatus {
  // Zoho may return status at different levels; check all possibilities
  const statusStr = String(raw.status ?? raw.Status ?? raw.portal_status ?? '').toLowerCase().trim();

  // Active
  if (statusStr === 'active') return 'active';

  // Disabled / Deactivated
  if (statusStr === 'disabled' || statusStr === 'deactivated' || statusStr === 'inactive') return 'disabled';

  // Yet to confirm / Invited / Pending / Reinvited
  if (
    statusStr === 'yet_to_confirm' ||
    statusStr === 'yet to confirm' ||
    statusStr === 'invited' ||
    statusStr === 'pending' ||
    statusStr === 'reinvited' ||
    statusStr === 're-invited' ||
    statusStr === 'waiting'
  ) return 'invited';

  // Fallback: check boolean `active` field
  if (raw.active === true) return 'active';
  if (raw.active === false) return 'disabled';

  // Unknown — default to invited (safe: won't wrongly show as Active)
  console.warn('[Portal] Unknown portal status:', statusStr, raw);
  return 'invited';
}

export async function checkPortalStatus(contactEmail: string): Promise<PortalUserAPIStatus | null> {
  const token = loadToken();
  if (!token || !contactEmail) return null;

  try {
    const allStatuses = await fetchAllPortalUserStatuses();
    return allStatuses.get(contactEmail.toLowerCase()) ?? null;
  } catch (err) {
    console.warn('[Portal] Failed to check portal status:', err);
  }

  return null;
}

/**
 * Fetch all portal users across all user types and return a map of email → status.
 * This is much more efficient than checking one user at a time.
 */
export async function fetchAllPortalUserStatuses(): Promise<Map<string, PortalUserAPIStatus>> {
  const result = new Map<string, PortalUserAPIStatus>();
  const token = loadToken();
  if (!token) return result;

  try {
    const portals = await fetchPortals();
    const activePortal = portals.find(p => p.active) ?? portals[0];
    if (!activePortal) {
      console.warn('[Portal] No portal found');
      return result;
    }

    const userTypes = await fetchPortalUserTypes(activePortal.name);
    console.log('[Portal] Fetching users for portal:', activePortal.name, 'user_types:', userTypes.map(u => u.id));

    for (const ut of userTypes) {
      const url = crmUrl(`/crm/v2/settings/portals/${encodeURIComponent(activePortal.name)}/user_type/${ut.id}/users`);
      const res = await fetch(url, { headers: crmHeaders() });

      if (!res.ok) {
        console.warn('[Portal] Failed to fetch users for user_type', ut.id, ':', res.status);
        continue;
      }

      const json = await res.json().catch(() => ({}));
      console.log('[Portal] Raw API response for user_type', ut.id, ':', JSON.stringify(json).slice(0, 500));

      // Zoho may return users under different keys
      const rawJson = json as Record<string, unknown>;
      const usersArray = (
        rawJson.users ?? rawJson.portal_users ?? rawJson.data ?? []
      ) as Array<Record<string, unknown>>;

      for (const entry of usersArray) {
        // User data may be nested under a "user" key or flat
        const userObj = (entry.user ?? entry) as Record<string, unknown>;

        // Try multiple email field names
        const email = String(userObj.email ?? userObj.Email ?? entry.email ?? entry.Email ?? '').trim();
        if (!email) continue;

        // Derive status — check both the outer entry AND the inner user object
        // (Zoho sometimes puts status at different nesting levels)
        const merged = { ...userObj, ...entry };
        const derived = derivePortalStatus(merged);

        console.log('[Portal] User:', email, '→', derived, '(raw status:', merged.status ?? merged.Status ?? 'none', ')');
        result.set(email.toLowerCase(), derived);
      }
    }

    console.log('[Portal] Final status map:', Object.fromEntries(result));
  } catch (err) {
    console.warn('[Portal] Failed to fetch portal user statuses:', err);
  }

  return result;
}

export async function sendPortalInvitation(contactId: string): Promise<PortalInviteResult> {
  const token = loadToken();
  if (!token) throw new Error('Not connected to Zoho. Please sign in first.');

  // 1. Fetch portal config
  const portals = await fetchPortals();
  const activePortal = portals.find(p => p.active) ?? portals[0];
  if (!activePortal) {
    throw new Error('No portal configured in your Zoho CRM. Please set up a portal first.');
  }

  // 2. Fetch user types for this portal
  const userTypes = await fetchPortalUserTypes(activePortal.name);
  const activeUserType = userTypes.find(ut => ut.active) ?? userTypes[0];
  if (!activeUserType) {
    throw new Error('No user type configured for this portal. Please set up a user type in your portal settings.');
  }

  console.log('[Portal] Sending invite with portal:', activePortal.name, 'user_type:', activeUserType.id, activeUserType.name);

  // 3. Try without 'type' first, then 'invite', then 'reinvite'
  for (const type of [null, 'invite', 'reinvite'] as const) {
    const qsParams: Record<string, string> = {
      user_type_id: activeUserType.id,
      language: 'en_US',
    };
    if (type) qsParams.type = type;

    // Build the full CRM API path with query string
    const invitePath = `/crm/v2/${MODULE}/${contactId}/actions/portal_invite`;
    const fullPath = `${invitePath}?${new URLSearchParams(qsParams).toString()}`;

    const url = crmUrl(fullPath);
    const res = await fetch(url, {
      method: 'POST',
      headers: crmHeaders(),
    });

    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log(`[Portal] type=${type}:`, res.status, JSON.stringify(json));

    // Parse response
    const inviteResult = (json as { portal_invite?: Array<{ message?: string; code?: string; status?: string }> }).portal_invite;
    const topMessage = (json as { message?: string }).message ?? '';
    const resultEntry = inviteResult?.[0];
    const resultMessage = resultEntry?.message ?? topMessage;
    const resultCode = resultEntry?.code ?? (json as { code?: string }).code ?? '';

    // If param missing or invalid type, try next variant
    if (type !== 'reinvite' && !res.ok) {
      const msg = resultMessage.toLowerCase();
      if (msg.includes('invalid type') || msg.includes('required') || msg.includes('param')) {
        console.log(`[Portal] type=${type ?? 'none'} failed, trying next variant...`);
        continue;
      }
    }

    // If reinvite gets INTERNAL_ERROR, still report as success (user was already invited)
    if (type === 'reinvite' && resultCode === 'INTERNAL_ERROR') {
      return {
        message: 'User was already invited to the portal. They can log in with their portal credentials.',
        wasReinvite: true,
      };
    }

    if (!res.ok || resultEntry?.status === 'error' || (resultCode && resultCode !== 'SUCCESS')) {
      throw new Error(resultMessage || `Failed to send invitation (HTTP ${res.status})`);
    }

    return {
      message: resultMessage || (type === 'reinvite' ? 'Portal re-invitation sent successfully' : 'Portal invitation sent successfully'),
      wasReinvite: type === 'reinvite',
    };
  }

  throw new Error('Failed to send portal invitation');
}

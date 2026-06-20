import { zohoList, zohoGetById, zohoCreate, zohoDelete, getZohoBase, type ZohoRecord } from './zohoApi';
import { loadToken } from './oauth';

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

  const res = await fetch(`${getZohoBase()}/settings/portals`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });

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

  const res = await fetch(`${getZohoBase()}/settings/portals/${encodeURIComponent(portalName)}/user_type`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });

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
export async function sendPortalInvitation(contactId: string): Promise<string> {
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

  // 3. Send the invite — v2 query params, no 'type' param (v2 doesn't support it)
  const params = new URLSearchParams({
    user_type_id: activeUserType.id,
    language: 'en_US',
  });

  const res = await fetch(
    `${getZohoBase()}/${MODULE}/${contactId}/actions/portal_invite?${params.toString()}`,
    {
      method: 'POST',
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
    },
  );

  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  console.log('[Portal] Response:', res.status, JSON.stringify(json));

  // Parse the final response
  const inviteResult = (json as { portal_invite?: Array<{ message?: string; code?: string; status?: string }> }).portal_invite;
  const topMessage = (json as { message?: string }).message ?? '';
  const resultEntry = inviteResult?.[0];
  const resultMessage = resultEntry?.message ?? topMessage;
  const resultCode = resultEntry?.code ?? (json as { code?: string }).code ?? '';

  if (!res.ok || resultEntry?.status === 'error' || (resultCode && resultCode !== 'SUCCESS')) {
    throw new Error(resultMessage || `Failed to send invitation (HTTP ${res.status})`);
  }

  return resultMessage || 'Portal invitation sent successfully';
}

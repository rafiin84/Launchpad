import { zohoList, zohoCreate, zohoDelete, type ZohoRecord } from './zohoApi';

// Founders are stored in the Zoho CRM Contacts module
const MODULE = 'Contacts';

export interface CRMFounder {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  designation: string;
  createdTime: string;
}

export interface CRMFounderFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  designation: string;
}

function fromRecord(r: ZohoRecord): CRMFounder {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:          r.id,
    firstName:   str('First_Name'),
    lastName:    str('Last_Name'),
    email:       str('Email'),
    phone:       str('Phone'),
    company:     str('Company') || (r['Account_Name'] as Record<string, string>)?.name || '',
    designation: str('Designation') || str('Title'),
    createdTime: str('Created_Time'),
  };
}

const FIELDS = 'First_Name,Last_Name,Email,Phone,Company,Designation,Title,Account_Name,Created_Time';

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
    First_Name: fields.firstName,
    Last_Name:  fields.lastName,
    Email:      fields.email,
  };
  if (fields.phone) payload.Phone = fields.phone;
  if (fields.company) payload.Company = fields.company;
  if (fields.designation) payload.Designation = fields.designation;
  return zohoCreate(MODULE, payload);
}

export async function deleteCRMFounder(id: string): Promise<void> {
  return zohoDelete(MODULE, id);
}

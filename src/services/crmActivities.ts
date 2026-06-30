import { zohoList, zohoGetById, zohoCreate, zohoUpdate, zohoDelete, portalList, portalCreate, type ZohoRecord } from './zohoApi';

const MODULE = 'My_Activities';

const FIELD_MAP: Record<string, string> = {
  title:           'Name',
  activityType:    'Activity_Type',
  content:         'Content',
  companyName:     'Company_Name',
  authorName:      'Author_Name',
  tags:            'Activity_Tags',
  imageUrl:        'Image_URL',        // website field — stores public URLs only
  imageData:       'Activity_Image_Data', // large textarea — stores compressed base64
};

export interface CRMActivity {
  id: string;
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  authorName: string;
  tags: string;
  imageUrl: string;   // public URL (from URL mode)
  imageData: string;  // compressed base64 (from file upload)
}

export type CRMActivityFields = Omit<CRMActivity, 'id'>;

function fromRecord(r: ZohoRecord): CRMActivity {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:           r.id,
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

// Explicitly list all fields — Zoho omits large textarea fields from default list responses
const ALL_FIELDS = 'Name,Activity_Type,Content,Company_Name,Author_Name,Activity_Tags,Image_URL,Activity_Image_Data';

export async function getCRMActivity(id: string): Promise<CRMActivity> {
  const record = await zohoGetById(MODULE, id, ALL_FIELDS);
  if (!record) throw new Error('Activity not found');
  return fromRecord(record);
}

export async function fetchCRMActivities(): Promise<CRMActivity[]> {
  const records = await zohoList(MODULE, {
    per_page: '200',
    sort_by: 'Modified_Time',
    sort_order: 'desc',
    fields: ALL_FIELDS,
  });
  return records.map(fromRecord);
}

export async function createCRMActivity(fields: CRMActivityFields): Promise<string> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
    const raw = (fields as Record<string, string>)[formKey] ?? '';
    if (raw !== '') payload[crmKey] = raw;
  }
  return zohoCreate(MODULE, payload);
}

export async function updateCRMActivity(id: string, fields: CRMActivityFields): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
    const raw = (fields as Record<string, string>)[formKey] ?? '';
    payload[crmKey] = raw; // allow empty to clear fields
  }
  return zohoUpdate(MODULE, id, payload);
}

export async function deleteCRMActivity(id: string): Promise<void> {
  return zohoDelete(MODULE, id);
}

// ─── Portal-domain variants (for portal tokens) ─────────────────────────────

export async function fetchPortalActivities(): Promise<CRMActivity[]> {
  const records = await portalList(MODULE, {
    per_page: '200',
    sort_by: 'Modified_Time',
    sort_order: 'desc',
    fields: ALL_FIELDS,
  });
  return records.map(fromRecord);
}

export async function createPortalActivity(fields: CRMActivityFields): Promise<string> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
    const raw = (fields as Record<string, string>)[formKey] ?? '';
    if (raw !== '') payload[crmKey] = raw;
  }
  return portalCreate(MODULE, payload);
}

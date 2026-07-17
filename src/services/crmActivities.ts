import { zohoList, zohoListUnscoped, zohoCoql, zohoGetById, zohoCreate, zohoUpdate, zohoDelete, type ZohoRecord } from './zohoApi';
import { loadRole } from './oauth';

const MODULE = 'My_Activities';

const FIELD_MAP: Record<string, string> = {
  title:           'Name',
  activityType:    'Activity_Type',
  content:         'Content',
  companyName:     'Company_Name',
  authorName:      'Author_Name',
  authorRole:      'Author_Role',
  tags:            'Activity_Tags',
  imageUrl:        'Image_URL',
  imageData:       'Activity_Image_Data',
  visibility:      'Visibility',
};

export interface CRMActivity {
  id: string;
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  authorName: string;
  authorRole: string;
  tags: string;
  imageUrl: string;
  imageData: string;
  visibility: string;
  createdTime: string;
}

export type CRMActivityFields = Omit<CRMActivity, 'id' | 'createdTime'>;

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
    authorRole:   str(FIELD_MAP.authorRole),
    tags:         str(FIELD_MAP.tags),
    imageUrl:     str(FIELD_MAP.imageUrl),
    imageData:    str(FIELD_MAP.imageData),
    visibility:   str(FIELD_MAP.visibility),
    createdTime:  str('Created_Time') || str('Modified_Time'),
  };
}

// Explicitly list all fields — Zoho omits large textarea fields from default list responses
const ALL_FIELDS = 'Name,Activity_Type,Content,Company_Name,Author_Name,Author_Role,Activity_Tags,Image_URL,Activity_Image_Data,Visibility,Created_Time,Modified_Time';

export async function getCRMActivity(id: string): Promise<CRMActivity> {
  const record = await zohoGetById(MODULE, id, ALL_FIELDS);
  if (!record) throw new Error('Activity not found');
  return fromRecord(record);
}

export async function fetchCRMActivities(): Promise<CRMActivity[]> {
  // Investors use COQL which returns textarea fields (Content, Activity_Image_Data)
  // that the standard list endpoint silently omits.
  // Portal founders fall back to zohoList + local-cache backfill (COQL rejects portal tokens).
  const listParams = {
    per_page: '200',
    sort_by: 'Created_Time',
    sort_order: 'desc',
    fields: ALL_FIELDS,
  };

  if (loadRole() !== 'founder') {
    // Investors: use COQL which returns textarea fields (Content, Activity_Image_Data)
    try {
      const coqlFields = 'id, Name, Activity_Type, Content, Company_Name, Author_Name, Author_Role, Activity_Tags, Image_URL, Activity_Image_Data, Visibility, Created_Time, Modified_Time';
      const records = await zohoCoql(
        `SELECT ${coqlFields} FROM ${MODULE} ORDER BY Created_Time DESC LIMIT 200`
      );
      return records.map(fromRecord);
    } catch (err) {
      console.warn('[Activities] COQL failed, falling back to list:', err);
    }
    return (await zohoList(MODULE, listParams)).map(fromRecord);
  }

  // Portal founders: fetch the full list (now returns all records since portal
  // is configured for "All Records"). Then backfill textarea fields (Content,
  // Activity_Image_Data) via individual GETs for any record missing content.
  let raw: ZohoRecord[] = [];
  try {
    raw = await zohoListUnscoped(MODULE, listParams);
    if (raw.length === 0) throw new Error('empty');
  } catch {
    try { raw = await zohoList(MODULE, listParams); } catch (err) {
      console.warn('[Activities] List failed:', err);
    }
  }

  const activities = raw.map(fromRecord);

  // Individual GETs return textarea fields — fetch for records with empty content.
  const missing = activities.filter(a => !a.content && !a.id.startsWith('local_'));
  if (missing.length > 0) {
    const fetched = await Promise.allSettled(
      missing.slice(0, 50).map(a => zohoGetById(MODULE, a.id, ALL_FIELDS))
    );
    const byId = new Map<string, CRMActivity>();
    fetched.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) byId.set(missing[i].id, fromRecord(r.value));
    });
    return activities.map(a => byId.get(a.id) ?? a);
  }

  return activities;
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


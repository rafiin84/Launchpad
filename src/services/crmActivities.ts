import { zohoList, zohoCreate, zohoDelete, type ZohoRecord } from './zohoApi';

const MODULE = 'My_Activities';

const FIELD_MAP: Record<string, string> = {
  title:        'Name',
  activityType: 'Activity_Type',
  content:      'Content',
  companyName:  'Company_Name',
  authorName:   'Author_Name',
  tags:         'Activity_Tags',
  imageUrl:     'Image_URL',
};

export interface CRMActivity {
  id: string;
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  authorName: string;
  tags: string;
  imageUrl: string;
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
  };
}

export async function fetchCRMActivities(): Promise<CRMActivity[]> {
  const records = await zohoList(MODULE, { per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc' });
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

export async function deleteCRMActivity(id: string): Promise<void> {
  return zohoDelete(MODULE, id);
}

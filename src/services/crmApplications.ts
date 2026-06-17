import { zohoList, zohoGetById, zohoCreate, zohoUpdate, zohoDelete, type ZohoRecord } from './zohoApi';

const MODULE = 'Applications';

const FIELD_MAP: Record<string, string> = {
  companyName:        'Name',
  industry:           'Industry',
  website:            'Website',
  fundingAsk:         'Funding_Ask',
  useOfFunds:         'Use_of_Funds',
  previousFunding:    'Previous_Funding',
  companyDescription: 'Company_Description',
  founderName:        'Founder_Name',
  founderEmail:       'Founder_Email',
  founderPhone:       'Founder_Phone',
  founderLinkedin:    'Founder_LinkedIn',
  pipelineStage:      'Pipeline_Stage',
  location:           'Location',
  teamSize:           'Team_Size',
  foundedYear:        'Founded_Year',
  pitchVideoUrl:      'Pitch_Video_URL',
};

const NUMERIC_FIELDS = new Set(['fundingAsk', 'previousFunding', 'teamSize', 'foundedYear']);

export interface CRMApplication {
  id: string;
  companyName: string;
  industry: string;
  website: string;
  fundingAsk: string;
  useOfFunds: string;
  previousFunding: string;
  companyDescription: string;
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderLinkedin: string;
  pipelineStage: string;
  location: string;
  teamSize: string;
  foundedYear: string;
  pitchVideoUrl: string;
}

export type CRMApplicationFields = Omit<CRMApplication, 'id'>;

function toPayload(fields: CRMApplicationFields): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
    const raw = (fields as Record<string, string>)[formKey] ?? '';
    if (raw === '') continue;
    if (NUMERIC_FIELDS.has(formKey)) {
      const n = parseFloat(raw);
      if (!isNaN(n)) payload[crmKey] = n;
    } else {
      payload[crmKey] = raw;
    }
  }
  return payload;
}

function fromRecord(r: ZohoRecord): CRMApplication {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:                 r.id,
    companyName:        str(FIELD_MAP.companyName),
    industry:           str(FIELD_MAP.industry),
    website:            str(FIELD_MAP.website),
    fundingAsk:         str(FIELD_MAP.fundingAsk),
    useOfFunds:         str(FIELD_MAP.useOfFunds),
    previousFunding:    str(FIELD_MAP.previousFunding),
    companyDescription: str(FIELD_MAP.companyDescription),
    founderName:        str(FIELD_MAP.founderName),
    founderEmail:       str(FIELD_MAP.founderEmail),
    founderPhone:       str(FIELD_MAP.founderPhone),
    founderLinkedin:    str(FIELD_MAP.founderLinkedin),
    pipelineStage:      str(FIELD_MAP.pipelineStage),
    location:           str(FIELD_MAP.location),
    teamSize:           str(FIELD_MAP.teamSize),
    foundedYear:        str(FIELD_MAP.foundedYear),
    pitchVideoUrl:      str(FIELD_MAP.pitchVideoUrl),
  };
}

export async function fetchCRMApplications(): Promise<CRMApplication[]> {
  const records = await zohoList(MODULE, { per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc' });
  return records.map(fromRecord);
}

export async function getCRMApplication(id: string): Promise<CRMApplication | null> {
  const r = await zohoGetById(MODULE, id);
  return r ? fromRecord(r) : null;
}

export async function createCRMApplication(fields: CRMApplicationFields): Promise<string> {
  return zohoCreate(MODULE, toPayload(fields));
}

export async function updateCRMApplication(id: string, fields: CRMApplicationFields): Promise<void> {
  return zohoUpdate(MODULE, id, toPayload(fields));
}

export async function deleteCRMApplication(id: string): Promise<void> {
  return zohoDelete(MODULE, id);
}

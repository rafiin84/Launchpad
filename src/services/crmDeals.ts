import { zohoList, zohoCreate, zohoUpdate, zohoDelete, type ZohoRecord } from './zohoApi';

const MODULE = 'Deals';

const FIELD_MAP: Record<string, string> = {
  dealName:    'Deal_Name',
  stage:       'Stage',
  amount:      'Amount',
  closingDate: 'Closing_Date',
  description: 'Description',
  accountName: 'Account_Name',
  nextStep:    'Next_Step',
  probability: 'Probability',
  leadSource:  'Lead_Source',
};

const NUMERIC_FIELDS = new Set(['amount', 'probability']);

export interface CRMDeal {
  id: string;
  dealName: string;
  stage: string;
  amount: string;
  closingDate: string;
  description: string;
  accountName: string;
  nextStep: string;
  probability: string;
  leadSource: string;
}

export type CRMDealFields = Omit<CRMDeal, 'id'>;

export const CRM_DEAL_STAGES = [
  'Qualification',
  'Value Proposition',
  'Id. Decision Makers',
  'Perception Analysis',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost',
] as const;

function toPayload(fields: CRMDealFields): Record<string, unknown> {
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

function fromRecord(r: ZohoRecord): CRMDeal {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && v !== null && 'name' in v) return String((v as { name: string }).name);
    return String(v);
  };
  return {
    id:          r.id,
    dealName:    str(FIELD_MAP.dealName),
    stage:       str(FIELD_MAP.stage),
    amount:      str(FIELD_MAP.amount),
    closingDate: str(FIELD_MAP.closingDate),
    description: str(FIELD_MAP.description),
    accountName: str(FIELD_MAP.accountName),
    nextStep:    str(FIELD_MAP.nextStep),
    probability: str(FIELD_MAP.probability),
    leadSource:  str(FIELD_MAP.leadSource),
  };
}

export async function fetchCRMDeals(): Promise<CRMDeal[]> {
  const records = await zohoList(MODULE, { per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc' });
  return records.map(fromRecord);
}

export async function createCRMDeal(fields: CRMDealFields): Promise<string> {
  return zohoCreate(MODULE, toPayload(fields));
}

export async function updateCRMDeal(id: string, fields: CRMDealFields): Promise<void> {
  return zohoUpdate(MODULE, id, toPayload(fields));
}

export async function deleteCRMDeal(id: string): Promise<void> {
  return zohoDelete(MODULE, id);
}

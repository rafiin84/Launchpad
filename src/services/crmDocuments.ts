import { zohoList, zohoCreate, zohoDelete, type ZohoRecord } from './zohoApi';

const MODULE = 'My_Documents';

const FIELD_MAP: Record<string, string> = {
  documentName:  'Name',
  documentType:  'Document_Type',
  relatedCompany:'Related_Company',
  description:   'Document_Description',
  visibility:    'Visibility',
  fileName:      'File_Name',
  fileSize:      'File_Size',
};

export interface CRMDocument {
  id: string;
  documentName: string;
  documentType: string;
  relatedCompany: string;
  description: string;
  visibility: string;
  fileName: string;
  fileSize: string;
}

export type CRMDocumentFields = Omit<CRMDocument, 'id'>;

function fromRecord(r: ZohoRecord): CRMDocument {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:             r.id,
    documentName:   str(FIELD_MAP.documentName),
    documentType:   str(FIELD_MAP.documentType),
    relatedCompany: str(FIELD_MAP.relatedCompany),
    description:    str(FIELD_MAP.description),
    visibility:     str(FIELD_MAP.visibility),
    fileName:       str(FIELD_MAP.fileName),
    fileSize:       str(FIELD_MAP.fileSize),
  };
}

export async function fetchCRMDocuments(): Promise<CRMDocument[]> {
  const records = await zohoList(MODULE, { per_page: '200', sort_by: 'Modified_Time', sort_order: 'desc' });
  return records.map(fromRecord);
}

export async function createCRMDocument(fields: CRMDocumentFields): Promise<string> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
    const raw = (fields as Record<string, string>)[formKey] ?? '';
    if (raw !== '') payload[crmKey] = raw;
  }
  return zohoCreate(MODULE, payload);
}

export async function deleteCRMDocument(id: string): Promise<void> {
  return zohoDelete(MODULE, id);
}

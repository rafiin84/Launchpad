import { zohoList, zohoCreate, zohoDelete, zohoGetAttachments, zohoDownloadAttachment, zohoUploadAttachment } from './zohoApi';

export interface CRMDocument {
  id: string;
  documentName: string;
  documentType: string;
  relatedCompany: string;
  description: string;
  visibility: string;
  fileName: string;
  fileSize: string;
  authorName: string;
  authorRole: string;
  createdTime: string;
}

export type CRMDocumentFields = Omit<CRMDocument, 'id' | 'createdTime'>;

const MODULE = 'My_Documents';

const FIELD_MAP: Record<string, string> = {
  documentName:    'Name',
  documentType:    'Document_Type',
  relatedCompany:  'Related_Company',
  description:     'Document_Description',
  visibility:      'Visibility',
  fileName:        'File_Name',
  fileSize:        'File_Size',
  authorName:      'Author_Name',
  authorRole:      'Author_Role',
};

const ALL_FIELDS = Object.values(FIELD_MAP).join(',') + ',Created_Time';

export async function fetchCRMDocuments(): Promise<CRMDocument[]> {
  const records = await zohoList(MODULE, {
    per_page: '200',
    sort_by: 'Created_Time',
    sort_order: 'desc',
    fields: ALL_FIELDS,
  });
  return records.map(r => ({
    id:             String(r.id),
    documentName:   String(r['Name'] ?? ''),
    documentType:   String(r['Document_Type'] ?? ''),
    relatedCompany: String(r['Related_Company'] ?? ''),
    description:    String(r['Document_Description'] ?? ''),
    visibility:     String(r['Visibility'] ?? ''),
    fileName:       String(r['File_Name'] ?? ''),
    fileSize:       String(r['File_Size'] ?? ''),
    authorName:     String(r['Author_Name'] ?? ''),
    authorRole:     String(r['Author_Role'] ?? ''),
    createdTime:    String(r['Created_Time'] ?? ''),
  }));
}

export async function createCRMDocument(
  fields: CRMDocumentFields & { fileData?: string; fileName?: string; mimeType?: string },
): Promise<string> {
  const payload: Record<string, unknown> = {};
  for (const [appKey, crmKey] of Object.entries(FIELD_MAP)) {
    const val = (fields as Record<string, unknown>)[appKey];
    if (val !== undefined && val !== null && val !== '') {
      payload[crmKey] = val;
    }
  }

  const recordId = await zohoCreate(MODULE, payload);

  if (fields.fileData && fields.fileName) {
    try {
      const base64 = fields.fileData.includes(',') ? fields.fileData.split(',')[1] : fields.fileData;
      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: fields.mimeType || 'application/octet-stream' });
      await zohoUploadAttachment(MODULE, recordId, blob, fields.fileName);
    } catch (err) {
      console.warn('[crmDocuments] Attachment upload failed:', err);
    }
  }

  return recordId;
}

export async function deleteCRMDocument(id: string): Promise<void> {
  await zohoDelete(MODULE, id);
}

export async function fetchDocumentAttachments(
  recordId: string,
): Promise<Array<{ id: string; File_Name: string; Size: string }>> {
  return zohoGetAttachments(MODULE, recordId);
}

export async function downloadAttachment(recordId: string, attachmentId: string, fileName: string): Promise<void> {
  const blob = await zohoDownloadAttachment(MODULE, recordId, attachmentId);
  if (!blob) throw new Error('Download failed');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function viewAttachment(recordId: string, attachmentId: string): Promise<void> {
  const blob = await zohoDownloadAttachment(MODULE, recordId, attachmentId);
  if (!blob) throw new Error('View failed');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

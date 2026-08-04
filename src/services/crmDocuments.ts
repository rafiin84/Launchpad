import { zohoList, zohoCreate, zohoDelete, zohoGetAttachments, zohoDownloadAttachment, zohoUploadAttachment, portalList } from './zohoApi';
import { loadRole } from './oauth';
import { portalCreate } from './zohoApi';
import { uploadFile, canUploadFiles } from './fileUpload';

export interface CRMDocument {
  id: string;
  documentName: string;
  documentType: string;
  relatedCompany: string;
  description: string;
  visibility: string;
  fileName: string;
  fileSize: string;
  fileUrl: string;
  authorName: string;
  authorRole: string;
  createdTime: string;
}

export type CRMDocumentFields = Omit<CRMDocument, 'id' | 'createdTime'>;

const MODULE = 'My_Documents';
// Founders (portal users) can't write My_Documents; they write here and a Zoho
// workflow relays each submission into My_Documents. Same field API names.
const FOUNDER_SUBMIT_MODULE = 'Document_Submissions';

const FIELD_MAP: Record<string, string> = {
  documentName:    'Name',
  documentType:    'Document_Type',
  relatedCompany:  'Related_Company',
  description:     'Document_Description',
  visibility:      'Visibility',
  fileName:        'File_Name',
  fileSize:        'File_Size',
  fileUrl:         'File_URL',
  authorName:      'Author_Name',
  authorRole:      'Author_Role',
};

const ALL_FIELDS = Object.values(FIELD_MAP).join(',') + ',Created_Time';

function fromRecord(r: Record<string, unknown>): CRMDocument {
  const s = (k: string) => String(r[k] ?? '');
  return {
    id:             String(r.id),
    documentName:   s('Name'),
    documentType:   s('Document_Type'),
    relatedCompany: s('Related_Company'),
    description:    s('Document_Description'),
    visibility:     s('Visibility'),
    fileName:       s('File_Name'),
    fileSize:       s('File_Size'),
    fileUrl:        s('File_URL'),
    authorName:     s('Author_Name'),
    authorRole:     s('Author_Role'),
    createdTime:    s('Created_Time'),
  };
}

export async function fetchCRMDocuments(): Promise<CRMDocument[]> {
  const params = { per_page: '200', sort_by: 'Created_Time', sort_order: 'desc', fields: ALL_FIELDS };
  // Founders read My_Documents via the portal API; investors via the admin API.
  const records = loadRole() === 'founder'
    ? await portalList(MODULE, params)
        .catch(() => portalList(MODULE, { per_page: '200' }))
        .catch(() => [])
    : await zohoList(MODULE, params);
  return (records as Record<string, unknown>[]).map(fromRecord);
}

export async function createCRMDocument(
  fields: Omit<CRMDocumentFields, 'fileUrl'> & { fileUrl?: string; fileData?: string; fileName?: string; mimeType?: string },
): Promise<string> {
  const isFounder = loadRole() === 'founder';

  // ── Founder: upload file to Cloudinary, then portalCreate a submission that a
  //    Zoho workflow relays into My_Documents (portal can't write My_Documents).
  if (isFounder) {
    let fileUrl = fields.fileUrl || '';
    if (!fileUrl && fields.fileData && fields.fileName) {
      if (!canUploadFiles()) {
        throw new Error('File upload is not configured (Cloudinary). Cannot upload document.');
      }
      const blob = base64ToBlob(fields.fileData, fields.mimeType);
      fileUrl = await uploadFile(blob, fields.fileName);
    }
    const payload: Record<string, unknown> = {};
    for (const [appKey, crmKey] of Object.entries(FIELD_MAP)) {
      const val = appKey === 'fileUrl' ? fileUrl : (fields as Record<string, unknown>)[appKey];
      if (val !== undefined && val !== null && val !== '') payload[crmKey] = val;
    }
    return portalCreate(FOUNDER_SUBMIT_MODULE, payload);
  }

  // ── Investor: write My_Documents directly + attach the file.
  const payload: Record<string, unknown> = {};
  for (const [appKey, crmKey] of Object.entries(FIELD_MAP)) {
    const val = (fields as Record<string, unknown>)[appKey];
    if (val !== undefined && val !== null && val !== '') payload[crmKey] = val;
  }
  const recordId = await zohoCreate(MODULE, payload);
  if (fields.fileData && fields.fileName) {
    try {
      const blob = base64ToBlob(fields.fileData, fields.mimeType);
      await zohoUploadAttachment(MODULE, recordId, blob, fields.fileName);
    } catch (err) {
      console.warn('[crmDocuments] Attachment upload failed:', err);
    }
  }
  return recordId;
}

function base64ToBlob(fileData: string, mimeType?: string): Blob {
  const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  return new Blob([byteArr], { type: mimeType || 'application/octet-stream' });
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

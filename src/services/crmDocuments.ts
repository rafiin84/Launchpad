import { zohoList, zohoCreate, zohoDelete, portalDelete, zohoGetAttachments, zohoDownloadAttachment, portalList, zohoUploadFile, portalUploadFile, downloadFieldFile } from './zohoApi';
import { loadRole } from './oauth';
import { portalCreate } from './zohoApi';

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
  fileUploadId: string;   // file id stored in the File_Upload_1 field (file lives in Zoho)
  authorName: string;
  authorRole: string;
  createdTime: string;
}

export type CRMDocumentFields = Omit<CRMDocument, 'id' | 'createdTime'>;

const MODULE = 'My_Documents';
// Zoho File Upload field — stores the actual file IN Zoho CRM.
export const FILE_UPLOAD_FIELD = 'File_Upload_1';

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

const ALL_FIELDS = Object.values(FIELD_MAP).join(',') + ',' + FILE_UPLOAD_FIELD + ',Created_Time';

// A File Upload field reads back as an array of objects, but the admin CRM API
// and the portal API return DIFFERENT key names for the same data:
//   admin:  File_Id__s / File_Name__s   (capitalized, __s suffix)
//   portal: file_Id / file_Name         (no suffix, different casing)
// Checking only one shape meant the other silently fell back to an empty id,
// which looked like "no file attached" even though the file was there.
function parseFileUpload(v: unknown): { id: string; name: string } {
  const arr = Array.isArray(v) ? v : [];
  const f = arr[0] as Record<string, unknown> | undefined;
  if (!f) return { id: '', name: '' };
  const id = String(f['File_Id__s'] ?? f['file_Id'] ?? f['file_id'] ?? f['attachment_Id__s'] ?? f['attachment_Id'] ?? f['id'] ?? '');
  const name = String(f['File_Name__s'] ?? f['file_Name'] ?? f['file_name'] ?? f['name'] ?? '');
  return { id, name };
}

function fromRecord(r: Record<string, unknown>): CRMDocument {
  const s = (k: string) => String(r[k] ?? '');
  const fu = parseFileUpload(r[FILE_UPLOAD_FIELD]);
  return {
    id:             String(r.id),
    documentName:   s('Name'),
    documentType:   s('Document_Type'),
    relatedCompany: s('Related_Company'),
    description:    s('Document_Description'),
    visibility:     s('Visibility'),
    fileName:       fu.name || s('File_Name'),
    fileSize:       s('File_Size'),
    fileUrl:        s('File_URL'),
    fileUploadId:   fu.id,
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
  fields: Omit<CRMDocumentFields, 'fileUrl' | 'fileUploadId'> & { fileData?: string; fileName?: string; mimeType?: string },
): Promise<string> {
  const isFounder = loadRole() === 'founder';

  const payload: Record<string, unknown> = {};
  for (const [appKey, crmKey] of Object.entries(FIELD_MAP)) {
    const val = (fields as Record<string, unknown>)[appKey];
    if (val !== undefined && val !== null && val !== '') payload[crmKey] = val;
  }

  // Upload the file to Zoho (File Upload API) and reference it on the File Upload
  // field — this stores the file IN Zoho CRM. Founders use the portal domain,
  // investors the admin domain.
  if (fields.fileData && fields.fileName) {
    const blob = base64ToBlob(fields.fileData, fields.mimeType);
    const fileId = isFounder
      ? await portalUploadFile(blob, fields.fileName)
      : await zohoUploadFile(blob, fields.fileName);
    payload[FILE_UPLOAD_FIELD] = [{ file_id: fileId }];
  }

  return isFounder ? portalCreate(MODULE, payload) : zohoCreate(MODULE, payload);
}

function base64ToBlob(fileData: string, mimeType?: string): Blob {
  const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  return new Blob([byteArr], { type: mimeType || 'application/octet-stream' });
}

// Founders' portal tokens are rejected on the admin domain, so their delete
// must go through the portal-domain endpoint (portalDelete) instead of
// zohoDelete — Zoho's portal profile may still deny it outright, in which
// case the caller sees the real Zoho error rather than nothing happening.
export async function deleteCRMDocument(id: string): Promise<void> {
  return loadRole() === 'founder' ? portalDelete(MODULE, id) : zohoDelete(MODULE, id);
}

export async function fetchDocumentAttachments(
  recordId: string,
): Promise<Array<{ id: string; File_Name: string; Size: string }>> {
  return zohoGetAttachments(MODULE, recordId);
}

// Resolves any document to a viewable/downloadable URL, trying each storage
// mechanism the app has used over time: the Zoho File Upload field (current),
// a hosted share link (fileUrl), then the legacy Attachments API. Object URLs
// are marked revocable so callers can free them after use.
export async function resolveDocumentUrl(doc: CRMDocument): Promise<{ url: string; revoke: boolean }> {
  if (doc.fileUploadId) {
    const blob = await downloadFieldFile(MODULE, doc.id, FILE_UPLOAD_FIELD, doc.fileUploadId, loadRole() === 'founder');
    return { url: URL.createObjectURL(blob), revoke: true };
  }
  if (doc.fileUrl) {
    return { url: doc.fileUrl, revoke: false };
  }
  const attachments = await fetchDocumentAttachments(doc.id);
  if (attachments.length === 0) throw new Error('No file attached to this document.');
  const att = attachments[0];
  const blob = await zohoDownloadAttachment(MODULE, doc.id, att.id);
  if (!blob) throw new Error('Download failed.');
  return { url: URL.createObjectURL(blob), revoke: true };
}

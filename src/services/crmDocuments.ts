import { zohoList, zohoCreate, zohoDelete, zohoGetAttachments, zohoDownloadAttachment, portalList, zohoUploadFile, portalUploadFile, downloadFieldFile } from './zohoApi';
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

// A File Upload field reads back as an array of objects; pull the file id + name.
function parseFileUpload(v: unknown): { id: string; name: string } {
  const arr = Array.isArray(v) ? v : [];
  const f = arr[0] as Record<string, unknown> | undefined;
  if (!f) return { id: '', name: '' };
  const id = String(f['file_Id__s'] ?? f['file_id'] ?? f['attachment_Id__s'] ?? f['id'] ?? '');
  const name = String(f['file_name__s'] ?? f['file_name'] ?? f['name'] ?? '');
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

export async function deleteCRMDocument(id: string): Promise<void> {
  await zohoDelete(MODULE, id);
}

// Open / download the file stored in the File Upload field (lives in Zoho).
export async function openFileUploadField(doc: CRMDocument, download: boolean): Promise<void> {
  const blob = await downloadFieldFile(MODULE, doc.id, FILE_UPLOAD_FIELD, doc.fileUploadId, loadRole() === 'founder');
  if (!blob) throw new Error('File not available');
  const url = URL.createObjectURL(blob);
  if (download) {
    const a = document.createElement('a');
    a.href = url; a.download = doc.fileName || 'document';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } else {
    window.open(url, '_blank');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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

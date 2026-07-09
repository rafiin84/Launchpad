import { loadToken } from './oauth';

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

function authHeaders(): Record<string, string> {
  const token = loadToken();
  return token ? { 'Authorization': `Zoho-oauthtoken ${token}` } : {};
}

export async function fetchCRMDocuments(): Promise<CRMDocument[]> {
  const res = await fetch('/api/documents', { headers: authHeaders() });
  if (!res.ok) throw new Error(`Documents GET ${res.status}`);
  const json = await res.json() as { documents?: CRMDocument[] };
  return json.documents || [];
}

export async function createCRMDocument(
  fields: CRMDocumentFields & { fileData?: string; mimeType?: string },
): Promise<string> {
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Documents POST ${res.status}: ${body}`);
  }
  const json = await res.json() as { document?: { id: string } };
  if (!json.document?.id) throw new Error('No document id in response');
  return json.document.id;
}

export async function deleteCRMDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents?id=${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Documents DELETE ${res.status}`);
}

export async function fetchDocumentAttachments(
  recordId: string,
): Promise<Array<{ id: string; File_Name: string; Size: string }>> {
  const res = await fetch(`/api/documents?id=${recordId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Attachments GET ${res.status}`);
  const json = await res.json() as { data?: Array<{ id: string; File_Name: string; Size: string }> };
  return json.data || [];
}

export function getDownloadUrl(recordId: string, attachmentId: string): string {
  return `/api/documents?id=${recordId}&attachmentId=${attachmentId}`;
}

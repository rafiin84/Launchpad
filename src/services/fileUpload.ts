/**
 * fileUpload.ts
 *
 * Client-side file upload for portal (founder) users, who are blocked from the
 * Zoho CRM Attachments API. Uploads directly to Cloudinary using an UNSIGNED
 * upload preset — no server, no API secret exposed. Returns the hosted file URL,
 * which is then stored in the CRM record (Requested_Documents) so the investor
 * can open it.
 *
 * Requires CLOUDINARY config in src/config/auth.ts (or VITE_ env vars).
 */

import { CLOUDINARY, isCloudinaryConfigured } from '../config/auth';

export class FileUploadError extends Error {}

/** True when file upload is available (Cloudinary configured). */
export function canUploadFiles(): boolean {
  return isCloudinaryConfigured();
}

/**
 * Upload a file to Cloudinary and return its secure URL.
 * Uses the `auto` resource type so any file kind (pdf, image, zip…) works.
 */
export async function uploadFile(file: File): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new FileUploadError('File upload is not configured. Paste a share link instead.');
  }
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/auto/upload`;
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY.uploadPreset);

  const res = await fetch(url, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({})) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !json.secure_url) {
    throw new FileUploadError(json.error?.message || `Upload failed (HTTP ${res.status})`);
  }
  return json.secure_url;
}

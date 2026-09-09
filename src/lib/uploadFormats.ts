// ─────────────────────────────────────────────────────────────────────────────
//  What may be uploaded as a document, in one place.
//
//  The file input's `accept` attribute is only a hint — a browser lets anyone
//  switch the picker to "All files", and a drag-and-drop bypasses it entirely.
//  So the allowlist here is enforced on submit as well as advertised in the
//  picker, and both come from the same source.
// ─────────────────────────────────────────────────────────────────────────────

export interface FormatGroup {
  label: string;
  /** Lower-case extensions without the leading dot. */
  extensions: string[];
  why: string;
}

/**
 * Allowed formats, grouped by what founders actually send.
 *
 * Spreadsheets come first because they are the only formats the Finance Update
 * importer can read back into structured figures; everything else is a
 * supporting document a reviewer opens by eye.
 */
export const FORMAT_GROUPS: FormatGroup[] = [
  {
    label: 'Spreadsheets',
    // csv was missing before, which is what broke founder uploads of exports.
    // xlsm matters because accounting packages export macro-enabled workbooks
    // by default; ods for LibreOffice users.
    extensions: ['xlsx', 'xls', 'xlsm', 'csv', 'tsv', 'ods'],
    why: 'Readable by the Finance Update importer',
  },
  {
    label: 'Documents',
    extensions: ['pdf', 'doc', 'docx', 'rtf', 'txt'],
    why: 'Statements, reports and letters',
  },
  {
    label: 'Presentations',
    extensions: ['ppt', 'pptx'],
    why: 'Pitch decks and board packs',
  },
  {
    label: 'Scans & photos',
    // heic/heif is the iPhone default — without it an iPhone user simply
    // cannot upload a photo of a statement, which is a common way to send one.
    extensions: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'],
    why: 'Photographed or scanned statements',
  },
  {
    label: 'Archives',
    extensions: ['zip'],
    why: 'Several quarters sent together',
  },
];

export const ALLOWED_EXTENSIONS: string[] =
  FORMAT_GROUPS.flatMap(g => g.extensions);

/**
 * Formats refused on purpose, not by omission.
 *
 * Uploaded documents are downloaded and opened by investors, so a file that
 * can carry script is a stored-XSS vector against them: an .svg or .html
 * opened from disk executes in the browser with whatever it contains. Office
 * macros are a lesser worry — the file has to be opened and macros enabled —
 * but executables and scripts have no business here at all.
 */
export const BLOCKED_EXTENSIONS: string[] = [
  // Script-bearing markup — the XSS case
  'svg', 'html', 'htm', 'xhtml', 'xht', 'mhtml', 'xml', 'xsl',
  // Executables and scripts
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'sh', 'bash', 'zsh',
  'js', 'mjs', 'cjs', 'jar', 'app', 'dmg', 'pkg', 'deb', 'rpm',
  'vbs', 'wsf', 'hta', 'reg', 'dll', 'so', 'dylib',
  // Archives that commonly wrap the above and are not worth supporting
  '7z', 'rar', 'tar', 'gz', 'bz2', 'xz', 'iso',
];

/** The `accept` attribute for the file input. */
export const ACCEPT_ATTR: string =
  ALLOWED_EXTENSIONS.map(e => `.${e}`).join(',');

export const MIME_BY_EXTENSION: Record<string, string> = {
  // Spreadsheets
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  rtf: 'application/rtf',
  txt: 'text/plain',
  // Presentations
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  // Archives
  zip: 'application/zip',
};

/**
 * Upload ceiling.
 *
 * The serverless attachment endpoint accepts a 10MB request body, and the file
 * travels base64-encoded, which inflates it by about a third. So the real
 * ceiling is nearer 7MB — enforced here with a message that says so, rather
 * than letting a 9MB file fail with an opaque server error after the upload.
 */
export const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;

export function extensionOf(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? (parts.pop() as string).toLowerCase() : '';
}

export function isSpreadsheet(fileName: string): boolean {
  const ext = extensionOf(fileName);
  return FORMAT_GROUPS[0].extensions.includes(ext);
}

export function mimeFor(fileName: string): string {
  return MIME_BY_EXTENSION[extensionOf(fileName)] || 'application/octet-stream';
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * The real gate. Runs on whatever the user actually supplied — picker or
 * drag-and-drop — and explains a rejection in terms they can act on.
 */
export function validateUploadFile(file: File): ValidationResult {
  const ext = extensionOf(file.name);

  if (!ext) {
    return { ok: false, error: 'That file has no extension, so its type cannot be determined.' };
  }
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      error: `.${ext} files are not accepted — they can run code when opened. `
        + 'Please send a PDF, spreadsheet or image instead.',
    };
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      error: `.${ext} files are not supported. Accepted formats: `
        + `${ALLOWED_EXTENSIONS.map(e => e.toUpperCase()).join(', ')}.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, error: 'That file is empty.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `That file is ${formatBytes(file.size)}. The limit is `
        + `${formatBytes(MAX_UPLOAD_BYTES)} — try compressing it or splitting it up.`,
    };
  }
  return { ok: true };
}

/** Short human summary for the upload area, e.g. "XLSX, CSV, PDF, JPG…". */
export function acceptSummary(): string {
  return 'XLSX, XLS, CSV, PDF, DOC, DOCX, PPTX, JPG, PNG, HEIC, ZIP';
}

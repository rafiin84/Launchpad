import React, { useState, useRef } from 'react';
import {
  Upload, X, FileText, Check, Loader2, AlertCircle, Paperclip,
} from 'lucide-react';
import { createCRMDocumentFromFile, type CRMDocument } from '../../services/crmDocuments';
import {
  ACCEPT_ATTR, validateUploadFile, formatBytes, isSpreadsheet,
} from '../../lib/uploadFormats';
import type { Quarter } from '../../services/companyFinancials';
import { cn } from '../../lib/cn';

/**
 * Financial document upload for the Finance Update tab.
 *
 * Files are created as My_Documents records through the same service the
 * Documents page uses, so anything uploaded here shows up there too — one
 * record, not a copy. They are typed as financial statements and tagged with
 * the company and quarter, which is how the reviewer finds them later.
 */

const MAX_FILES = 5;
const CURRENT_YEAR = new Date().getFullYear();

interface Pending {
  file: File;
  /** Set when the file fails the allowlist or size check. */
  error?: string;
}

interface Uploaded {
  name: string;
  id: string;
}

export default function FinanceDocumentUpload({
  companyName, authorName, authorRole, onUploaded, compact = false,
}: {
  companyName: string;
  authorName: string;
  authorRole: string;
  /** Receives the created document ids so a quarter can cite them as sources. */
  onUploaded?: (docs: CRMDocument[]) => void;
  compact?: boolean;
}) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [quarter, setQuarter] = useState<Quarter | 0>(0);   // 0 = not quarter-specific
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<Uploaded[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const years = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 4 + i);
  const valid = pending.filter(p => !p.error);

  const addFiles = (files: FileList | File[]) => {
    setError('');
    const incoming = Array.from(files);
    const room = MAX_FILES - pending.length;
    if (room <= 0) {
      setError(`You can attach up to ${MAX_FILES} files at a time.`);
      return;
    }
    if (incoming.length > room) {
      setError(`Only the first ${room} file${room === 1 ? '' : 's'} were added — the limit is ${MAX_FILES}.`);
    }
    // Each file is checked here, so a drag-and-drop is gated exactly like the
    // picker. An invalid file is kept in the list with its reason rather than
    // silently dropped, so the person can see why it was refused.
    const checked: Pending[] = incoming.slice(0, room).map(file => {
      const result = validateUploadFile(file);
      return result.ok ? { file } : { file, error: result.error };
    });
    setPending(prev => [...prev, ...checked]);
  };

  const removeAt = (i: number) => setPending(prev => prev.filter((_, idx) => idx !== i));

  const upload = async () => {
    if (!valid.length) return;
    setUploading(true);
    setError('');
    const created: CRMDocument[] = [];
    const failures: string[] = [];

    // One at a time: each is its own CRM record plus a file upload, and a
    // failure part-way through should leave the earlier ones saved.
    for (const p of valid) {
      try {
        const label = quarter
          ? `Q${quarter} FY${year} — ${p.file.name}`
          : p.file.name;
        const doc = await createCRMDocumentFromFile({
          documentName: label,
          documentType: 'financial-statement',
          relatedCompany: companyName,
          description: quarter
            ? `Financial document for Q${quarter} FY${year}.`
            : `Financial document for FY${year}.`,
          visibility: '',
          authorName,
          authorRole,
        }, p.file);
        created.push(doc);
      } catch (err) {
        failures.push(`${p.file.name}: ${err instanceof Error ? err.message : 'upload failed'}`);
      }
    }

    setDone(prev => [...prev, ...created.map(d => ({ name: d.fileName || d.documentName, id: d.id }))]);
    setFailed(failures);
    setPending(created.length === valid.length ? [] : pending.filter(p => !!p.error));
    if (created.length) onUploaded?.(created);
    if (failures.length && !created.length) {
      setError('Nothing could be uploaded. Check your connection and try again.');
    }
    setUploading(false);
  };

  return (
    <div className={cn('bg-white border border-gray-100 rounded-2xl', compact ? 'p-4' : 'p-5')}>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Paperclip size={16} className="text-indigo-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-900">Attach financial documents</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
            Up to {MAX_FILES} files. These are saved to your Documents page as well,
            and the reviewer uses them to verify the figures.
          </p>
        </div>
      </div>

      {/* Period the files belong to */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          {years.map(y => <option key={y} value={y}>FY{y}</option>)}
        </select>
        <div className="flex gap-1">
          {([0, 1, 2, 3, 4] as const).map(q => (
            <button
              key={q}
              type="button"
              onClick={() => setQuarter(q)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                quarter === q ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {q === 0 ? 'Whole year' : `Q${q}`}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-indigo-300 transition-colors"
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || pending.length >= MAX_FILES}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
        >
          <Upload size={13} />
          {pending.length >= MAX_FILES ? `${MAX_FILES} files attached` : 'Choose files or drop them here'}
        </button>
        <p className="text-[10px] text-gray-400 mt-1">
          XLSX, CSV, PDF, DOC, images · up to 7 MB each · {MAX_FILES - pending.length} slot
          {MAX_FILES - pending.length === 1 ? '' : 's'} left
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={e => {
            const fs = e.target.files;
            e.target.value = '';
            if (fs?.length) addFiles(fs);
          }}
        />
      </div>

      {/* Queue */}
      {pending.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {pending.map((p, i) => (
            <div
              key={`${p.file.name}-${i}`}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl border',
                p.error ? 'border-red-100 bg-red-50' : 'border-gray-100 bg-gray-50',
              )}
            >
              <FileText size={13} className={p.error ? 'text-red-400' : 'text-gray-400'} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-gray-800 truncate">{p.file.name}</p>
                {p.error
                  ? <p className="text-[10px] text-red-600">{p.error}</p>
                  : <p className="text-[10px] text-gray-400">
                      {formatBytes(p.file.size)}
                      {isSpreadsheet(p.file.name) && ' · importable into the figures'}
                    </p>}
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={uploading}
                className="text-gray-300 hover:text-red-500 disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-600 font-medium mt-2.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {failed.length > 0 && (
        <div className="mt-2.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-900 mb-0.5">
            {failed.length} file{failed.length > 1 ? 's' : ''} could not be uploaded
          </p>
          {failed.map(f => <p key={f} className="text-[10px] text-amber-800">{f}</p>)}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-2.5 space-y-1">
          {done.map(d => (
            <p key={d.id} className="text-[11px] text-emerald-700 inline-flex items-center gap-1.5">
              <Check size={11} /> {d.name} uploaded
            </p>
          ))}
          <p className="text-[10px] text-gray-400 inline-flex items-center gap-1">
            <AlertCircle size={9} /> Also visible on your Documents page
          </p>
        </div>
      )}

      {valid.length > 0 && (
        <button
          type="button"
          onClick={upload}
          disabled={uploading}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gray-900 hover:bg-black disabled:opacity-50"
        >
          {uploading
            ? <><Loader2 size={13} className="animate-spin" /> Uploading {valid.length} file{valid.length > 1 ? 's' : ''}...</>
            : <><Upload size={13} /> Upload {valid.length} file{valid.length > 1 ? 's' : ''}</>}
        </button>
      )}
    </div>
  );
}

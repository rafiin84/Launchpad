import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Eye, FileText, Loader2, Lock, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { ModalFrame } from '../portfolio/portfolioUi';
import { fetchFieldPicklists, type PicklistOption } from '../../services/zohoApi';
import { DocumentViewerModal } from '../ui/DocumentViewerModal';
import { createCRMDocumentFromFile, fetchCRMDocuments, resolveDocumentUrl, type CRMDocument } from '../../services/crmDocuments';
import { formatDate } from '../../lib/portfolioFormat';
import type { TranslationKeys } from '../../i18n';

type T = TranslationKeys['companyDetail'];
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A company's documents, read from `My_Documents` by the company name(s) they are
 * tagged with. Which records come back is CRM's decision (profile + record
 * sharing). Investors additionally never see a document a founder marked private.
 * A founder sees their company's documents plus their own uploads, and can upload
 * — the file is saved to My_Documents tagged with their company, so it appears
 * on the investor's Documents tab straight away.
 */
export default function DocumentsTab({ companyNames, mode, authorName = '', locale, t }: {
  /** Every name the company is known by (investor record, founder profile). */
  companyNames: string[]; mode: 'investor' | 'founder'; authorName?: string; locale: string; t: T;
}) {
  const [docs, setDocs] = useState<CRMDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<CRMDocument | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const revoke = useRef(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [picklists, setPicklists] = useState<Record<string, PicklistOption[]> | null>(null);
  useEffect(() => { if (mode === 'founder') void fetchFieldPicklists('My_Documents', true).then(setPicklists); }, [mode]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const all = await fetchCRMDocuments();
      const forCompany = (d: CRMDocument) => companyNames.some(n => n && same(d.relatedCompany, n));
      setDocs(mode === 'founder'
        ? all.filter(d => forCompany(d) || (!!authorName && same(d.authorName, authorName)))
        : all.filter(d => forCompany(d) && !(d.visibility === 'private' && d.authorRole !== 'investor')));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [companyNames, mode, authorName, t.loadFailed]);
  useEffect(() => { void load(); }, [load]);

  async function open(doc: CRMDocument) {
    setViewer(doc); setUrl(null); setViewError(''); setViewLoading(true);
    try {
      const r = await resolveDocumentUrl(doc);
      revoke.current = r.revoke; setUrl(r.url);
    } catch (err) {
      setViewError(err instanceof Error && err.message ? err.message : t.docOpenFailed);
    } finally {
      setViewLoading(false);
    }
  }
  function close() { if (revoke.current && url) URL.revokeObjectURL(url); setViewer(null); setUrl(null); setViewError(''); }
  function download() {
    if (!url || !viewer) return;
    const a = document.createElement('a');
    a.href = url; a.download = viewer.fileName || 'document'; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  if (loading) return <div className="h-32 bg-white border border-gray-100 rounded-3xl animate-pulse" aria-busy="true" aria-label={t.loading} />;
  if (error) {
    return (
      <div role="alert" className="bg-red-50 border border-red-100 rounded-3xl p-6 text-center">
        <AlertCircle size={20} className="text-red-300 mx-auto mb-2" />
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-red-500 bg-red-100 px-3 py-1.5 rounded-lg"><RefreshCw size={12} /> {t.retry}</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-400">{mode === 'founder' ? t.docNoteFounder : t.docNote}</p>
        {mode === 'founder' && (companyNames[0]
          ? <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}><Plus size={13} className="mr-1.5" />{t.docUpload}</Button>
          : <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">{t.founderNeedProfile}</p>)}
      </div>
      {docs.length === 0 ? (
        <div className="text-center py-14 bg-white border border-gray-100 rounded-3xl">
          <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-300 inline-flex items-center justify-center mb-3"><FileText size={22} /></span>
          <p className="text-sm text-gray-500">{t.docEmpty}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map(d => (
            <li key={d.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-3xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <span className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-400 flex items-center justify-center flex-shrink-0"><FileText size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{d.documentName || d.fileName}</p>
                <p className="text-[11px] text-gray-400">{d.documentType}{d.fileSize ? ` · ${d.fileSize}` : ''}{d.visibility === 'private' && <span className="inline-flex items-center gap-0.5 ml-1.5"><Lock size={9} />{t.docPrivate}</span>}</p>
                <p className="text-[11px] text-gray-400">{t.docBy.replace('{name}', d.authorName || '—').replace('{date}', formatDate(d.createdTime, locale))}</p>
                {d.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{d.description}</p>}
              </div>
              <button onClick={() => void open(d)} className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:underline"><Eye size={13} />{t.docOpen}</button>
            </li>
          ))}
        </ul>
      )}
      {uploadOpen && (
        <UploadModal companyName={companyNames[0] ?? ''} authorName={authorName} picklists={picklists} t={t}
          onClose={() => setUploadOpen(false)} onDone={() => { setUploadOpen(false); void load(); }} />
      )}
      {viewer && (
        <DocumentViewerModal title={viewer.documentName || 'Document'} fileName={viewer.fileName} url={url} loading={viewLoading}
          error={viewError} previewable={/\.pdf$/i.test(viewer.fileName || '')} onClose={close} onDownload={download} />
      )}
    </div>
  );
}

/** The upload form. Type and visibility options are read from the CRM picklists; if those can't be read the form still works with what CRM accepts today. */
function UploadModal({ companyName, authorName, picklists, t, onClose, onDone }: {
  companyName: string; authorName: string; picklists: Record<string, PicklistOption[]> | null; t: T; onClose: () => void; onDone: () => void;
}) {
  const types = picklists?.['Document_Type'] ?? [{ actual: 'other', display: 'Other' }];
  const visibilities = picklists?.['Visibility'] ?? [{ actual: 'investors', display: 'Investors' }];
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState(types[types.length - 1]?.actual ?? '');
  const [visibility, setVisibility] = useState(visibilities.find(v => v.actual === 'investors')?.actual ?? visibilities[0]?.actual ?? '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError(t.docFileRequired); return; }
    setSaving(true); setError('');
    try {
      await createCRMDocumentFromFile({
        documentName: name.trim() || file.name, documentType: type, relatedCompany: companyName, description: description.trim(),
        visibility, authorName, authorRole: 'founder',
      }, file);
      onDone();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.docUploadFailed);
      setSaving(false);
    }
  }

  return (
    <ModalFrame title={t.docUpload} onClose={() => { if (!saving) onClose(); }}
      footer={<>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
        <Button type="submit" form="doc-upload-form" variant="primary" disabled={saving}>{saving ? <><Loader2 size={13} className="mr-1.5 animate-spin" />{t.saving}</> : t.docUploadAction}</Button>
      </>}>
      <form id="doc-upload-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.docFile} *</label>
          <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-xl file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
        </div>
        <Input label={t.docName} value={name} onChange={e => setName(e.target.value)} placeholder={file?.name ?? ''} />
        <div className="grid grid-cols-2 gap-3">
          <Select label={t.docType} value={type} onChange={e => setType(e.target.value)} options={types.map(o => ({ value: o.actual, label: o.display }))} />
          <Select label={t.docVisibility} value={visibility} onChange={e => setVisibility(e.target.value)} options={visibilities.map(o => ({ value: o.actual, label: o.display }))} />
        </div>
        <Textarea label={t.docDescription} value={description} onChange={e => setDescription(e.target.value)} rows={2} />
      </form>
    </ModalFrame>
  );
}

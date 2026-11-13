import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Eye, FileText, Lock, RefreshCw } from 'lucide-react';
import { DocumentViewerModal } from '../ui/DocumentViewerModal';
import { fetchCRMDocuments, resolveDocumentUrl, type CRMDocument } from '../../services/crmDocuments';
import { formatDate } from '../../lib/portfolioFormat';
import type { TranslationKeys } from '../../i18n';

type T = TranslationKeys['companyDetail'];
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The documents tagged to this company that the signed-in investor may see.
 * Which records come back is CRM's decision (profile + record sharing); on top
 * of that a document marked private by a founder is not shown here.
 */
export default function DocumentsTab({ companyName, locale, t }: { companyName: string; locale: string; t: T }) {
  const [docs, setDocs] = useState<CRMDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<CRMDocument | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const revoke = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const all = await fetchCRMDocuments();
      setDocs(all.filter(d => same(d.relatedCompany, companyName) && !(d.visibility === 'private' && d.authorRole !== 'investor')));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [companyName, t.loadFailed]);
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
      <p className="text-xs text-gray-400">{t.docNote}</p>
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
      {viewer && (
        <DocumentViewerModal title={viewer.documentName || 'Document'} fileName={viewer.fileName} url={url} loading={viewLoading}
          error={viewError} previewable={/\.pdf$/i.test(viewer.fileName || '')} onClose={close} onDownload={download} />
      )}
    </div>
  );
}

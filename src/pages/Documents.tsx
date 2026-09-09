import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Lock, File, FileSpreadsheet, Scale, Plus,
  Building2, Trash2, AlertCircle, RefreshCw, Download, User, Eye, Folder, FolderOpen, ChevronLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { DocumentViewerModal } from '../components/ui/DocumentViewerModal';
import { usePageTitle } from '../context/PageTitleContext';
import {
  fetchCRMDocuments, deleteCRMDocument, resolveDocumentUrl, type CRMDocument,
} from '../services/crmDocuments';
import { useAuth } from '../context/AuthContext';
import { fetchCRMPortfolio } from '../services/crmPortfolio';
import { cn } from '../lib/cn';
import { useLanguage } from '../context/LanguageContext';
import { loadUserName } from '../services/oauth';
import { fetchCompanyProfile } from '../services/companyProfile';

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  'pitch-deck':       { icon: File,           color: 'text-indigo-500 bg-indigo-50',   label: 'Pitch Deck' },
  'financial-model':  { icon: FileSpreadsheet, color: 'text-emerald-500 bg-emerald-50', label: 'Financial Model' },
  'legal-document':   { icon: Scale,           color: 'text-amber-500 bg-amber-50',    label: 'Legal Document' },
  'due-diligence':    { icon: FileText,        color: 'text-sky-500 bg-sky-50',        label: 'Due Diligence' },
  'other':            { icon: FileText,        color: 'text-gray-500 bg-gray-100',     label: 'Other' },
};

function normalizeType(t: string): string {
  if (!t) return 'other';
  const lower = t.toLowerCase().replace(/\s+/g, '-');
  if (lower in TYPE_META) return lower;
  return 'other';
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string, language: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

/** A company folder in the investor's document library. */
interface CompanyFolder {
  /** Display name; '' is the catch-all for documents with no company set. */
  name: string;
  docs: CRMDocument[];
  /** True when the company is in the portfolio but has no documents yet. */
  empty: boolean;
}

export default function Documents() {
  const { isFounder, isInvestor, founderCompanyName, currentUser } = useAuth();
  const { t, language } = useLanguage();
  const { setPageTitle } = usePageTitle();
  const [docs, setDocs] = useState<CRMDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  // Investors browse by company folder; null = the folder list itself.
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [folderQuery, setFolderQuery] = useState('');
  // Portfolio company names, so a company with no documents still gets a
  // folder rather than silently disappearing from the library.
  const [portfolioNames, setPortfolioNames] = useState<string[]>([]);
  const [viewerDoc, setViewerDoc] = useState<CRMDocument | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const viewerRevokeRef = useRef(false);
  // founderCompanyName from localStorage can be empty; resolve it reliably from
  // the company profile so the founder actually matches investor-uploaded docs.
  const [resolvedCompany, setResolvedCompany] = useState((founderCompanyName || '').trim().toLowerCase());

  const typeLabels: Record<string, string> = {
    'pitch-deck': t.addDocument.pitchDeck,
    'financial-model': t.addDocument.financialModel,
    'legal-document': t.addDocument.legalDocument,
    'due-diligence': t.addDocument.dueDiligence,
    'other': t.addDocument.other,
  };

  const load = () => {
    setLoading(true);
    setError('');
    fetchCRMDocuments()
      .then(setDocs)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setPageTitle(t.documentsPage.title, t.documentsPage.description); return () => setPageTitle(null); }, [t]);
  useEffect(() => { load(); }, []);

  // Resolve the founder's company name from their profile (localStorage may be empty).
  useEffect(() => {
    if (!isFounder) return;
    const email = currentUser?.email;
    if (!email) return;
    fetchCompanyProfile(email)
      .then(res => {
        const name = (res?.data?.name || '').trim().toLowerCase();
        if (name) setResolvedCompany(name);
      })
      .catch(() => {});
  }, [isFounder, currentUser?.email]);

  const myName = (loadUserName() || '').trim().toLowerCase();
  const myCompany = resolvedCompany || (founderCompanyName || '').trim().toLowerCase();
  // Visibility rules:
  //  - Investors see every document.
  //  - A founder sees only documents tied to THEIR OWN company: documents the
  //    investor uploaded for them (relatedCompany = their company) plus their own
  //    uploads. They never see other founders' documents or investor documents
  //    meant for a different company.
  const visibleDocs = isInvestor
    ? docs
    : docs.filter(d => {
        const isMine = !!myName && d.authorName?.trim().toLowerCase() === myName;
        const isForMyCompany = !!myCompany && d.relatedCompany?.trim().toLowerCase() === myCompany;
        return isMine || isForMyCompany;
      });

  // Company folders. Built from the documents themselves, then topped up with
  // every portfolio company so the library mirrors the portfolio rather than
  // only the companies that happen to have uploaded something.
  const folders: CompanyFolder[] = React.useMemo(() => {
    const byCompany = new Map<string, CRMDocument[]>();
    for (const d of visibleDocs) {
      const key = (d.relatedCompany || '').trim();
      byCompany.set(key, [...(byCompany.get(key) ?? []), d]);
    }
    // Match portfolio names case-insensitively so "R Company" and "R company"
    // do not become two folders.
    const seen = new Map<string, string>();
    for (const key of byCompany.keys()) {
      if (key) seen.set(key.toLowerCase(), key);
    }
    for (const name of portfolioNames) {
      const lower = name.trim().toLowerCase();
      if (lower && !seen.has(lower)) {
        seen.set(lower, name);
        byCompany.set(name, []);
      }
    }
    const named = [...byCompany.entries()]
      .filter(([name]) => name !== '')
      .map(([name, docs]) => ({ name, docs, empty: docs.length === 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const unfiled = byCompany.get('') ?? [];
    return unfiled.length
      ? [...named, { name: '', docs: unfiled, empty: false }]
      : named;
  }, [visibleDocs, portfolioNames]);

  const filteredFolders = folderQuery.trim()
    ? folders.filter(f =>
        (f.name || 'unfiled').toLowerCase().includes(folderQuery.trim().toLowerCase()))
    : folders;

  // Documents shown in the row list: everything for founders, or the open
  // folder's contents for investors.
  const listDocs = isInvestor && openFolder !== null
    ? (folders.find(f => f.name === openFolder)?.docs ?? [])
    : visibleDocs;

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await deleteCRMDocument(pendingDeleteId);
      setDocs(prev => prev.filter(d => d.id !== pendingDeleteId));
      setPendingDeleteId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!isInvestor) return;
    let cancelled = false;
    void fetchCRMPortfolio()
      .then(recs => {
        if (!cancelled) setPortfolioNames(recs.map(r => r.companyName).filter(Boolean));
      })
      .catch(() => { /* folders still work from the documents alone */ });
    return () => { cancelled = true; };
  }, [isInvestor]);

  const handleClearAll = async () => {
    // Scoped to what is actually on screen. Inside a company folder this must
    // delete that company's documents only — the button reads "Clear All (n)"
    // for the open folder, and deleting the whole library from there would be
    // a nasty surprise.
    const scope = listDocs;
    const where = isInvestor && openFolder !== null
      ? ` in ${openFolder || 'Unfiled'}`
      : '';
    if (!confirm(`Delete all ${scope.length} documents${where}? This cannot be undone.`)) return;
    setClearingAll(true);
    try {
      const targets = scope.map(d => d.id);
      const results = await Promise.allSettled(targets.map(id => deleteCRMDocument(id)));
      const deletedIds = new Set(targets.filter((_, i) => results[i]?.status === 'fulfilled'));
      setDocs(prev => prev.filter(d => !deletedIds.has(d.id)));
      const failed = targets.length - deletedIds.size;
      if (failed > 0) alert(`${failed} of ${targets.length} document(s) could not be deleted.`);
    } finally {
      setClearingAll(false);
    }
  };

  const closeViewer = () => {
    if (viewerRevokeRef.current && viewerUrl) URL.revokeObjectURL(viewerUrl);
    setViewerDoc(null);
    setViewerUrl(null);
    setViewerError('');
  };

  const handleView = async (doc: CRMDocument) => {
    setViewerDoc(doc);
    setViewerUrl(null);
    setViewerError('');
    setViewerLoading(true);
    try {
      const { url, revoke } = await resolveDocumentUrl(doc);
      viewerRevokeRef.current = revoke;
      setViewerUrl(url);
    } catch (err) {
      setViewerError(err instanceof Error ? err.message : 'Failed to open document. Please try again.');
    } finally {
      setViewerLoading(false);
    }
  };

  const handleDownload = async (doc: CRMDocument) => {
    setDownloading(doc.id);
    try {
      const { url, revoke } = await resolveDocumentUrl(doc);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || 'document';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (revoke) setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleViewerDownload = () => {
    if (!viewerDoc) return;
    handleDownload(viewerDoc);
  };

  const typeCounts = visibleDocs.reduce<Record<string, number>>((acc, d) => {
    const dt = normalizeType(d.documentType);
    acc[dt] = (acc[dt] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {pendingDeleteId !== null && (
        <DeleteConfirmModal
          title={t.documentsPage.deleteDocument}
          message={t.documentsPage.deleteConfirm}
          onConfirm={handleDelete}
          onCancel={() => setPendingDeleteId(null)}
          deleting={deleting}
        />
      )}

      {viewerDoc && (
        <DocumentViewerModal
          title={viewerDoc.documentName || 'Document'}
          fileName={viewerDoc.fileName}
          url={viewerUrl}
          loading={viewerLoading}
          error={viewerError}
          previewable={/\.pdf$/i.test(viewerDoc.fileName || '')}
          onClose={closeViewer}
          onDownload={handleViewerDownload}
        />
      )}

      <div className="flex items-center gap-3 mb-6 min-w-0">
        <div className="flex-1 min-w-0 flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5">
          <Lock size={14} className="text-gray-400 flex-shrink-0" />
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
            {isFounder
              ? t.documentsPage.founderSecurityNote
              : t.documentsPage.investorSecurityNote}
          </p>
        </div>
        <Link
          to="/documents/new"
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-black text-white px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors flex-shrink-0 whitespace-nowrap"
        >
          <Plus size={14} /> {t.documentsPage.upload}
        </Link>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const Icon = meta.icon;
          const count = typeCounts[type] ?? 0;
          return (
            <div key={type} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-all">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${meta.color}`}>
                <Icon size={20} />
              </div>
              <p className="text-sm font-semibold text-gray-900">{typeLabels[type] || meta.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{count} {count === 1 ? t.addPortfolio.documentSingular : t.addPortfolio.documentCount}</p>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-9 h-9 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={12} /> {t.documentsPage.retry}
          </button>
        </div>
      )}

      {!loading && !error && visibleDocs.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <FileText size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">{t.documentsPage.noDocuments}</p>
          <p className="text-xs text-gray-400 mb-4">
            {isFounder
              ? t.documentsPage.founderNoDocsDesc
              : t.documentsPage.investorNoDocsDesc}
          </p>
          <Link
            to="/documents/new"
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-black text-white px-3 py-1.5 rounded-lg"
          >
            <Plus size={12} /> {t.documentsPage.uploadDocument}
          </Link>
        </div>
      )}

      {/* ── Company folders (investor, top level) ── */}
      {!loading && !error && isInvestor && openFolder === null && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Companies <span className="text-xs font-medium text-gray-400">{filteredFolders.length}</span>
            </h2>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={folderQuery}
                onChange={e => setFolderQuery(e.target.value)}
                placeholder="Find a company..."
                className="w-56 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>
          </div>

          {filteredFolders.length === 0 ? (
            <div className="text-center py-14 border-2 border-dashed border-gray-100 rounded-2xl">
              <Folder size={26} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500 mb-1">
                {folderQuery ? 'No company matches that' : 'No companies yet'}
              </p>
              <p className="text-xs text-gray-400">
                {folderQuery
                  ? 'Try a different name.'
                  : 'Folders appear as companies join the portfolio or documents are uploaded.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredFolders.map(folder => (
                <button
                  key={folder.name || '__unfiled__'}
                  onClick={() => setOpenFolder(folder.name)}
                  className="text-left bg-white border border-gray-100 rounded-2xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all group"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors',
                    folder.empty ? 'bg-gray-50' : 'bg-indigo-50 group-hover:bg-indigo-100',
                  )}>
                    <Folder
                      size={18}
                      className={folder.empty ? 'text-gray-300' : 'text-indigo-600'}
                    />
                  </div>
                  <p className={cn('text-sm font-semibold truncate',
                    folder.name ? 'text-gray-900' : 'text-gray-500 italic')}>
                    {folder.name || 'Unfiled'}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {folder.docs.length === 0
                      ? 'No documents'
                      : `${folder.docs.length} document${folder.docs.length === 1 ? '' : 's'}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Document rows: a founder's own list, or an opened company folder ── */}
      {!loading && !error && listDocs.length > 0 && (!isInvestor || openFolder !== null) && (
        <div>
          {isInvestor && openFolder !== null && (
            <button
              onClick={() => setOpenFolder(null)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 mb-3"
            >
              <ChevronLeft size={14} /> All companies
            </button>
          )}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              {isInvestor && openFolder !== null && (
                <FolderOpen size={15} className="text-indigo-600" />
              )}
              {isInvestor && openFolder !== null
                ? (openFolder || 'Unfiled')
                : t.documentsPage.allDocuments} ({listDocs.length})
            </h2>
            {isInvestor && (
              <button
                onClick={handleClearAll}
                disabled={clearingAll}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={12} className={clearingAll ? 'animate-pulse' : ''} />
                {clearingAll ? 'Deleting...' : `Clear All (${listDocs.length})`}
              </button>
            )}
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {listDocs.map((doc, i) => {
              const typeKey = normalizeType(doc.documentType);
              const meta = TYPE_META[typeKey] ?? TYPE_META['other'];
              const Icon = meta.icon;
              const size = parseInt(doc.fileSize) || 0;
              return (
                <div
                  key={doc.id}
                  onClick={() => handleView(doc)}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors cursor-pointer ${i < listDocs.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{doc.documentName || '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{typeLabels[typeKey] || meta.label}</span>
                      {doc.fileName && (
                        <>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400">{doc.fileName}</span>
                        </>
                      )}
                      {size > 0 && (
                        <>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400">{formatBytes(size)}</span>
                        </>
                      )}
                      {doc.relatedCompany && (
                        <>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <Building2 size={10} /> {doc.relatedCompany}
                          </span>
                        </>
                      )}
                    </div>
                    {(doc.authorName || doc.createdTime) && (
                      <div className="flex items-center gap-2 mt-1">
                        {doc.authorName && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <User size={10} /> {doc.authorName}
                            {doc.authorRole && (
                              <span className={`ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                doc.authorRole === 'investor' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                              }`}>
                                {doc.authorRole === 'investor' ? t.login.investor : t.login.founder}
                              </span>
                            )}
                          </span>
                        )}
                        {doc.createdTime && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-400">{formatDate(doc.createdTime, language)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleView(doc)}
                      disabled={viewerLoading && viewerDoc?.id === doc.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                      title={t.documentsPage.view}
                    >
                      <Eye size={14} className={viewerLoading && viewerDoc?.id === doc.id ? 'animate-pulse' : ''} />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      title={t.documentsPage.download}
                    >
                      <Download size={14} className={downloading === doc.id ? 'animate-pulse' : ''} />
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(doc.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title={t.common.delete}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

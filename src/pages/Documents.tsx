import React, { useState, useEffect } from 'react';
import {
  FileText, Lock, File, FileSpreadsheet, Scale, Plus,
  Building2, Trash2, AlertCircle, RefreshCw, Download, User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import {
  fetchCRMDocuments, deleteCRMDocument, fetchDocumentAttachments,
  getDownloadUrl, type CRMDocument,
} from '../services/crmDocuments';
import { useAuth } from '../context/AuthContext';

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

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

export default function Documents() {
  const { isFounder, isInvestor } = useAuth();
  const [docs, setDocs] = useState<CRMDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    fetchCRMDocuments()
      .then(setDocs)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await deleteCRMDocument(pendingDeleteId);
      setDocs(prev => prev.filter(d => d.id !== pendingDeleteId));
    } catch { /* swallow */ }
    finally { setDeleting(false); setPendingDeleteId(null); }
  };

  const handleDownload = async (doc: CRMDocument) => {
    setDownloading(doc.id);
    try {
      const attachments = await fetchDocumentAttachments(doc.id);
      if (attachments.length === 0) {
        alert('No file attached to this document.');
        return;
      }
      const att = attachments[0];
      const url = getDownloadUrl(doc.id, att.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.File_Name || doc.fileName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      alert('Failed to download. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const typeCounts = docs.reduce<Record<string, number>>((acc, d) => {
    const t = normalizeType(d.documentType);
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {pendingDeleteId !== null && (
        <DeleteConfirmModal
          title="Delete Document"
          message="Are you sure you want to delete this document? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setPendingDeleteId(null)}
          deleting={deleting}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Documents"
          description="Secure document repository for your portfolio"
        />
        <Link
          to="/documents/new"
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-black text-white px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          <Plus size={14} /> Upload
        </Link>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Lock size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-600 leading-relaxed">
          {isFounder
            ? 'Documents you upload are shared with your investor. Your investor may also upload documents for you to review.'
            : 'Documents uploaded by founders are visible to you. Documents you upload are visible to all portal users.'}
        </p>
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
              <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{count} document{count !== 1 ? 's' : ''}</p>
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
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {!loading && !error && docs.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <FileText size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No documents yet</p>
          <p className="text-xs text-gray-400 mb-4">
            {isFounder
              ? 'Upload pitch decks, financials, or legal documents to share with your investor.'
              : 'Upload documents or wait for founders to share theirs.'}
          </p>
          <Link
            to="/documents/new"
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-black text-white px-3 py-1.5 rounded-lg"
          >
            <Plus size={12} /> Upload Document
          </Link>
        </div>
      )}

      {!loading && !error && docs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">All Documents ({docs.length})</h2>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {docs.map((doc, i) => {
              const typeKey = normalizeType(doc.documentType);
              const meta = TYPE_META[typeKey] ?? TYPE_META['other'];
              const Icon = meta.icon;
              const size = parseInt(doc.fileSize) || 0;
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors ${i < docs.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{doc.documentName || '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{meta.label}</span>
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
                                {doc.authorRole === 'investor' ? 'Investor' : 'Founder'}
                              </span>
                            )}
                          </span>
                        )}
                        {doc.createdTime && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-xs text-gray-400">{formatDate(doc.createdTime)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      title="Download"
                    >
                      <Download size={14} className={downloading === doc.id ? 'animate-pulse' : ''} />
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(doc.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
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

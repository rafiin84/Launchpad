import React, { useState, useEffect } from 'react';
import { FileText, Lock, File, FileSpreadsheet, Scale, Plus, Building2, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { getDocuments, deleteDocument, type StoredDocument } from '../services/store';

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  'pitch-deck':       { icon: File,          color: 'text-indigo-500 bg-indigo-50',  label: 'Pitch Deck' },
  'financial-model':  { icon: FileSpreadsheet,color: 'text-emerald-500 bg-emerald-50',label: 'Financial Model' },
  'legal-document':   { icon: Scale,          color: 'text-amber-500 bg-amber-50',   label: 'Legal Document' },
  'due-diligence':    { icon: FileText,       color: 'text-sky-500 bg-sky-50',       label: 'Due Diligence' },
  'other':            { icon: FileText,       color: 'text-gray-500 bg-gray-100',    label: 'Other' },
};

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function visibilityLabel(v: string) {
  if (v === 'shared-investors') return 'Shared with Investors';
  if (v === 'public-portfolio') return 'Public to Portfolio';
  return 'Private';
}

export default function Documents() {
  const [docs, setDocs] = useState<StoredDocument[]>([]);

  useEffect(() => {
    setDocs(getDocuments());
  }, []);

  const handleDelete = (id: string) => {
    deleteDocument(id);
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleOpen = (doc: StoredDocument) => {
    if (!doc.fileData) return;
    const [meta, base64] = doc.fileData.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
    const bytes = atob(base64);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    const blob = new Blob([buf], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Build category counts (stored + mock baselines)
  const mockCounts: Record<string, number> = {
    'pitch-deck': 3, 'financial-model': 2, 'legal-document': 5, 'due-diligence': 1, 'other': 0,
  };
  const storedCounts = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.type] = (acc[d.type] ?? 0) + 1;
    return acc;
  }, {});
  const allTypes = Object.keys(TYPE_META);

  return (
    <div className="max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <PageHeader
        title="Documents"
        description="Secure document repository for your portfolio"
        action={
          <Link to="/documents/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
            <Plus size={15} /> Upload Document
          </Link>
        }
      />

      {/* Privacy notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Lock size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-600 leading-relaxed">
          Documents are <strong>private by default</strong>. Pitch decks, financial models, and legal documents are visible only to authorized investors and the founder.
        </p>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {allTypes.map((type) => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          const count = (mockCounts[type] ?? 0) + (storedCounts[type] ?? 0);
          return (
            <div key={type} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-all cursor-pointer">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${meta.color}`}>
                <Icon size={20} />
              </div>
              <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{count} document{count !== 1 ? 's' : ''}</p>
            </div>
          );
        })}
      </div>

      {/* Uploaded documents list */}
      {docs.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Uploaded Documents ({docs.length})</h2>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {docs.map((doc, i) => {
              const meta = TYPE_META[doc.type] ?? TYPE_META['other'];
              const Icon = meta.icon;
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors ${i < docs.length - 1 ? 'border-b border-gray-50' : ''} ${doc.fileData ? 'cursor-pointer' : ''}`}
                  onClick={() => doc.fileData && handleOpen(doc)}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{doc.documentName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{meta.label}</span>
                      {doc.relatedCompany && (
                        <>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <Building2 size={10} /> {doc.relatedCompany}
                          </span>
                        </>
                      )}
                      {doc.fileName && (
                        <>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400">{doc.fileName} {doc.fileSize ? `(${formatBytes(doc.fileSize)})` : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${
                      doc.visibility === 'private' || !doc.visibility
                        ? 'bg-gray-100 text-gray-600'
                        : doc.visibility === 'shared-investors'
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {doc.visibility === 'private' || !doc.visibility ? <EyeOff size={10} /> : <Eye size={10} />}
                      {visibilityLabel(doc.visibility)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
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
      ) : (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <FileText size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No documents uploaded yet</p>
          <p className="text-xs text-gray-400 mb-4">Upload pitch decks, financial models, and legal documents.</p>
          <Link to="/documents/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
            <Plus size={14} /> Upload your first document
          </Link>
        </div>
      )}
    </div>
  );
}

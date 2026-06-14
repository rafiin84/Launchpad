import React from 'react';
import { FileText, Lock, Upload, File, FileSpreadsheet, Scale } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

const docTypes = [
  { type: 'pitch-deck', label: 'Pitch Decks', icon: File, color: 'text-indigo-500 bg-indigo-50', count: 3 },
  { type: 'financial-model', label: 'Financial Models', icon: FileSpreadsheet, color: 'text-emerald-500 bg-emerald-50', count: 2 },
  { type: 'legal', label: 'Legal Documents', icon: Scale, color: 'text-amber-500 bg-amber-50', count: 5 },
  { type: 'due-diligence', label: 'Due Diligence', icon: FileText, color: 'text-sky-500 bg-sky-50', count: 1 },
  { type: 'other', label: 'Other', icon: FileText, color: 'text-gray-500 bg-gray-100', count: 0 },
];

export default function Documents() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Documents"
        description="Secure document repository for your portfolio"
        action={<Button size="sm" icon={<Upload size={15} />}>Upload</Button>}
      />

      {/* Privacy notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Lock size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-600 leading-relaxed">
          Documents are <strong>private by default</strong>. Pitch decks, financial models, and legal documents are visible only to authorized investors and the founder. No other portfolio company can access your documents.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {docTypes.map((dt) => {
          const Icon = dt.icon;
          return (
            <div key={dt.type} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-all cursor-pointer">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${dt.color}`}>
                <Icon size={20} />
              </div>
              <p className="text-sm font-semibold text-gray-900">{dt.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{dt.count} document{dt.count !== 1 ? 's' : ''}</p>
            </div>
          );
        })}
      </div>

      <EmptyState
        icon={<FileText size={32} />}
        title="No documents uploaded yet"
        description="Upload pitch decks, financial models, and legal documents. All documents are private and secure."
        action={<Button icon={<Upload size={15} />}>Upload your first document</Button>}
      />
    </div>
  );
}

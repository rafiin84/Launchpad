import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, X } from 'lucide-react';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';
import { saveDocument } from '../services/store';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
const typeOptions = [
  { value: 'pitch-deck', label: 'Pitch Deck' },
  { value: 'financial-model', label: 'Financial Model' },
  { value: 'legal-document', label: 'Legal Document' },
  { value: 'due-diligence', label: 'Due Diligence' },
  { value: 'other', label: 'Other' },
];

const visibilityOptions = [
  { value: 'private', label: 'Private — only me' },
  { value: 'shared-investors', label: 'Shared with Investors' },
  { value: 'public-portfolio', label: 'Public to Portfolio' },
];

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
interface FormState {
  documentName: string;
  type: string;
  relatedCompany: string;
  description: string;
  visibility: string;
  fileName: string;
  fileSize: number;
  fileData: string;
}

const empty: FormState = {
  documentName: '', type: '', relatedCompany: '', description: '', visibility: '',
  fileName: '', fileSize: 0, fileData: '',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.documentName.trim()) e.documentName = 'Document name is required';
  if (!f.type) e.type = 'Document type is required';
  return e;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AddDocument() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = (e.target?.result as string) ?? '';
      setForm((prev) => ({ ...prev, fileName: file.name, fileSize: file.size, fileData }));
    };
    reader.readAsDataURL(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function clearFile() {
    setForm((prev) => ({ ...prev, fileName: '', fileSize: 0, fileData: '' }));
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    saveDocument(form);
    navigate('/documents');
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/documents" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Documents
        </Link>

        <PageHeader title="Upload Document" description="Add a document to your vault." />

        <form onSubmit={handleSubmit} noValidate>
          {/* Document Details */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Document Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Document Name *" value={form.documentName} onChange={set('documentName')} error={errors.documentName} placeholder="Q3 Financial Model" />
              <Select label="Type *" value={form.type} onChange={set('type')} options={typeOptions} placeholder="Select type" error={errors.type} />
              <Input label="Related Company" value={form.relatedCompany} onChange={set('relatedCompany')} placeholder="Company name this document belongs to" className="sm:col-span-2" />
              <Select label="Visibility" value={form.visibility} onChange={set('visibility')} options={visibilityOptions} placeholder="Select visibility" className="sm:col-span-2" />
            </div>
            <div className="mt-4">
              <Textarea label="Description" value={form.description} onChange={set('description')} placeholder="Brief description of what this document contains..." rows={3} />
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">File Upload</p>

            {form.fileName ? (
              <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl bg-gray-50">
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{form.fileName}</p>
                  <p className="text-xs text-gray-500">{formatBytes(form.fileSize)}</p>
                </div>
                <button type="button" onClick={clearFile} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'w-full border-2 border-dashed rounded-2xl px-6 py-12 flex flex-col items-center gap-3 transition-all',
                  isDragging
                    ? 'border-gray-400 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                )}
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX up to 50MB</p>
                </div>
              </button>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.doc" className="hidden" onChange={handleFileInput} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 pb-8">
            <Link to="/documents">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" variant="primary">Upload Document</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

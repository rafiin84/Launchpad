import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, X, Loader2 } from 'lucide-react';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';
import { createCRMDocument } from '../services/crmDocuments';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

interface FormState {
  documentName: string;
  type: string;
  relatedCompany: string;
  description: string;
  fileName: string;
  fileSize: number;
  fileData: string;
  mimeType: string;
}

const empty: FormState = {
  documentName: '', type: '', relatedCompany: '', description: '',
  fileName: '', fileSize: 0, fileData: '', mimeType: '',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function validate(f: FormState, t: any): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.documentName.trim()) e.documentName = t.addDocument.nameRequired;
  if (!f.type) e.type = t.addDocument.typeRequired;
  if (!f.fileName) e.file = t.addDocument.fileRequired;
  return e;
}

export default function AddDocument() {
  const navigate = useNavigate();
  const { currentUser, isInvestor } = useAuth();
  const { t } = useLanguage();

  const typeOptions = [
    { value: 'pitch-deck', label: t.addDocument.pitchDeck },
    { value: 'financial-model', label: t.addDocument.financialModel },
    { value: 'legal-document', label: t.addDocument.legalDocument },
    { value: 'due-diligence', label: t.addDocument.dueDiligence },
    { value: 'other', label: t.addDocument.other },
  ];
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = (e.target?.result as string) ?? '';
      setForm((prev) => ({
        ...prev,
        fileName: file.name,
        fileSize: file.size,
        fileData,
        mimeType: MIME_MAP[ext] || 'application/octet-stream',
      }));
      if (errors.file) setErrors((prev) => { const n = { ...prev }; delete n.file; return n; });
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
    setForm((prev) => ({ ...prev, fileName: '', fileSize: 0, fileData: '', mimeType: '' }));
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form, t);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      await createCRMDocument({
        documentName: form.documentName,
        documentType: form.type,
        relatedCompany: form.relatedCompany,
        description: form.description,
        visibility: isInvestor ? 'shared-all' : 'shared-investors',
        fileName: form.fileName,
        fileSize: String(form.fileSize),
        authorName: currentUser.name || 'Unknown',
        authorRole: isInvestor ? 'investor' : 'founder',
        fileData: form.fileData,
        mimeType: form.mimeType,
      });
      navigate('/documents');
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/documents" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t.addDocument.backToDocuments}
        </Link>

        <PageHeader title={t.addDocument.uploadDocument} description={t.addDocument.uploadDescription} />

        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">{t.addDocument.documentDetails}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={`${t.addDocument.documentName} *`} value={form.documentName} onChange={set('documentName')} error={errors.documentName} placeholder="Q3 Financial Model" />
              <Select label={`${t.addDocument.type} *`} value={form.type} onChange={set('type')} options={typeOptions} placeholder={t.addDocument.selectType} error={errors.type} />
              <Input label={t.addDocument.relatedCompany} value={form.relatedCompany} onChange={set('relatedCompany')} placeholder="Company name" className="sm:col-span-2" />
            </div>
            <div className="mt-4">
              <Textarea label={t.addDocument.description} value={form.description} onChange={set('description')} placeholder="Brief description of what this document contains..." rows={3} />
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">{t.addDocument.fileUpload}</p>

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
                  isDragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
                  errors.file ? 'border-red-300' : '',
                )}
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">{t.addDocument.clickToUpload}</p>
                  <p className="text-xs text-gray-400 mt-1">{t.addDocument.fileTypes}</p>
                </div>
              </button>
            )}
            {errors.file && <p className="text-xs text-red-500 mt-2">{errors.file}</p>}
            <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.doc" className="hidden" onChange={handleFileInput} />
          </div>

          {errors.submit && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 pb-8">
            <Link to="/documents">
              <Button type="button" variant="outline">{t.common.cancel}</Button>
            </Link>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t.addDocument.uploading}</span>
              ) : t.addDocument.uploadDocument}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Image, X, Tag, Building2, User, Send, Upload, Loader2 } from 'lucide-react';
import { getCRMActivity, updateCRMActivity, type CRMActivityFields } from '../services/crmActivities';
import { cn } from '../lib/cn';

const ACTIVITY_TYPES = [
  { value: 'win',          label: '🏆  Win',          bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { value: 'insight',      label: '💡  Insight',      bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  { value: 'update',       label: '📈  Update',       bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  { value: 'advice',       label: '💬  Advice',       bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  { value: 'introduction', label: '🤝  Introduction', bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
];

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else                { width  = Math.round((width  * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.75;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 28000 && quality > 0.1) { quality -= 0.1; dataUrl = canvas.toDataURL('image/jpeg', quality); }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src = objectUrl;
  });
}

interface FormState {
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  authorName: string;
  tags: string;
  imageUrl: string;
  imageData: string;
  imagePreview: string;
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5 normal-case"> *</span>}
      </label>
      {children}
    </div>
  );
}

export default function EditActivity() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm]         = useState<FormState>({ title: '', activityType: 'update', content: '', companyName: '', authorName: '', tags: '', imageUrl: '', imageData: '', imagePreview: '' });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [compressing, setCompressing] = useState(false);
  const [isDragging, setIsDragging]   = useState(false);

  useEffect(() => {
    if (!id) return;
    getCRMActivity(id)
      .then(activity => {
        const hasUploadedImage = activity.imageData?.startsWith('data:');
        setForm({
          title:        activity.title,
          activityType: activity.activityType || 'update',
          content:      activity.content,
          companyName:  activity.companyName,
          authorName:   activity.authorName,
          tags:         activity.tags,
          imageUrl:     activity.imageUrl || '',
          imageData:    activity.imageData || '',
          imagePreview: activity.imageData || activity.imageUrl || '',
        });
        if (activity.imageUrl && !hasUploadedImage) setImageMode('url');
        setLoading(false);
      })
      .catch(err => { setError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false); });
  }, [id]);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setForm(prev => ({ ...prev, imageData: compressed, imagePreview: compressed, imageUrl: '' }));
      setImageMode('upload');
    } catch {
      setError('Could not process image. Please try a different file.');
    } finally {
      setCompressing(false);
    }
  }

  function clearImage() {
    setForm(prev => ({ ...prev, imageData: '', imageUrl: '', imagePreview: '' }));
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.activityType) { setError('Please select an activity type.'); return; }
    if (!form.content.trim()) { setError('Content is required.'); return; }
    setError('');
    setSaving(true);
    try {
      const fields: CRMActivityFields = {
        title:        form.title.trim(),
        activityType: form.activityType,
        content:      form.content.trim(),
        companyName:  form.companyName.trim(),
        authorName:   form.authorName.trim(),
        tags:         form.tags.trim(),
        imageUrl:     imageMode === 'url' ? form.imageUrl.trim() : '',
        imageData:    imageMode === 'upload' ? form.imageData : '',
      };
      await updateCRMActivity(id!, fields);
      navigate(`/activities/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
      setSaving(false);
    }
  }

  const hasImage = !!(form.imagePreview || (imageMode === 'url' && form.imageUrl.startsWith('http')));

  if (loading) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto animate-pulse space-y-4">
      <div className="h-4 bg-gray-100 rounded w-32" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
    </div>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto">
        <Link to={`/activities/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft size={15} /> Back to Activity
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Edit Activity</h1>
          <p className="text-sm text-gray-500 mt-1">Update your activity post</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* Activity Type */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <p className="text-sm font-semibold text-gray-900 mb-4">Activity Type <span className="text-red-400">*</span></p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ACTIVITY_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, activityType: type.value }))}
                  className={cn(
                    'flex items-center justify-center p-3.5 rounded-xl border-2 text-sm font-medium transition-all',
                    form.activityType === type.value
                      ? `${type.border} ${type.bg} ${type.text}`
                      : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Details</p>
            <Field label="Title" required>
              <input type="text" value={form.title} onChange={set('title')} placeholder="Activity title" className={inputCls} />
            </Field>
            <Field label="Content" required>
              <textarea rows={5} value={form.content} onChange={set('content')}
                placeholder="Share the full story, context, or key takeaways..."
                className={inputCls + ' resize-none'} />
            </Field>
          </div>

          {/* Image */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Image size={15} className="text-gray-400" /> Image
                <span className="text-xs font-normal text-gray-400">(optional)</span>
              </p>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {(['upload', 'url'] as const).map(mode => (
                  <button key={mode} type="button"
                    onClick={() => { setImageMode(mode); clearImage(); }}
                    className={cn('text-xs font-medium px-3 py-1 rounded-md transition-all capitalize',
                      imageMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    )}
                  >
                    {mode === 'upload' ? 'Upload file' : 'Paste URL'}
                  </button>
                ))}
              </div>
            </div>

            {hasImage && (
              <div className="relative mb-4 rounded-xl overflow-hidden border border-gray-100">
                <img src={form.imagePreview || form.imageUrl} alt="preview" className="w-full max-h-60 object-cover" />
                <button type="button" onClick={clearImage}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors">
                  <X size={13} className="text-white" />
                </button>
              </div>
            )}

            {imageMode === 'upload' && !hasImage && (
              <button type="button" disabled={compressing}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleImageFile(f); }}
                className={cn(
                  'w-full border-2 border-dashed rounded-2xl px-6 py-10 flex flex-col items-center gap-3 transition-all',
                  isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
                  compressing && 'opacity-60 cursor-not-allowed'
                )}
              >
                <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                  {compressing
                    ? <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    : <Upload size={20} className="text-gray-400" />
                  }
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">{compressing ? 'Compressing image…' : 'Click to upload or drag & drop'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, GIF, WEBP — auto-compressed</p>
                </div>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />

            {imageMode === 'url' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Image URL</label>
                <input type="text" value={form.imageUrl}
                  onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value, imagePreview: e.target.value }))}
                  placeholder="https://example.com/image.png" className={inputCls} />
              </div>
            )}
          </div>

          {/* Additional Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Additional Info</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
                <Field label="Company Name">
                  <input type="text" value={form.companyName} onChange={set('companyName')} placeholder="e.g. Acme Inc" className={inputCls + ' pl-8'} />
                </Field>
              </div>
              <div className="relative">
                <User size={14} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
                <Field label="Author Name">
                  <input type="text" value={form.authorName} onChange={set('authorName')} placeholder="e.g. Sarah K." className={inputCls + ' pl-8'} />
                </Field>
              </div>
            </div>
            <div className="relative">
              <Tag size={14} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
              <Field label="Tags">
                <input type="text" value={form.tags} onChange={set('tags')} placeholder="fundraising, growth, product (comma-separated)" className={inputCls + ' pl-8'} />
              </Field>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-3 pb-8">
            <Link to={`/activities/${id}`}
              className="flex-1 text-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={saving || compressing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-60">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Send size={14} /> Save Changes</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

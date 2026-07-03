import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Image, X, Tag, Building2, User, Send, Upload,
} from 'lucide-react';
import { Input, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { type CRMActivityFields } from '../services/crmActivities';
import { postSharedActivity } from '../services/sharedActivities';
import { cn } from '../lib/cn';

// ─── Activity types (must match CRM picklist exact values) ────────────────────

const ACTIVITY_TYPES = [
  { value: 'win',          label: '🏆  Win',          bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { value: 'insight',      label: '💡  Insight',      bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  { value: 'update',       label: '📈  Update',       bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  { value: 'advice',       label: '💬  Advice',       bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  { value: 'introduction', label: '🤝  Introduction', bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
];

// ─── Canvas image compressor ──────────────────────────────────────────────────
// Resizes to max 600px wide/tall and reduces JPEG quality until base64 < 28000 chars

function extractYouTubeId(u: URL): string | null {
  if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
  if (!u.hostname.includes('youtube.com')) return null;
  if (u.searchParams.get('v')) return u.searchParams.get('v');
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'embed') return parts[1] || null;
  return null;
}

function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const ytId = extractYouTubeId(u);
    if (ytId) return `https://www.youtube.com/embed/${ytId}`;
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (u.hostname.includes('loom.com')) {
      const id = u.pathname.split('/').pop();
      if (id) return `https://www.loom.com/embed/${id}`;
    }
  } catch { /* not a valid URL */ }
  return null;
}

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
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Reduce quality until it fits within 28 000 chars (< 32 000 char CRM field)
      let quality = 0.75;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 28000 && quality > 0.1) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src = objectUrl;
  });
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  authorName: string;
  tags: string;
  imageUrl: string;    // URL mode — stored in Image_URL (website field, public URLs only)
  imageData: string;   // Upload mode — compressed base64 stored in Activity_Image_Data
  imagePreview: string;// local preview src (blob URL or same as imageData)
}

const empty = (name: string, companyName: string): FormState => ({
  title: '', activityType: '', content: '',
  companyName, authorName: name,
  tags: '', imageUrl: '', imageData: '', imagePreview: '',
});

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim())    e.title        = 'Title is required';
  if (!f.activityType)    e.activityType = 'Please select an activity type';
  if (!f.content.trim())  e.content      = 'Content is required';
  return e;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddActivity() {
  const navigate = useNavigate();
  const { currentUser, founderCompanyName, isInvestor } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(empty(currentUser.name, founderCompanyName));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [compressing, setCompressing] = useState(false);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  // ── Image upload ─────────────────────────────────────────────────────────

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setForm(prev => ({ ...prev, imageData: compressed, imagePreview: compressed, imageUrl: '' }));
    } catch {
      setSaveError('Could not process image. Please try a different file.');
    } finally {
      setCompressing(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  }

  function clearImage() {
    setForm(prev => ({ ...prev, imageData: '', imageUrl: '', imagePreview: '' }));
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setSaveError('');
    try {
      const fields: CRMActivityFields = {
        title:        form.title.trim(),
        activityType: form.activityType,
        content:      form.content.trim(),
        companyName:  form.companyName.trim(),
        authorName:   form.authorName.trim(),
        authorRole:   isInvestor ? 'investor' : 'founder',
        tags:         form.tags.trim(),
        imageUrl:     imageMode === 'url' ? form.imageUrl.trim() : '',
        imageData:    imageMode === 'upload' ? form.imageData : '',
      };
      const result = await postSharedActivity(fields);
      if (!result.synced) {
        setSaveError('Activity saved locally but failed to sync to CRM. Check your connection and try again.');
        setSaving(false);
        return;
      }
      navigate('/activities');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save activity');
      setSaving(false);
    }
  }

  const hasImage = !!(form.imagePreview || (imageMode === 'url' && form.imageUrl.startsWith('http')));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto">

        <Link to="/activities" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft size={15} /> Back to Activities
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Share an Activity</h1>
          <p className="text-sm text-gray-500 mt-1">Post a win, insight, update, or milestone with your network</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* ── Activity Type ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <p className="text-sm font-semibold text-gray-900 mb-4">
              Activity Type <span className="text-red-400">*</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ACTIVITY_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setForm(prev => ({ ...prev, activityType: type.value }));
                    setErrors(prev => { const n = { ...prev }; delete n.activityType; return n; });
                  }}
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
            {errors.activityType && <p className="text-xs text-red-500 mt-2">{errors.activityType}</p>}
          </div>

          {/* ── Core Details ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Details</p>
            <Input
              label="Title *"
              value={form.title}
              onChange={set('title')}
              error={errors.title}
              placeholder={
                form.activityType === 'win'          ? 'e.g. Closed our seed round at $2M' :
                form.activityType === 'insight'      ? 'e.g. Retention improved after pricing change' :
                form.activityType === 'update'       ? 'e.g. Launched v2.0 of our product' :
                form.activityType === 'advice'       ? 'e.g. How we reduced CAC by 40%' :
                form.activityType === 'introduction' ? 'e.g. Intro to Sarah at Acme Ventures' :
                'Activity title'
              }
            />
            <Textarea
              label="Content *"
              value={form.content}
              onChange={set('content')}
              error={errors.content}
              placeholder="Share the full story, context, or key takeaways..."
              rows={5}
            />
          </div>

          {/* ── Image ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Image size={15} className="text-gray-400" />
                Image <span className="text-xs font-normal text-gray-400">(optional)</span>
              </p>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {(['upload', 'url'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setImageMode(mode); clearImage(); }}
                    className={cn(
                      'text-xs font-medium px-3 py-1 rounded-md transition-all capitalize',
                      imageMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    )}
                  >
                    {mode === 'upload' ? 'Upload file' : 'Paste URL'}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {hasImage && (() => {
              const videoEmbed = imageMode === 'url' ? getVideoEmbedUrl(form.imageUrl) : null;
              return (
                <div className="relative mb-4 rounded-xl overflow-hidden border border-gray-100">
                  {videoEmbed ? (
                    <div className="aspect-video bg-black">
                      <iframe src={videoEmbed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  ) : (
                    <img src={form.imagePreview || form.imageUrl} alt="preview" className="w-full max-h-60 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X size={13} className="text-white" />
                  </button>
                </div>
              );
            })()}

            {/* Upload mode */}
            {imageMode === 'upload' && !hasImage && (
              <button
                type="button"
                disabled={compressing}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
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
                  <p className="text-sm font-medium text-gray-700">
                    {compressing ? 'Compressing image…' : 'Click to upload or drag & drop'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, GIF, WEBP — auto-compressed & saved</p>
                </div>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />

            {/* URL mode */}
            {imageMode === 'url' && (
              <Input
                label="Image URL"
                value={form.imageUrl}
                onChange={set('imageUrl')}
                placeholder="https://example.com/image.png"
              />
            )}
          </div>

          {/* ── Additional Info ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Additional Info</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
                <Input label="Company Name" value={form.companyName} onChange={set('companyName')} placeholder="e.g. Acme Inc" className="pl-8" />
              </div>
              <div className="relative">
                <User size={14} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
                <Input label="Author Name" value={form.authorName} onChange={set('authorName')} placeholder="e.g. Sarah K." className="pl-8" />
              </div>
            </div>
            <div className="relative">
              <Tag size={14} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
              <Input label="Tags" value={form.tags} onChange={set('tags')} placeholder="fundraising, growth, product  (comma-separated)" className="pl-8" />
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pb-8">
            <Link to="/activities"><Button type="button" variant="outline">Cancel</Button></Link>
            <Button type="submit" variant="primary" disabled={saving || compressing} icon={<Send size={14} />}>
              {saving ? 'Posting…' : 'Post Activity'}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}

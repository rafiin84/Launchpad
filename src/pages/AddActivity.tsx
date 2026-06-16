import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Image, X, Trophy, Lightbulb, TrendingUp,
  Bell, Megaphone, Tag, Building2, User, Send, Upload,
} from 'lucide-react';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { createCRMActivity, type CRMActivityFields } from '../services/crmActivities';
import { cn } from '../lib/cn';

// ─── Options ──────────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  { value: 'win',       label: '🏆  Win',       icon: Trophy,      bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { value: 'insight',   label: '💡  Insight',   icon: Lightbulb,   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  { value: 'update',    label: '📈  Update',    icon: TrendingUp,  bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  { value: 'advice',    label: '💬  Advice',    icon: Megaphone,   bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  { value: 'milestone', label: '🎯  Milestone', icon: Bell,        bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  { value: 'news',      label: '📰  News',      icon: Bell,        bg: 'bg-gray-100',   text: 'text-gray-700',    border: 'border-gray-200' },
];

const typeSelectOptions = ACTIVITY_TYPES.map(t => ({ value: t.value, label: t.label }));

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  authorName: string;
  tags: string;
  imageUrl: string;        // URL string stored in CRM
  imagePreview: string;    // local blob preview (not sent to CRM)
}

const empty = (name: string): FormState => ({
  title: '',
  activityType: '',
  content: '',
  companyName: '',
  authorName: name,
  tags: '',
  imageUrl: '',
  imagePreview: '',
});

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim())        e.title        = 'Title is required';
  if (!f.activityType)        e.activityType = 'Please select an activity type';
  if (!f.content.trim())      e.content      = 'Content is required';
  return e;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddActivity() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(empty(currentUser.name));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  // ── Image from file ──────────────────────────────────────────────────────

  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const preview = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string ?? '';
      setForm(prev => ({ ...prev, imagePreview: preview, imageUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
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
    if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
    setForm(prev => ({ ...prev, imageUrl: '', imagePreview: '' }));
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
        tags:         form.tags.trim(),
        imageUrl:     form.imageUrl,
      };
      await createCRMActivity(fields);
      navigate('/activities');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save activity');
      setSaving(false);
    }
  }

  const selectedType = ACTIVITY_TYPES.find(t => t.value === form.activityType);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto">

        {/* Back */}
        <Link
          to="/activities"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Activities
        </Link>

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Share an Activity</h1>
          <p className="text-sm text-gray-500 mt-1">Post a win, insight, update, or milestone with your network</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* ── Activity Type ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <p className="text-sm font-semibold text-gray-900 mb-4">Activity Type <span className="text-red-400">*</span></p>
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
                    'flex flex-col items-start gap-2 p-3.5 rounded-xl border-2 text-left transition-all',
                    form.activityType === type.value
                      ? `${type.border} ${type.bg}`
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <span className={cn('text-xs font-semibold', form.activityType === type.value ? type.text : 'text-gray-600')}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
            {errors.activityType && (
              <p className="text-xs text-red-500 mt-2">{errors.activityType}</p>
            )}
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
                selectedType?.value === 'win'       ? 'e.g. Closed our seed round at $2M' :
                selectedType?.value === 'insight'   ? 'e.g. Retention improved after pricing change' :
                selectedType?.value === 'update'    ? 'e.g. Launched v2.0 of our product' :
                selectedType?.value === 'advice'    ? 'e.g. How we reduced CAC by 40%' :
                selectedType?.value === 'milestone' ? 'e.g. Reached $100K ARR' :
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
                    onClick={() => setImageMode(mode)}
                    className={cn(
                      'text-xs font-medium px-3 py-1 rounded-md transition-all capitalize',
                      imageMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    )}
                  >
                    {mode === 'upload' ? 'Upload' : 'URL'}
                  </button>
                ))}
              </div>
            </div>

            {/* Image preview (both modes) */}
            {(form.imagePreview || (imageMode === 'url' && form.imageUrl && form.imageUrl.startsWith('http'))) && (
              <div className="relative mb-4 rounded-xl overflow-hidden">
                <img
                  src={form.imagePreview || form.imageUrl}
                  alt="preview"
                  className="w-full max-h-56 object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                >
                  <X size={13} className="text-white" />
                </button>
              </div>
            )}

            {imageMode === 'upload' ? (
              <>
                {!form.imagePreview && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={cn(
                      'w-full border-2 border-dashed rounded-2xl px-6 py-10 flex flex-col items-center gap-3 transition-all',
                      isDragging
                        ? 'border-gray-400 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                    )}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Upload size={20} className="text-gray-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">Click to upload or drag & drop</p>
                      <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, GIF, WEBP up to 10MB</p>
                    </div>
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </>
            ) : (
              <div>
                <Input
                  label="Image URL"
                  value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl}
                  onChange={(e) => setForm(prev => ({ ...prev, imageUrl: e.target.value, imagePreview: '' }))}
                  placeholder="https://example.com/image.png"
                />
              </div>
            )}
          </div>

          {/* ── Meta ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Additional Info</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
                <Input
                  label="Company Name"
                  value={form.companyName}
                  onChange={set('companyName')}
                  placeholder="e.g. Acme Inc"
                  className="pl-8"
                />
              </div>
              <div className="relative">
                <User size={14} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
                <Input
                  label="Author Name"
                  value={form.authorName}
                  onChange={set('authorName')}
                  placeholder="e.g. Sarah K."
                  className="pl-8"
                />
              </div>
            </div>

            <div className="relative">
              <Tag size={14} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
              <Input
                label="Tags"
                value={form.tags}
                onChange={set('tags')}
                placeholder="fundraising, growth, product  (comma-separated)"
                className="pl-8"
              />
              <p className="text-xs text-gray-400 mt-1.5">Separate tags with commas</p>
            </div>
          </div>

          {/* ── Error ── */}
          {saveError && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
              {saveError}
            </div>
          )}

          {/* ── Submit ── */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <Link to="/activities">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              icon={<Send size={14} />}
            >
              {saving ? 'Posting…' : 'Post Activity'}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}

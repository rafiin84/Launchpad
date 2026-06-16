import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Image, X } from 'lucide-react';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';

// ---------------------------------------------------------------------------
// ImageUpload (wide / rectangular)
// ---------------------------------------------------------------------------
interface ImageUploadProps {
  label?: string;
  value: string;
  onChange: (dataUrl: string) => void;
  onClear: () => void;
}

function ImageUpload({ label = 'Attach Image (Optional)', value, onChange, onClear }: ImageUploadProps) {
  const ref = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 mb-1.5">{label}</p>
      {value ? (
        <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200" style={{ aspectRatio: '16/9' }}>
          <img src={value} alt="Attached" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={cn(
            'w-full border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2',
            'hover:border-gray-400 hover:bg-gray-50 transition-all',
          )}
          style={{ aspectRatio: '16/9', minHeight: '140px' }}
        >
          <Image className="w-7 h-7 text-gray-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Click to attach an image</p>
            <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, GIF — 16:9 recommended</p>
          </div>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
const categoryOptions = [
  { value: 'general', label: 'General' },
  { value: 'ask-help', label: 'Ask for Help' },
  { value: 'share-resource', label: 'Share a Resource' },
  { value: 'win-milestone', label: 'Win / Milestone' },
  { value: 'announcement', label: 'Announcement' },
];

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
interface FormState {
  title: string;
  category: string;
  body: string;
  tags: string;
  image: string;
}

const empty: FormState = { title: '', category: '', body: '', tags: '', image: '' };

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = 'Title is required';
  if (!f.category) e.category = 'Category is required';
  if (!f.body.trim()) e.body = 'Body is required';
  return e;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AddDiscussion() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    console.log('AddDiscussion submit:', form);
    navigate('/discussions');
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/discussions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Discussions
        </Link>

        <PageHeader title="New Discussion" description="Start a conversation with the Launchpad community." />

        <form onSubmit={handleSubmit} noValidate>
          {/* Post Details */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">Post Details</p>
            <div className="grid grid-cols-1 gap-4">
              <Input
                label="Title *"
                value={form.title}
                onChange={set('title')}
                error={errors.title}
                placeholder="What's on your mind?"
              />
              <Select
                label="Category *"
                value={form.category}
                onChange={set('category')}
                options={categoryOptions}
                placeholder="Select a category"
                error={errors.category}
              />
              <Textarea
                label="Body *"
                value={form.body}
                onChange={set('body')}
                error={errors.body}
                placeholder="Share your thoughts, questions, or updates..."
                rows={8}
              />
              <Input
                label="Tags"
                value={form.tags}
                onChange={set('tags')}
                placeholder="fundraising, hiring, product — comma separated"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
            <ImageUpload
              value={form.image}
              onChange={(v) => setForm((p) => ({ ...p, image: v }))}
              onClear={() => setForm((p) => ({ ...p, image: '' }))}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 pb-8">
            <Link to="/discussions">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white focus:ring-indigo-200"
            >
              Post to Feed
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

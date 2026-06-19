import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, ExternalLink, Link2, Plus, Trash2, ArrowLeft, Camera, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { updateAppUser, uploadAppUserPhoto } from '../services/crmAppUsers';
import { saveUserName } from '../services/oauth';

const PROFILE_KEY = 'lp_profile_extra';

interface ProfileExtra {
  bio: string;
  location: string;
  twitter: string;
  linkedIn: string;
  expertise: string[];
}

function loadExtra(): ProfileExtra {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return { bio: '', location: '', twitter: '', linkedIn: '', expertise: [] };
}

function saveExtra(data: ProfileExtra) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
}

export default function EditProfile() {
  const { currentUser, appUserRecordId, refreshAvatar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileExtra>(loadExtra);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof ProfileExtra, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !form.expertise.includes(tag)) {
      setForm(prev => ({ ...prev, expertise: [...prev.expertise, tag] }));
    }
    setNewTag('');
  };

  const removeTag = (tag: string) =>
    setForm(prev => ({ ...prev, expertise: prev.expertise.filter(e => e !== tag) }));

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save locally
      saveExtra(form);

      // Sync to appusers CRM module
      if (appUserRecordId) {
        try {
          await updateAppUser(appUserRecordId, {
            bio: form.bio,
            location: form.location,
            linkedIn: form.linkedIn,
            twitter: form.twitter,
            expertise: form.expertise,
          });

          // Also update the user's display name in localStorage if changed
          if (currentUser.name) {
            saveUserName(currentUser.name);
          }
        } catch {
          // CRM update is best-effort
        }

        // Upload photo if selected
        if (photoFile) {
          setUploadingPhoto(true);
          try {
            await uploadAppUserPhoto(appUserRecordId, photoFile, photoFile.name || 'photo.jpg');
            refreshAvatar(); // re-fetch avatar from appusers
          } catch {
            // Photo upload is best-effort
          } finally {
            setUploadingPhoto(false);
          }
        }
      }

      navigate('/profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl px-4 sm:px-6 py-6 sm:py-8">

      {/* Back */}
      <button
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Profile
      </button>

      {/* Header with photo upload */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative group">
          <Avatar src={photoPreview || currentUser.avatar} name={currentUser.name} size="lg" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Camera size={16} className="text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">{currentUser.name}</p>
          {photoFile && (
            <p className="text-xs text-emerald-600 mt-0.5">New photo selected — will upload on save</p>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100">

        {/* Bio */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bio</label>
          <textarea
            rows={4}
            value={form.bio}
            onChange={e => set('bio', e.target.value)}
            placeholder="Tell others a bit about yourself…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
          />
        </div>

        {/* Location */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Location</label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="City, Country"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>

        {/* LinkedIn */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">LinkedIn URL</label>
          <div className="relative">
            <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="url"
              value={form.linkedIn}
              onChange={e => set('linkedIn', e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>

        {/* Twitter */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Twitter / X Handle</label>
          <div className="relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={form.twitter.replace('@', '')}
              onChange={e => set('twitter', e.target.value)}
              placeholder="yourhandle"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>

        {/* Skills */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Skills &amp; Expertise</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {form.expertise.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors ml-0.5">
                  <Trash2 size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add a skill and press Enter"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
            <button
              onClick={addTag}
              className="w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => navigate('/profile')}
          disabled={saving}
          className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || uploadingPhoto}
          className="flex-1 px-4 py-3 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {(saving || uploadingPhoto) && <Loader2 size={14} className="animate-spin" />}
          {uploadingPhoto ? 'Uploading Photo…' : saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

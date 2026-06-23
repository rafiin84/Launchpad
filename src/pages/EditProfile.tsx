import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, ExternalLink, Link2, Plus, Trash2, ArrowLeft, Camera, Loader2, User, ImagePlus, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { updateAppUser, uploadAppUserPhoto, loadCachedProfile, cacheProfileLocally } from '../services/crmAppUsers';
import { saveUserName } from '../services/oauth';
import { addNotification } from '../services/notifications';

interface ProfileForm {
  name: string;
  bio: string;
  location: string;
  twitter: string;
  linkedIn: string;
  expertise: string[];
}

function loadInitialForm(currentUserName: string, appUserData: Record<string, unknown> | null): ProfileForm {
  // Priority: appUser from CRM > locally cached profile > defaults
  const cached = loadCachedProfile();
  // Also read from old localStorage key for backwards compatibility
  let oldExtra: Partial<ProfileForm> = {};
  try {
    const raw = localStorage.getItem('lp_profile_extra');
    if (raw) oldExtra = JSON.parse(raw);
  } catch { /* ok */ }

  return {
    name:      (appUserData?.name as string) || cached?.name || currentUserName || '',
    bio:       (appUserData?.bio as string) || cached?.bio || (oldExtra.bio as string) || '',
    location:  (appUserData?.location as string) || cached?.location || (oldExtra.location as string) || '',
    twitter:   (appUserData?.twitter as string) || cached?.twitter || (oldExtra.twitter as string) || '',
    linkedIn:  (appUserData?.linkedIn as string) || cached?.linkedIn || (oldExtra.linkedIn as string) || '',
    expertise: (appUserData?.expertise as string[]) || cached?.expertise || (oldExtra.expertise as string[]) || [],
  };
}

export default function EditProfile() {
  const { currentUser, appUser, appUserRecordId, refreshAvatar, refreshAppUser, coverImage, setCoverImage, setProfileImage } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileForm>(() =>
    loadInitialForm(currentUser.name, appUser as unknown as Record<string, unknown> | null)
  );
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(coverImage || '');
  const [saveResult, setSaveResult] = useState<'success' | 'partial' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // If appUser loads after initial render, merge in CRM data
  useEffect(() => {
    if (appUser) {
      setForm(prev => ({
        name:      appUser.name || prev.name,
        bio:       appUser.bio || prev.bio,
        location:  appUser.location || prev.location,
        twitter:   appUser.twitter || prev.twitter,
        linkedIn:  appUser.linkedIn || prev.linkedIn,
        expertise: appUser.expertise.length > 0 ? appUser.expertise : prev.expertise,
      }));
    }
  }, [appUser]);

  const set = (field: keyof ProfileForm, val: string) =>
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

  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    // Also read as data URL for localStorage fallback
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverPreview('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      // Save display name to localStorage
      if (form.name.trim()) {
        saveUserName(form.name.trim());
      }

      // Always cache profile locally (works even without appusers module)
      cacheProfileLocally({
        name: form.name.trim(),
        bio: form.bio,
        location: form.location,
        linkedIn: form.linkedIn,
        twitter: form.twitter,
        expertise: form.expertise,
      });

      // Also update old localStorage key for Profile page backwards compatibility
      try {
        localStorage.setItem('lp_profile_extra', JSON.stringify({
          bio: form.bio,
          location: form.location,
          twitter: form.twitter,
          linkedIn: form.linkedIn,
          expertise: form.expertise,
        }));
      } catch { /* ok */ }

      let crmSuccess = true;

      // Sync to appusers CRM module if available
      if (appUserRecordId) {
        try {
          const updated = await updateAppUser(appUserRecordId, {
            name: form.name.trim(),
            bio: form.bio,
            location: form.location,
            linkedIn: form.linkedIn,
            twitter: form.twitter,
            expertise: form.expertise,
          });
          if (!updated) crmSuccess = false;
        } catch {
          crmSuccess = false;
        }

        // Upload photo if selected
        if (photoFile) {
          setUploadingPhoto(true);
          try {
            const uploaded = await uploadAppUserPhoto(appUserRecordId, photoFile, photoFile.name || 'photo.jpg');
            if (uploaded) {
              refreshAvatar(); // re-fetch avatar from appusers
            } else {
              // CRM upload failed — save locally as fallback
              if (photoDataUrl) setProfileImage(photoDataUrl);
              crmSuccess = false;
            }
          } catch {
            if (photoDataUrl) setProfileImage(photoDataUrl);
            crmSuccess = false;
          } finally {
            setUploadingPhoto(false);
          }
        }
      } else {
        crmSuccess = false;
        // No CRM record — save photo locally if selected
        if (photoFile && photoDataUrl) {
          setProfileImage(photoDataUrl);
        }
      }

      // Save cover image (localStorage-based)
      if (coverFile && coverPreview) {
        setCoverImage(coverPreview);
      } else if (!coverPreview && coverImage) {
        // User removed the cover image
        setCoverImage('');
      }

      setSaveResult(crmSuccess ? 'success' : 'partial');

      // Notify about profile update
      addNotification({
        type: 'profile_update',
        title: 'Profile Updated',
        message: `${form.name.trim() || 'User'} updated their profile.`,
        actor: form.name.trim() || 'User',
        actorRole: 'investor',
        link: '/profile',
      });
      window.dispatchEvent(new Event('notifications-updated'));

      // Refresh appUser in context so Profile page shows latest data
      refreshAppUser();

      // Navigate after a brief delay so user sees the result
      setTimeout(() => navigate('/profile'), 1000);
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
          <p className="text-sm text-gray-500 mt-0.5">{form.name || currentUser.name}</p>
          {photoFile && (
            <p className="text-xs text-emerald-600 mt-0.5">New photo selected — will upload on save</p>
          )}
        </div>
      </div>

      {/* Cover image upload */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cover Image</label>
        <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-gray-200 group">
          {coverPreview ? (
            <>
              <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => coverFileRef.current?.click()}
                  className="flex items-center gap-1 text-xs font-medium text-white bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg hover:bg-black/80 transition-colors"
                >
                  <ImagePlus size={12} /> Change
                </button>
                <button
                  type="button"
                  onClick={removeCover}
                  className="flex items-center gap-1 text-xs font-medium text-white bg-red-500/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X size={12} /> Remove
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => coverFileRef.current?.click()}
              className="w-full h-full bg-gray-50 hover:bg-gray-100 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
              <ImagePlus size={20} className="text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Click to upload a cover image</span>
            </button>
          )}
          <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
        </div>
        {coverFile && (
          <p className="text-xs text-emerald-600 mt-1.5">New cover image selected — will save on submit</p>
        )}
      </div>

      {/* Save result feedback */}
      {saveResult === 'success' && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
          Profile saved successfully!
        </div>
      )}
      {saveResult === 'partial' && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
          Profile saved locally. CRM sync will happen on next login.
        </div>
      )}

      {/* Form */}
      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100">

        {/* Display Name */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Display Name</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Your full name"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>

        {/* Bio */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bio</label>
          <textarea
            rows={4}
            value={form.bio}
            onChange={e => set('bio', e.target.value)}
            placeholder="Tell others a bit about yourself..."
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
          {uploadingPhoto ? 'Uploading Photo...' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, ExternalLink, Link2, Plus, Trash2, ArrowLeft, Camera, Loader2, User, ImagePlus, X,
  ZoomIn, ZoomOut, RotateCw, Move, Mail, Phone, Building2, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from '../components/ui/Avatar';
import { updateAppUser, uploadAppUserPhoto, deleteAppUserPhoto, loadCachedProfile, cacheProfileLocally, serverSaveCoverImage } from '../services/crmAppUsers';
import {
  fetchMyContactId, fetchMyFounderProfile, updateMyFounderProfile,
  uploadMyFounderPhoto, fetchMyFounderPhoto, deleteMyFounderPhoto,
  type CRMFounder,
} from '../services/crmFounders';
import { saveUserName } from '../services/oauth';
import { addNotification } from '../services/notifications';

interface ProfileForm {
  name: string;
  bio: string;
  location: string;
  twitter: string;
  linkedIn: string;
  expertise: string[];
  mobile: string;
  company: string;
}

function loadInitialForm(currentUserName: string, appUserData: Record<string, unknown> | null, fallbackMobile: string): ProfileForm {
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
    mobile:    (appUserData?.mobile as string) || cached?.mobile || fallbackMobile || '',
    company:   (appUserData?.company as string) || cached?.company || '',
  };
}

function validateInvestorForm(form: ProfileForm): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!form.name.trim()) errs.name = 'Display name is required.';
  if (!form.mobile.trim()) errs.mobile = 'Mobile number is required.';
  if (!form.company.trim()) errs.company = 'Company name is required.';
  return errs;
}

const CROP_SIZE = 256;

function ImageCropModal({ imageSrc, onConfirm, onCancel }: {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string, croppedBlob: Blob) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.src = imageSrc;
  }, [imageSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displaySize = canvas.clientWidth;
    canvas.width = displaySize * 2;
    canvas.height = displaySize * 2;
    const s = displaySize * 2;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    const aspect = img.width / img.height;
    let dw: number, dh: number;
    if (aspect > 1) {
      dh = s;
      dw = s * aspect;
    } else {
      dw = s;
      dh = s / aspect;
    }

    ctx.drawImage(img, -dw / 2 + offset.x * 2, -dh / 2 + offset.y * 2, dw, dh);
    ctx.restore();
  }, [zoom, rotation, offset, imgLoaded]);

  useEffect(() => { draw(); }, [draw]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: offsetStart.current.x + dx, y: offsetStart.current.y + dy });
  };

  const handlePointerUp = () => setDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.2, Math.min(5, z - e.deltaY * 0.002)));
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;

    const out = document.createElement('canvas');
    out.width = CROP_SIZE;
    out.height = CROP_SIZE;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.translate(CROP_SIZE / 2, CROP_SIZE / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    const aspect = img.width / img.height;
    let dw: number, dh: number;
    if (aspect > 1) {
      dh = CROP_SIZE;
      dw = CROP_SIZE * aspect;
    } else {
      dw = CROP_SIZE;
      dh = CROP_SIZE / aspect;
    }

    const scale = CROP_SIZE / (canvasRef.current?.clientWidth || CROP_SIZE);
    ctx.drawImage(img, -dw / 2 + offset.x * scale, -dh / 2 + offset.y * scale, dw, dh);
    ctx.restore();

    out.toBlob(blob => {
      if (!blob) return;
      onConfirm(out.toDataURL('image/jpeg', 0.92), blob);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-base font-semibold text-gray-900">{t.profile.adjustProfilePicture}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t.profile.adjustProfilePictureDesc}</p>
        </div>

        <div className="px-5">
          <div className="relative w-full aspect-square rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 cursor-move mx-auto max-w-[260px]">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <input
            type="range"
            min="0.2"
            max="5"
            step="0.05"
            value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className="flex-1 h-1.5 accent-black"
          />
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(5, z + 0.15))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="Rotate"
          >
            <RotateCw size={14} />
          </button>
          <button
            type="button"
            onClick={() => { setOffset({ x: 0, y: 0 }); setZoom(1); setRotation(0); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="Reset"
          >
            <Move size={14} />
          </button>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-xl transition-colors"
          >
            {t.profile.apply}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditProfile() {
  const { isFounder } = useAuth();
  return isFounder ? <FounderEditProfile /> : <InvestorEditProfile />;
}

function InvestorEditProfile() {
  const { currentUser, appUser, appUserRecordId, refreshAvatar, refreshAppUser, coverImage, setCoverImage, setProfileImage, zohoEmail, zohoProfile, portalSession, isFounder } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const userEmail = zohoEmail || portalSession?.email || currentUser.email || '';
  const isPortal = isFounder;

  const [form, setForm] = useState<ProfileForm>(() =>
    loadInitialForm(currentUser.name, appUser as unknown as Record<string, unknown> | null, zohoProfile.mobile || zohoProfile.phone || '')
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
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
        mobile:    appUser.mobile || prev.mobile,
        company:   appUser.company || prev.company,
      }));
    }
  }, [appUser]);

  const set = (field: keyof ProfileForm, val: string) => {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

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
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleCropConfirm = (croppedDataUrl: string, croppedBlob: Blob) => {
    setCropSrc(null);
    setPhotoDataUrl(croppedDataUrl);
    setPhotoPreview(croppedDataUrl);
    setPhotoFile(new File([croppedBlob], 'photo.jpg', { type: 'image/jpeg' }));
    setRemovePhoto(false);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoDataUrl('');
    setRemovePhoto(true);
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
    const errs = validateInvestorForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

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
        mobile: form.mobile.trim(),
        company: form.company.trim(),
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
      const canUseCrm = appUserRecordId || userEmail;

      // Sync to appusers CRM module if available
      if (canUseCrm) {
        try {
          const updated = await updateAppUser(appUserRecordId || '', {
            name: form.name.trim(),
            bio: form.bio,
            location: form.location,
            linkedIn: form.linkedIn,
            twitter: form.twitter,
            expertise: form.expertise,
            mobile: form.mobile.trim(),
            company: form.company.trim(),
          }, userEmail);
          if (!updated) crmSuccess = false;
        } catch {
          crmSuccess = false;
        }

        // Upload photo if selected
        if (photoFile) {
          setUploadingPhoto(true);
          try {
            const uploaded = await uploadAppUserPhoto(appUserRecordId || '', photoFile, photoFile.name || 'photo.jpg', userEmail);
            if (uploaded) {
              refreshAvatar();
            } else {
              if (photoDataUrl) setProfileImage(photoDataUrl);
              crmSuccess = false;
            }
          } catch {
            if (photoDataUrl) setProfileImage(photoDataUrl);
            crmSuccess = false;
          } finally {
            setUploadingPhoto(false);
          }
        } else if (removePhoto) {
          try {
            await deleteAppUserPhoto(appUserRecordId || '', userEmail);
            setProfileImage('');
            refreshAvatar();
          } catch { crmSuccess = false; }
        }
      } else {
        crmSuccess = false;
        if (photoFile && photoDataUrl) {
          setProfileImage(photoDataUrl);
        } else if (removePhoto) {
          setProfileImage('');
        }
      }

      // Save cover image to CRM and localStorage
      if (coverFile && coverPreview) {
        setCoverImage(coverPreview);
        if (userEmail) {
          try { await serverSaveCoverImage(userEmail, coverPreview); } catch { /* ok */ }
        }
      } else if (!coverPreview && coverImage) {
        setCoverImage('');
        if (userEmail) {
          try { await serverSaveCoverImage(userEmail, ''); } catch { /* ok */ }
        }
      }

      setSaveResult(crmSuccess ? 'success' : 'partial');

      // Notify about profile update
      const myRole = isPortal ? 'founder' : 'investor';
      const otherRole = isPortal ? 'investor' : 'founder';
      addNotification({
        type: 'profile_update',
        title: 'Profile Updated',
        message: `${form.name.trim() || 'User'} updated their profile.`,
        actor: form.name.trim() || 'User',
        actorRole: myRole,
        targetRole: otherRole,
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
        <ArrowLeft size={16} /> {t.profile.backToProfile}
      </button>

      {/* Header with photo upload */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative group">
          <Avatar src={removePhoto ? '' : (photoPreview || currentUser.avatar)} name={currentUser.name} size="lg" />
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
          <h1 className="text-xl font-bold text-gray-900">{t.profile.editProfile}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{form.name || currentUser.name}</p>
          {photoFile && (
            <p className="text-xs text-emerald-600 mt-0.5">{t.profile.newPhotoSelected}</p>
          )}
          {removePhoto && !photoFile && (
            <p className="text-xs text-red-500 mt-0.5">{t.profile.photoWillBeRemoved}</p>
          )}
          <div className="flex gap-2 mt-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs font-medium text-gray-600 hover:text-black transition-colors"
            >
              {currentUser.avatar || photoPreview ? t.profile.changePhoto : t.profile.uploadPhoto}
            </button>
            {(currentUser.avatar || photoPreview) && !removePhoto && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
              >
                {t.profile.removePhoto}
              </button>
            )}
            {removePhoto && !photoFile && (
              <button
                type="button"
                onClick={() => setRemovePhoto(false)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {t.profile.undoRemove}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Crop modal */}
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Cover image upload */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.coverImage}</label>
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
                  <ImagePlus size={12} /> {t.profile.change}
                </button>
                <button
                  type="button"
                  onClick={removeCover}
                  className="flex items-center gap-1 text-xs font-medium text-white bg-red-500/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X size={12} /> {t.common.remove}
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
              <span className="text-xs text-gray-500 font-medium">{t.profile.uploadCoverImage}</span>
            </button>
          )}
          <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
        </div>
        {coverFile && (
          <p className="text-xs text-emerald-600 mt-1.5">{t.profile.newCoverSelected}</p>
        )}
      </div>

      {/* Save result feedback */}
      {saveResult === 'success' && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
          {t.profile.savedSuccessfully}
        </div>
      )}
      {saveResult === 'partial' && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
          {t.profile.savedLocally}
        </div>
      )}

      {/* Form */}
      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100">

        {/* Display Name */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.displayName} *</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Your full name"
              className={`w-full border rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${errors.name ? 'border-red-300' : 'border-gray-200'}`}
            />
          </div>
          {errors.name && <p className="text-xs text-red-500 mt-1.5">{errors.name}</p>}
        </div>

        {/* Email (read-only — tied to your Zoho login, not editable here) */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.emailAddress}</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={userEmail}
              readOnly
              className="w-full border border-gray-100 bg-gray-50 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Mobile */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.mobileNumber} *</label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="tel"
              value={form.mobile}
              onChange={e => set('mobile', e.target.value)}
              placeholder="+1 555 000 0000"
              className={`w-full border rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${errors.mobile ? 'border-red-300' : 'border-gray-200'}`}
            />
          </div>
          {errors.mobile && <p className="text-xs text-red-500 mt-1.5">{errors.mobile}</p>}
        </div>

        {/* Company */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.companyName} *</label>
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={form.company}
              onChange={e => set('company', e.target.value)}
              placeholder="Your company"
              className={`w-full border rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${errors.company ? 'border-red-300' : 'border-gray-200'}`}
            />
          </div>
          {errors.company && <p className="text-xs text-red-500 mt-1.5">{errors.company}</p>}
        </div>

        {/* Bio */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.bio}</label>
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.location}</label>
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.linkedInUrl}</label>
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.twitterHandle}</label>
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.skillsExpertise}</label>
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
          {t.common.cancel}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || uploadingPhoto}
          className="flex-1 px-4 py-3 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {(saving || uploadingPhoto) && <Loader2 size={14} className="animate-spin" />}
          {uploadingPhoto ? t.profile.uploadingPhoto : saving ? t.profile.saving : t.profile.saveChanges}
        </button>
      </div>
    </div>
  );
}

// ─── Founder profile editor ────────────────────────────────────────────────
// Founders read/write their profile from the Contacts module directly (via
// their portal token — see crmFounders.ts), not the admin-only "appusers"
// module the investor form above uses.
interface FounderForm {
  displayName: string;
  email: string;
  mobile: string;
  company: string;
  bio: string;
  location: string;
  linkedIn: string;
  twitter: string;
  skills: string[];
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: '', lastName: parts[0] || '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function founderToForm(f: CRMFounder | null, fallbackName: string): FounderForm {
  return {
    displayName: f ? [f.firstName, f.lastName].filter(Boolean).join(' ') || fallbackName : fallbackName,
    email:       f?.email || '',
    mobile:      f?.mobile || '',
    company:     f?.company || '',
    bio:         f?.bio || '',
    location:    f?.location || '',
    linkedIn:    f?.linkedIn || '',
    twitter:     f?.twitter || '',
    skills:      f?.skills || [],
  };
}

function FounderEditProfile() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [contactId, setContactId] = useState<string | null>(null);
  const [form, setForm] = useState<FounderForm>(() => founderToForm(null, currentUser.name));
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | null>(null);

  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const id = await fetchMyContactId();
        if (cancelled) return;
        setContactId(id);
        if (id) {
          const [profile, photo] = await Promise.all([
            fetchMyFounderProfile(id),
            fetchMyFounderPhoto(id),
          ]);
          if (cancelled) return;
          setForm(founderToForm(profile, currentUser.name));
          if (photo) setCurrentPhotoUrl(photo);
        }
      } catch {
        setSaveError('Could not load your profile from CRM. Please refresh and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (field: keyof FounderForm, val: string) => {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !form.skills.includes(tag)) {
      setForm(prev => ({ ...prev, skills: [...prev.skills, tag] }));
    }
    setNewTag('');
  };

  const removeTag = (tag: string) =>
    setForm(prev => ({ ...prev, skills: prev.skills.filter(s => s !== tag) }));

  const [photoDataUrl, setPhotoDataUrl] = useState('');

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleCropConfirm = (croppedDataUrl: string, croppedBlob: Blob) => {
    setCropSrc(null);
    setPhotoDataUrl(croppedDataUrl);
    setPhotoPreview(croppedDataUrl);
    setPhotoFile(new File([croppedBlob], 'photo.jpg', { type: 'image/jpeg' }));
    setRemovePhoto(false);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoDataUrl('');
    setRemovePhoto(true);
  };

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.displayName.trim()) e.displayName = 'Display name is required.';
    if (!form.mobile.trim()) e.mobile = 'Mobile number is required.';
    if (!form.company.trim()) e.company = 'Company name is required.';
    return e;
  }

  const handleSave = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!contactId) {
      setSaveError('Could not find your Contact record in CRM — cannot save.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveResult(null);
    try {
      const { firstName, lastName } = splitDisplayName(form.displayName.trim());
      await updateMyFounderProfile(contactId, {
        firstName,
        lastName: lastName || form.displayName.trim(),
        // Email is the portal invite/login-identity field — Zoho rejects the
        // entire update with NOT_ALLOWED ("portal users cannot edit invited
        // field value") if it's included at all, so it's never sent here.
        mobile: form.mobile.trim(),
        company: form.company.trim(),
        bio: form.bio.trim(),
        location: form.location.trim(),
        linkedIn: form.linkedIn.trim(),
        twitter: form.twitter.trim().replace('@', ''),
        skills: form.skills,
      });

      if (photoFile) {
        await uploadMyFounderPhoto(contactId, photoFile, photoFile.name || 'photo.jpg');
        setCurrentPhotoUrl(photoDataUrl);
      } else if (removePhoto) {
        await deleteMyFounderPhoto(contactId);
        setCurrentPhotoUrl('');
      }

      saveUserName(form.displayName.trim());
      setSaveResult('success');

      addNotification({
        type: 'profile_update',
        title: 'Profile Updated',
        message: `${form.displayName.trim() || 'Founder'} updated their profile.`,
        actor: form.displayName.trim() || 'Founder',
        actorRole: 'founder',
        targetRole: 'investor',
        link: '/profile',
      });
      window.dispatchEvent(new Event('notifications-updated'));

      setTimeout(() => navigate('/profile'), 900);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl px-4 sm:px-6 py-10 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const displayedPhoto = removePhoto ? '' : (photoPreview || currentPhotoUrl || currentUser.avatar);

  return (
    <div className="max-w-2xl px-4 sm:px-6 py-6 sm:py-8">
      <button
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> {t.profile.backToProfile}
      </button>

      {/* Header with photo upload */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative group">
          <Avatar src={displayedPhoto} name={form.displayName || currentUser.name} size="lg" />
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
          <h1 className="text-xl font-bold text-gray-900">{t.profile.editProfile}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{form.displayName || currentUser.name}</p>
          {photoFile && <p className="text-xs text-emerald-600 mt-0.5">{t.profile.newPhotoSelected}</p>}
          {removePhoto && !photoFile && <p className="text-xs text-red-500 mt-0.5">{t.profile.photoWillBeRemoved}</p>}
          <div className="flex gap-2 mt-1.5">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-medium text-gray-600 hover:text-black transition-colors">
              {displayedPhoto ? t.profile.changePhoto : t.profile.uploadPhoto}
            </button>
            {displayedPhoto && !removePhoto && (
              <button type="button" onClick={handleRemovePhoto} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">
                {t.profile.removePhoto}
              </button>
            )}
            {removePhoto && !photoFile && (
              <button type="button" onClick={() => setRemovePhoto(false)} className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                {t.profile.undoRemove}
              </button>
            )}
          </div>
        </div>
      </div>

      {cropSrc && (
        <ImageCropModal imageSrc={cropSrc} onConfirm={handleCropConfirm} onCancel={() => setCropSrc(null)} />
      )}

      {saveResult === 'success' && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
          {t.profile.savedSuccessfully}
        </div>
      )}
      {saveError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 flex items-start gap-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> {saveError}
        </div>
      )}

      {/* Form */}
      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100">

        {/* Display Name */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.displayName} *</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={form.displayName}
              onChange={e => set('displayName', e.target.value)}
              placeholder="Your full name"
              className={`w-full border rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${errors.displayName ? 'border-red-300' : 'border-gray-200'}`}
            />
          </div>
          {errors.displayName && <p className="text-xs text-red-500 mt-1.5">{errors.displayName}</p>}
        </div>

        {/* Email (read-only — tied to your portal login, Zoho doesn't allow portal users to change it) */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.emailAddress}</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={form.email}
              readOnly
              className="w-full border border-gray-100 bg-gray-50 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Mobile */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.mobileNumber} *</label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="tel"
              value={form.mobile}
              onChange={e => set('mobile', e.target.value)}
              placeholder="+1 555 000 0000"
              className={`w-full border rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${errors.mobile ? 'border-red-300' : 'border-gray-200'}`}
            />
          </div>
          {errors.mobile && <p className="text-xs text-red-500 mt-1.5">{errors.mobile}</p>}
        </div>

        {/* Company */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.companyName} *</label>
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={form.company}
              onChange={e => set('company', e.target.value)}
              placeholder="Your company"
              className={`w-full border rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${errors.company ? 'border-red-300' : 'border-gray-200'}`}
            />
          </div>
          {errors.company && <p className="text-xs text-red-500 mt-1.5">{errors.company}</p>}
        </div>

        {/* Bio */}
        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.bio}</label>
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.location}</label>
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.linkedInUrl}</label>
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.twitterHandle}</label>
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t.profile.skillsExpertise}</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {form.skills.map(tag => (
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
          {t.common.cancel}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-3 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? t.profile.saving : t.profile.saveChanges}
        </button>
      </div>
    </div>
  );
}

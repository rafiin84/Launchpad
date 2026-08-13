import React, { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import {
  Activity, AlertCircle, RefreshCw, Building2,
  Image, X, Send, Link as LinkIcon,
  PlusCircle, DollarSign, FileText, Users, TrendingUp, MessageSquare, Upload, Clock,
  Sparkles, Trash2, Video, CirclePlay, MapPin, BarChart3, Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageTitle } from '../context/PageTitleContext';
import { Avatar } from '../components/ui/Avatar';
import {
  type CRMActivity, type CRMActivityFields, POLL_VOTE_TYPE,
  uploadActivityFile, resolveActivityFileUrl, type ActivityFileRef,
} from '../services/crmActivities';
import { fetchSharedActivities, postSharedActivity, syncUnsyncedActivities, fetchActivityPermissions, deleteSharedActivity, deleteAllSharedActivities } from '../services/sharedActivities';
import { loadToken } from '../services/oauth';
import { cn } from '../lib/cn';
import { generateAIActivities } from '../services/aiEngine';
import { fetchCRMPortfolio } from '../services/crmPortfolio';
import { fetchCRMDeals } from '../services/crmDeals';
import { addNotification } from '../services/notifications';
import { fetchCRMApplications } from '../services/crmApplications';
import { fetchCRMFounders } from '../services/crmFounders';
import { fetchAllCompanyProfiles, fetchCompanyProfile } from '../services/companyProfile';
import { DocumentViewerModal } from '../components/ui/DocumentViewerModal';
import { PollWidget, DocumentAttachmentCard, LocationCard, LinkCard, MediaAttachment } from '../components/activities/PostAttachments';

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  win:          { label: 'Win',          bg: 'bg-emerald-50', text: 'text-emerald-700' },
  advice:       { label: 'Advice',       bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  insight:      { label: 'Insight',      bg: 'bg-amber-50',   text: 'text-amber-700'  },
  update:       { label: 'Update',       bg: 'bg-sky-50',     text: 'text-sky-700'    },
  introduction: { label: 'Introduction', bg: 'bg-purple-50',  text: 'text-purple-700' },
};

const ACTIVITY_TYPES = [
  { value: 'win',          label: '🏆 Win' },
  { value: 'update',       label: '📈 Update' },
  { value: 'insight',      label: '💡 Insight' },
  { value: 'advice',       label: '💬 Advice' },
  { value: 'introduction', label: '🤝 Introduction' },
];

// ─── Image compressor (same as AddActivity) ───────────────────────────────────

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

function getVideoThumbnail(url: string): string | null {
  try {
    const u = new URL(url);
    const ytId = extractYouTubeId(u);
    if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  } catch { /* not a valid URL */ }
  return null;
}

// ─── Inline Composer ──────────────────────────────────────────────────────────

type AttachmentType = 'none' | 'photo' | 'video' | 'youtube' | 'document' | 'location' | 'poll' | 'link';

const ATTACHMENT_PICKS: { type: AttachmentType; icon: React.ElementType; label: string; bg: string }[] = [
  { type: 'photo',    icon: Image,     label: 'Photo',    bg: 'bg-emerald-500' },
  { type: 'video',    icon: Video,     label: 'Video',    bg: 'bg-red-500' },
  { type: 'youtube',  icon: CirclePlay, label: 'YouTube',  bg: 'bg-red-600' },
  { type: 'document', icon: FileText,  label: 'Document', bg: 'bg-orange-500' },
  { type: 'location', icon: MapPin,    label: 'Location', bg: 'bg-rose-500' },
  { type: 'poll',     icon: BarChart3, label: 'Poll',     bg: 'bg-indigo-600' },
  { type: 'link',     icon: LinkIcon,  label: 'Link',     bg: 'bg-violet-500' },
];

function isHttpUrl(s: string): boolean {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

function Composer({ onPost, onSyncWarning, postVisibility }: { onPost: (activity: CRMActivity) => void; onSyncWarning?: (msg: string) => void; postVisibility: string }) {
  const { currentUser, isInvestor, isFounder, founderCompanyName } = useAuth();
  const { t } = useLanguage();
  const photoFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const documentFileRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded]       = useState(false);
  const [title, setTitle]             = useState('');
  const [content, setContent]         = useState('');
  const [activityType, setActivityType] = useState('update');
  const [companyName, setCompanyName] = useState(founderCompanyName);
  const [posting, setPosting]         = useState(false);
  const [generating, setGenerating]   = useState(false);

  const [attachment, setAttachment]   = useState<AttachmentType>('none');
  const [showPicker, setShowPicker]   = useState(false);

  // Photo/Video/Document all share one upload path — the file is uploaded
  // straight to Zoho (uploadActivityFile) and its file_id is attached to the
  // activity's own record at create time (Activity_File_Upload), never to a
  // My_Documents record. mediaFileId is what actually gets sent along with
  // the post; mediaPreviewUrl is a local object URL for an instant preview
  // while the upload is in flight.
  const [mediaFile, setMediaFile]         = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
  const [mediaFileId, setMediaFileId]     = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError]       = useState('');

  // Photo can ALSO be a pasted external URL instead of an upload.
  const [imageMode, setImageMode]     = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl]       = useState('');

  // YouTube
  const [youtubeUrl, setYoutubeUrl]   = useState('');

  // Location
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState('');
  const [locating, setLocating] = useState(false);

  // Poll
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Link
  const [linkUrl, setLinkUrl] = useState('');

  // Keep in sync if founderCompanyName loads async
  useEffect(() => {
    if (founderCompanyName && !companyName) setCompanyName(founderCompanyName);
  }, [founderCompanyName]);

  function clearMedia() {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(null); setMediaPreviewUrl(''); setMediaFileId(null); setMediaError('');
    if (photoFileRef.current) photoFileRef.current.value = '';
    if (videoFileRef.current) videoFileRef.current.value = '';
    if (documentFileRef.current) documentFileRef.current.value = '';
  }

  function resetAttachment() {
    setAttachment('none');
    clearMedia();
    setImageMode('upload'); setImageUrl('');
    setYoutubeUrl('');
    setLocationName(''); setLocationCoords('');
    setPollQuestion(''); setPollOptions(['', '']);
    setLinkUrl('');
  }

  const attachmentValid = (() => {
    switch (attachment) {
      case 'photo':    return imageMode === 'url' ? isHttpUrl(imageUrl.trim()) : (!!mediaFileId && !mediaUploading);
      case 'video':    return !!mediaFileId && !mediaUploading;
      case 'youtube':  return !!getVideoEmbedUrl(youtubeUrl.trim());
      case 'document': return !!mediaFileId && !mediaUploading;
      case 'location': return !!locationName.trim();
      case 'poll':     return !!pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2;
      case 'link':     return isHttpUrl(linkUrl.trim());
      default:         return true;
    }
  })();

  const canPost = !!title.trim() && !!content.trim() && attachmentValid;

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      const [acts, portfolio, deals, apps, founders] = await Promise.all([
        fetchSharedActivities().catch(() => []),
        fetchCRMPortfolio().catch(() => []),
        fetchCRMDeals().catch(() => []),
        fetchCRMApplications().catch(() => []),
        fetchCRMFounders().catch(() => []),
      ]);
      const aiActs = generateAIActivities(portfolio, deals, apps, acts, founders, currentUser.name);
      if (aiActs.length > 0) {
        const picked = aiActs[0];
        setTitle(picked.title);
        setContent(picked.content);
        if (picked.activityType && ACTIVITY_TYPES.some(t => t.value === picked.activityType.toLowerCase())) {
          setActivityType(picked.activityType.toLowerCase());
        }
      }
    } catch {
      // silently fail — user can still type manually
    } finally {
      setGenerating(false);
    }
  }

  // Shared upload handler for Photo (upload mode)/Video/Document — all three
  // upload straight to Zoho and attach the resulting file_id to the
  // activity's own record (Activity_File_Upload) at post time, never to a
  // My_Documents record.
  async function handleMediaFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaError('');
    setMediaFileId(null);
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
    setMediaUploading(true);
    try {
      const fileId = await uploadActivityFile(file);
      setMediaFileId(fileId);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setMediaUploading(false);
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = `${pos.coords.latitude},${pos.coords.longitude}`;
        setLocationCoords(coords);
        if (!locationName.trim()) setLocationName(coords);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  function updatePollOption(i: number, val: string) {
    setPollOptions(prev => prev.map((o, idx) => (idx === i ? val : o)));
  }
  function addPollOption() {
    setPollOptions(prev => (prev.length >= 6 ? prev : [...prev, '']));
  }
  function removePollOption(i: number) {
    setPollOptions(prev => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function handleCancel() {
    setExpanded(false);
    setTitle(''); setContent(''); setActivityType('update');
    setCompanyName(founderCompanyName);
    resetAttachment();
    setShowPicker(false);
  }

  async function handlePost() {
    if (!canPost || posting) return;
    setPosting(true);
    try {
      const fields: CRMActivityFields = {
        title:        title.trim(),
        activityType,
        content:      content.trim(),
        companyName:  companyName.trim(),
        authorName:   currentUser.name,
        authorRole:   isInvestor ? 'investor' : 'founder',
        tags:         '',
        imageUrl: '', imageData: '',
        postType: attachment === 'none' ? '' : attachment,
        videoUrl: '', linkUrl: '', locationName: '', locationCoords: '', pollData: '', activityFileName: '', fileRef: '',
        visibility:   postVisibility,
      };

      let pendingFileId: string | undefined;

      if (attachment === 'photo') {
        if (imageMode === 'url') {
          fields.imageUrl = imageUrl.trim();
        } else if (mediaFileId && mediaFile) {
          pendingFileId = mediaFileId;
          fields.activityFileName = mediaFile.name;
        }
      } else if (attachment === 'video' && mediaFileId && mediaFile) {
        pendingFileId = mediaFileId;
        fields.activityFileName = mediaFile.name;
      } else if (attachment === 'youtube') {
        fields.videoUrl = youtubeUrl.trim();
      } else if (attachment === 'document' && mediaFileId && mediaFile) {
        pendingFileId = mediaFileId;
        fields.activityFileName = mediaFile.name;
      } else if (attachment === 'location') {
        fields.locationName = locationName.trim();
        fields.locationCoords = locationCoords.trim();
      } else if (attachment === 'poll') {
        fields.pollData = JSON.stringify({
          question: pollQuestion.trim(),
          options: pollOptions.map(o => o.trim()).filter(Boolean),
        });
      } else if (attachment === 'link') {
        fields.linkUrl = linkUrl.trim();
      }

      const activity = await postSharedActivity(fields, pendingFileId);

      const targetRole = isInvestor ? 'founder' : 'investor';
      addNotification({
        type: 'activity_post',
        title: `New Activity: ${title.trim()}`,
        message: `${currentUser.name} posted a new ${activityType} activity${companyName.trim() ? ` for ${companyName.trim()}` : ''}.`,
        actor: currentUser.name,
        actorRole: isInvestor ? 'investor' : 'founder',
        targetRole,
        link: `/activities/${activity.id}`,
      });
      window.dispatchEvent(new Event('notifications-updated'));

      onPost(activity);
      if (!activity.synced) {
        const detail = (activity as { error?: string }).error;
        onSyncWarning?.(`Post did not save to CRM${detail ? `: ${detail}` : ''}. Please sign in again if your session expired, or check portal permissions.`);
      }
      handleCancel();
    } finally { setPosting(false); }
  }

  // ── Collapsed ──
  if (!expanded) {
    return (
      <div
        className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 cursor-text hover:border-gray-200 transition-colors mb-4"
        onClick={() => setExpanded(true)}
      >
        <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
        <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-400 select-none">
          {t.activities.shareActivities}
        </div>
        <button
          onClick={e => { e.stopPropagation(); setExpanded(true); setShowPicker(true); }}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <Image size={18} />
        </button>
      </div>
    );
  }

  // ── Expanded ──
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-4">
      {/* Author */}
      <div className="flex items-center gap-3 mb-4">
        <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{currentUser.name}</p>
          <p className="text-xs text-gray-500 capitalize">{currentUser.role === 'investor' ? t.login.investor : t.login.founder}</p>
        </div>
      </div>

      {/* Company name */}
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={14} className="text-gray-300 flex-shrink-0" />
        <input
          type="text"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder={t.activities.companyName}
          className="text-xs text-gray-600 placeholder-gray-300 border-0 outline-none bg-transparent flex-1"
        />
      </div>

      {/* Activity type pills */}
      <div className="flex gap-2 flex-wrap mb-3">
        {(() => {
          const typeLabels: Record<string, string> = {
            win: `🏆 ${t.activities.win}`,
            update: `📈 ${t.activities.update}`,
            insight: `💡 ${t.activities.insight}`,
            advice: `💬 ${t.activities.advice}`,
            introduction: `🤝 ${t.activities.introduction}`,
          };
          return ACTIVITY_TYPES.map(at => (
            <button
              key={at.value}
              onClick={() => setActivityType(at.value)}
              className={cn(
                'text-xs font-medium px-3 py-1 rounded-full border transition-all',
                activityType === at.value
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
            >
              {typeLabels[at.value] || at.label}
            </button>
          ));
        })()}
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={t.activities.titlePlaceholder}
        className="w-full text-sm font-semibold text-gray-900 placeholder-gray-300 border-0 outline-none mb-1"
        autoFocus
      />

      {/* Content */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={isInvestor ? t.activities.investorPlaceholder : t.activities.founderPlaceholder}
        className="w-full text-sm text-gray-700 placeholder-gray-400 resize-none border-0 outline-none leading-relaxed min-h-[90px]"
      />

      {/* ── Attachment picker grid ── */}
      {showPicker && attachment === 'none' && (
        <div className="border border-gray-100 rounded-xl p-3 mb-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 mb-2.5">{t.activities.addToPost}</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {ATTACHMENT_PICKS.map(at => {
              const Icon = at.icon;
              return (
                <button
                  key={at.type}
                  type="button"
                  onClick={() => { setAttachment(at.type); setShowPicker(false); }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95', at.bg)}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">{at.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Per-attachment input + preview panel ── */}
      {attachment !== 'none' && (
        <div className="border border-gray-100 rounded-xl p-3 mb-3 bg-gray-50">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-semibold text-gray-600">
              {ATTACHMENT_PICKS.find(a => a.type === attachment)?.label}
            </p>
            <button type="button" onClick={resetAttachment} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          </div>

          {attachment === 'photo' && (
            <>
              <div className="flex gap-1 mb-2">
                {(['upload', 'url'] as const).map(m => (
                  <button key={m} onClick={() => setImageMode(m)}
                    className={cn('text-xs px-2 py-1 rounded-lg font-medium transition-all', imageMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
                    {m === 'upload' ? t.activities.upload : t.activities.url}
                  </button>
                ))}
              </div>
              {imageMode === 'upload' ? (
                mediaPreviewUrl ? (
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={mediaPreviewUrl} alt="preview" className="w-full max-h-56 object-cover" />
                    {mediaUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 size={20} className="animate-spin text-white" />
                      </div>
                    )}
                    <button onClick={clearMedia} className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center">
                      <X size={13} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => photoFileRef.current?.click()}
                    className="w-full border border-dashed border-gray-200 rounded-xl py-4 text-xs text-gray-400 hover:border-gray-400 hover:bg-white transition-all flex items-center justify-center gap-2">
                    <Image size={14} /> {t.activities.clickToUpload}
                  </button>
                )
              ) : (
                <>
                  <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.png"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black" />
                  {imageUrl.trim() && isHttpUrl(imageUrl.trim()) && (
                    <img src={imageUrl.trim()} alt="preview" className="w-full max-h-56 object-cover rounded-xl mt-2" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                </>
              )}
              <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={handleMediaFileSelect} />
              {mediaError && <p className="text-xs text-red-500 mt-1.5">{mediaError}</p>}
            </>
          )}

          {attachment === 'video' && (
            <>
              {mediaPreviewUrl ? (
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video src={mediaPreviewUrl} controls className="w-full max-h-56" />
                  {mediaUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                  )}
                  <button onClick={clearMedia} className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center">
                    <X size={13} className="text-white" />
                  </button>
                </div>
              ) : (
                <button onClick={() => videoFileRef.current?.click()}
                  className="w-full border border-dashed border-gray-200 rounded-xl py-4 text-xs text-gray-400 hover:border-gray-400 hover:bg-white transition-all flex items-center justify-center gap-2">
                  <Video size={14} /> {t.activities.clickToUpload}
                </button>
              )}
              <input ref={videoFileRef} type="file" accept="video/*" className="hidden" onChange={handleMediaFileSelect} />
              {mediaError && <p className="text-xs text-red-500 mt-1.5">{mediaError}</p>}
            </>
          )}

          {attachment === 'youtube' && (
            <>
              <input
                type="text"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black"
              />
              {(() => {
                const embed = getVideoEmbedUrl(youtubeUrl.trim());
                if (!embed) return null;
                return (
                  <div className="aspect-video bg-black rounded-xl overflow-hidden mt-2">
                    <iframe src={embed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                );
              })()}
              {youtubeUrl.trim() && !getVideoEmbedUrl(youtubeUrl.trim()) && (
                <p className="text-xs text-red-500 mt-1.5">That doesn't look like a YouTube link.</p>
              )}
            </>
          )}

          {attachment === 'document' && (
            <>
              {mediaFile ? (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                    {mediaUploading ? <Loader2 size={14} className="text-orange-500 animate-spin" /> : <FileText size={14} className="text-orange-500" />}
                  </div>
                  <span className="text-xs font-medium text-gray-700 truncate flex-1">{mediaFile.name}</span>
                  <button onClick={clearMedia} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button onClick={() => documentFileRef.current?.click()}
                  className="w-full border border-dashed border-gray-200 rounded-xl py-4 text-xs text-gray-400 hover:border-gray-400 hover:bg-white transition-all flex items-center justify-center gap-2">
                  <FileText size={14} /> {t.activities.clickToUpload}
                </button>
              )}
              <input ref={documentFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.zip" className="hidden" onChange={handleMediaFileSelect} />
              {mediaError && <p className="text-xs text-red-500 mt-1.5">{mediaError}</p>}
            </>
          )}

          {attachment === 'location' && (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationName}
                  onChange={e => setLocationName(e.target.value)}
                  placeholder="Address or place name"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors disabled:opacity-50"
                >
                  {locating ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                  {t.activities.useMyLocation}
                </button>
              </div>
              {locationName.trim() && <div className="mt-2"><LocationCard name={locationName.trim()} coords={locationCoords} /></div>}
            </>
          )}

          {attachment === 'poll' && (
            <div className="space-y-2">
              <input
                type="text"
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                placeholder={t.activities.pollQuestion}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
              />
              <div className="space-y-1.5">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={opt}
                      onChange={e => updatePollOption(i, e.target.value)}
                      placeholder={`${t.activities.pollOption} ${i + 1}`}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    {pollOptions.length > 2 && (
                      <button type="button" onClick={() => removePollOption(i)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {pollOptions.length < 6 && (
                <button type="button" onClick={addPollOption} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                  <PlusCircle size={12} /> {t.activities.addOption}
                </button>
              )}
            </div>
          )}

          {attachment === 'link' && (
            <>
              <input
                type="text"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black"
              />
              {linkUrl.trim() && isHttpUrl(linkUrl.trim()) && <div className="mt-2"><LinkCard url={linkUrl.trim()} /></div>}
              {linkUrl.trim() && !isHttpUrl(linkUrl.trim()) && <p className="text-xs text-red-500 mt-1.5">Enter a full link starting with https://</p>}
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPicker(v => !v)}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors',
              showPicker || attachment !== 'none' ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-50')}
          >
            <PlusCircle size={15} /> {t.activities.addToPost}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-500 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-700 disabled:opacity-60 transition-all shadow-sm"
          >
            {generating ? (
              <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t.activities.generating}</>
            ) : (
              <><Sparkles size={13} /> {t.activities.generateWithAI}</>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
            {t.common.cancel}
          </button>
          <button
            onClick={handlePost}
            disabled={!canPost || posting}
            className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send size={14} /> {posting ? t.activities.posting : t.activities.post}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ' at ' + formatTime(iso);
}

function getDateGroupKey(iso: string): 'today' | 'yesterday' | 'earlier' {
  if (!iso) return 'earlier';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'earlier';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const actDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (actDate.getTime() === today.getTime()) return 'today';
  if (actDate.getTime() === yesterday.getTime()) return 'yesterday';
  return 'earlier';
}

function groupAndSort(activities: CRMActivity[]): { key: string; items: CRMActivity[] }[] {
  const sorted = [...activities].sort((a, b) => {
    const ta = a.createdTime ? new Date(a.createdTime).getTime() : 0;
    const tb = b.createdTime ? new Date(b.createdTime).getTime() : 0;
    return tb - ta;
  });
  const groups: { key: string; items: CRMActivity[] }[] = [];
  const order = ['today', 'yesterday', 'earlier'];
  const map = new Map<string, CRMActivity[]>();
  for (const a of sorted) {
    const g = getDateGroupKey(a.createdTime);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(a);
  }
  for (const key of order) {
    const items = map.get(key);
    if (items?.length) groups.push({ key, items });
  }
  return groups;
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ activity, onDelete, companyLogos, allActivities, onOpenDocument }: {
  activity: CRMActivity;
  onDelete?: (id: string) => void;
  companyLogos?: Record<string, string>;
  allActivities: CRMActivity[];
  onOpenDocument: (ref: ActivityFileRef, fileName: string) => void;
}) {
  const { currentUser, founderCompanyName, isInvestor } = useAuth();
  const { t } = useLanguage();
  const isOwnPost = currentUser.name.trim().toLowerCase() === activity.authorName?.trim().toLowerCase();
  const canDelete = isOwnPost || isInvestor;
  const [deleting, setDeleting] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const displayCompany = activity.companyName || (isOwnPost ? founderCompanyName : '') || activity.authorName || 'General';
  const companyLogo = companyLogos?.[displayCompany.trim().toLowerCase()];
  const LIMIT = 220;
  const isLong = activity.content.length > LIMIT;
  const display = isLong ? activity.content.slice(0, LIMIT) : activity.content;
  const tags = activity.tags ? activity.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
  const cfg = TYPE_CONFIG[activity.activityType?.toLowerCase()] ?? { label: activity.activityType || 'Activity', bg: 'bg-gray-100', text: 'text-gray-600' };
  const activityTypeLabels: Record<string, string> = {
    win: t.activities.win, advice: t.activities.advice, insight: t.activities.insight,
    update: t.activities.update, introduction: t.activities.introduction,
  };
  const typeLabel = activityTypeLabels[activity.activityType?.toLowerCase()] || cfg.label;
  const timeStr = formatDateTime(activity.createdTime);

  return (
    <Link
      to={`/activities/${activity.id}`}
      className="block bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all"
    >
      {/* Header row: company | type badge | delete */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {companyLogo && !logoError ? (
              <img
                src={companyLogo}
                alt={displayCompany}
                className="w-full h-full object-cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Building2 size={14} className="text-gray-400" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700">{displayCompany}</p>
            {timeStr && (
              <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                <Clock size={10} className="text-gray-400" />
                {timeStr}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.bg, cfg.text)}>
            {typeLabel}
          </span>
          {canDelete && onDelete && (
            <button
              onClick={async (e) => {
                e.preventDefault();
                if (!confirm('Delete this activity?')) return;
                setDeleting(true);
                try { await deleteSharedActivity(activity.id); onDelete(activity.id); } catch { /* swallow */ } finally { setDeleting(false); }
              }}
              disabled={deleting}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} className={deleting ? 'animate-pulse' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-3 pb-4">
        {activity.title && (
          <h3 className="text-sm font-bold text-gray-900 mb-1 leading-snug">{activity.title}</h3>
        )}
        {activity.authorName && (
          <p className="text-xs font-medium text-gray-500 mb-2">{activity.authorName}</p>
        )}
        {activity.content && (
          <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
            {display}{isLong && '…'}
          </p>
        )}

        {/* Post attachment — dispatches on postType; falls back to the old
            image/youtube-URL inference for records saved before postType
            existed. */}
        {(() => {
          switch (activity.postType) {
            case 'photo':
              if (activity.fileRef) return <MediaAttachment fileRef={activity.fileRef} kind="photo" />;
              if (!activity.imageUrl && !(activity.imageData && activity.imageData.startsWith('data:'))) return null;
              return (
                <div className="mt-3 rounded-xl overflow-hidden">
                  <img
                    src={activity.imageData?.startsWith('data:') ? activity.imageData : activity.imageUrl}
                    alt=""
                    className="w-full max-h-48 object-cover"
                    loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              );
            case 'video':
              if (activity.fileRef) return <MediaAttachment fileRef={activity.fileRef} kind="video" />;
              return activity.videoUrl ? (
                <div className="mt-3 rounded-xl overflow-hidden bg-black" onClick={e => e.stopPropagation()}>
                  <video src={activity.videoUrl} controls className="w-full max-h-64" />
                </div>
              ) : null;
            case 'youtube': {
              const embed = activity.videoUrl ? getVideoEmbedUrl(activity.videoUrl) : null;
              return embed ? (
                <div className="mt-3 aspect-video bg-black rounded-xl overflow-hidden" onClick={e => e.preventDefault()}>
                  <iframe src={embed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              ) : null;
            }
            case 'document':
              return <DocumentAttachmentCard fileRef={activity.fileRef} fileName={activity.activityFileName} onOpen={ref => onOpenDocument(ref, activity.activityFileName)} />;
            case 'location':
              return <LocationCard name={activity.locationName} coords={activity.locationCoords} />;
            case 'poll':
              return <PollWidget activity={activity} allActivities={allActivities} />;
            case 'link':
              return <LinkCard url={activity.linkUrl} />;
            default: {
              // Legacy: no postType saved — infer from imageUrl/imageData like before.
              if (!activity.imageUrl && !(activity.imageData && activity.imageData.startsWith('data:'))) return null;
              const videoEmbed = activity.imageUrl ? getVideoEmbedUrl(activity.imageUrl) : null;
              return (
                <div className="mt-3 rounded-xl overflow-hidden">
                  {videoEmbed ? (
                    <div className="aspect-video bg-black" onClick={e => e.preventDefault()}>
                      <iframe src={videoEmbed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  ) : (
                    <img
                      src={activity.imageData?.startsWith('data:') ? activity.imageData : (getVideoThumbnail(activity.imageUrl || '') || activity.imageUrl)}
                      alt=""
                      className="w-full max-h-48 object-cover"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
              );
            }
          }
        })()}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.map(tag => (
              <span key={tag} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Activities() {
  const { currentUser, isFounder, isInvestor } = useAuth();
  const { t } = useLanguage();
  const { setPageTitle } = usePageTitle();
  const [records, setRecords] = useState<CRMActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [syncWarning, setSyncWarning] = useState('');
  const [clearingAll, setClearingAll] = useState(false);
  const [mySharePublic, setMySharePublic] = useState(false);
  const [companyLogos, setCompanyLogos] = useState<Record<string, string>>({});
  const [docViewer, setDocViewer] = useState<{ name: string; fileName: string } | null>(null);
  const [docViewerUrl, setDocViewerUrl] = useState<string | null>(null);
  const [docViewerLoading, setDocViewerLoading] = useState(false);
  const [docViewerError, setDocViewerError] = useState('');
  const docViewerRevokeRef = useRef(false);
  const isConnected = !!loadToken();
  const canFetch = isConnected || isFounder;
  // Poll-vote records are real activity records (see castPollVote in
  // crmActivities.ts) but aren't posts — keep them in `records` so
  // PollWidget can tally them, but never render/count them as feed items.
  const visibleRecords = records.filter(r => r.activityType !== POLL_VOTE_TYPE);

  useEffect(() => {
    setPageTitle(
      isFounder ? t.activities.title : t.activities.activitiesTitle,
      t.activities.subtitle,
    );
    return () => setPageTitle(null);
  }, [t, isFounder]);

  const postVisibility = 'public';

  const load = () => {
    if (!canFetch) { setLoading(false); return; }
    setLoading(true); setError('');
    fetchSharedActivities()
      // Show only activities actually saved in CRM — exclude local-only items
      // (IDs starting with "local_") that haven't synced.
      .then(recs => setRecords(recs.filter(r => !r.id.startsWith('local_'))))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (canFetch) {
      syncUnsyncedActivities().then(count => {
        if (count > 0) load();
      }).catch(() => {});
    }
    if (isFounder && currentUser.email) {
      fetchActivityPermissions()
        .then(perms => {
          const me = perms.find(p => p.email.toLowerCase() === currentUser.email.toLowerCase());
          if (me?.shareActivitiesPublic) setMySharePublic(true);
        })
        .catch(() => {});
    }
  }, []);

  // Build a company-name → logo lookup for the feed. Investors can see every
  // founder's post, so they need every company's logo (fetchAllCompanyProfiles,
  // admin-only); a founder's own posts are the only founder posts they'll ever
  // see themselves (per the visibility rules in sharedActivities.ts — other
  // founders' posts are hidden from them), so they only need their own company.
  useEffect(() => {
    if (!canFetch) return;
    if (isInvestor) {
      fetchAllCompanyProfiles()
        .then(profiles => {
          const map: Record<string, string> = {};
          for (const p of profiles) {
            const key = p.data.name?.trim().toLowerCase();
            if (key && p.logo) map[key] = p.logo;
          }
          setCompanyLogos(map);
        })
        .catch(() => {});
    } else if (isFounder && currentUser.email) {
      fetchCompanyProfile(currentUser.email)
        .then(result => {
          const key = result.data.name?.trim().toLowerCase();
          if (key && result.logo) setCompanyLogos(prev => ({ ...prev, [key]: result.logo as string }));
        })
        .catch(() => {});
    }
  }, [canFetch, isInvestor, isFounder, currentUser.email]);

  const handlePost = (activity: CRMActivity) => {
    // Only show it in the feed if it actually saved to CRM (real id, not local_).
    if (activity.id.startsWith('local_')) return;
    setRecords(prev => [activity, ...prev]);
  };

  const handleDelete = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleClearAll = async () => {
    if (!confirm(`Delete all ${visibleRecords.length} activities? This cannot be undone.`)) return;
    setClearingAll(true);
    try {
      // Delete the full set (including hidden poll-vote records) so nothing
      // orphaned is left behind in CRM.
      await deleteAllSharedActivities(records.map(r => r.id));
      setRecords([]);
    } finally {
      setClearingAll(false);
    }
  };

  const closeDocViewer = () => {
    if (docViewerRevokeRef.current && docViewerUrl) URL.revokeObjectURL(docViewerUrl);
    setDocViewer(null);
    setDocViewerUrl(null);
    setDocViewerError('');
  };

  const handleOpenDocument = async (ref: ActivityFileRef, fileName: string) => {
    setDocViewer({ name: fileName, fileName });
    setDocViewerUrl(null);
    setDocViewerError('');
    setDocViewerLoading(true);
    try {
      const { url, revoke } = await resolveActivityFileUrl(ref);
      docViewerRevokeRef.current = revoke;
      setDocViewerUrl(url);
    } catch (err) {
      setDocViewerError(err instanceof Error ? err.message : 'Failed to open document.');
    } finally {
      setDocViewerLoading(false);
    }
  };

  const handleDocViewerDownload = () => {
    if (!docViewerUrl || !docViewer) return;
    const a = document.createElement('a');
    a.href = docViewerUrl;
    a.download = docViewer.fileName || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const RECENT_TYPE_STYLE: Record<string, { icon: typeof Activity; color: string }> = {
    win:          { icon: TrendingUp,   color: 'text-emerald-500 bg-emerald-50' },
    insight:      { icon: Sparkles,     color: 'text-amber-500 bg-amber-50' },
    update:       { icon: RefreshCw,    color: 'text-blue-500 bg-blue-50' },
    advice:       { icon: MessageSquare,color: 'text-indigo-500 bg-indigo-50' },
    introduction: { icon: Users,        color: 'text-violet-500 bg-violet-50' },
  };
  const defaultStyle = { icon: Activity, color: 'text-gray-500 bg-gray-50' };

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.activities.justNow;
    if (mins < 60) return t.activities.minutesAgo.replace('{n}', String(mins));
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t.activities.hoursAgo.replace('{n}', String(hrs));
    const days = Math.floor(hrs / 24);
    return t.activities.daysAgo.replace('{n}', String(days));
  }

  const RECENT_EVENTS = visibleRecords.slice(0, 5).map(r => {
    const style = RECENT_TYPE_STYLE[r.activityType?.toLowerCase()] ?? defaultStyle;
    const label = r.title || r.content?.slice(0, 60) || 'Activity';
    const author = r.authorName ? ` — ${r.authorName}` : '';
    return {
      icon: style.icon,
      color: style.color,
      text: `${label}${author}`,
      time: r.createdTime ? timeAgo(r.createdTime) : '',
    };
  });

  return (
    <div className="min-h-screen">
      <div className="flex-1 py-6 px-4 sm:px-6 lg:px-8 relative"
        style={{
          backgroundImage: `url("https://images.unsplash.com/photo-1518655048521-f130df041f66?fm=jpg&q=80&w=1920&auto=format&fit=crop")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
      <div className="pointer-events-none absolute inset-0 bg-white/30" />

      <div className="relative z-10 w-full max-w-5xl">

      {docViewer && (
        <DocumentViewerModal
          title={docViewer.name}
          fileName={docViewer.fileName}
          url={docViewerUrl}
          loading={docViewerLoading}
          error={docViewerError}
          previewable={/\.pdf$/i.test(docViewer.fileName || '')}
          onClose={closeDocViewer}
          onDownload={handleDocViewerDownload}
        />
      )}

      {/* Not connected */}
      {!isConnected && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">{t.investorDashboard.connectCRM}</p>
            <p className="text-xs text-amber-600 mt-0.5">{t.investorDashboard.connectCRMDesc}</p>
          </div>
          <Link to="/login" className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg">{t.investorDashboard.connect}</Link>
        </div>
      )}

      {/* Two-column: feed left, recent right */}
      <div className="flex gap-5 items-start">

      {/* LEFT — feed (same as before) */}
      <div className="flex-1 min-w-0 max-w-2xl">

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 mt-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-xl" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center mt-4">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg">
            <RefreshCw size={12} /> {t.activities.retry}
          </button>
        </div>
      )}

      {/* Sync warning */}
      {syncWarning && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 flex-1">{syncWarning}</p>
          <button onClick={() => setSyncWarning('')} className="text-amber-400 hover:text-amber-600"><X size={14} /></button>
        </div>
      )}

      {/* Composer */}
      <Composer onPost={handlePost} onSyncWarning={setSyncWarning} postVisibility={postVisibility} />

      {/* Empty */}
      {!loading && !error && visibleRecords.length === 0 && canFetch && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl mt-4">
          <Activity size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">{t.activities.noActivities}</p>
          <p className="text-xs text-gray-400">{t.activities.noActivitiesDesc}</p>
        </div>
      )}

      {/* Clear All — investor only */}
      {!loading && !error && visibleRecords.length > 0 && isInvestor && (
        <div className="flex justify-end mb-2">
          <button
            onClick={handleClearAll}
            disabled={clearingAll}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={12} className={clearingAll ? 'animate-pulse' : ''} />
            {clearingAll ? 'Deleting...' : `Clear All (${visibleRecords.length})`}
          </button>
        </div>
      )}

      {/* Feed — grouped by date */}
      {!loading && !error && visibleRecords.length > 0 && (
        <div className="mt-4 space-y-6">
          {groupAndSort(visibleRecords).map(group => (
            <div key={group.key}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.activities[group.key as 'today' | 'yesterday' | 'earlier']}</h2>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-1 gap-4">
                {group.items.map(activity => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onDelete={handleDelete}
                    companyLogos={companyLogos}
                    allActivities={records}
                    onOpenDocument={handleOpenDocument}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      {/* RIGHT — Recent Activities (small box, 3 items) */}
      <div className="hidden lg:block w-[280px] flex-shrink-0 sticky top-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} className="text-gray-400" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.activities.recentActivity}</h3>
          </div>
          <div className="space-y-3">
            {RECENT_EVENTS.slice(0, 3).map((ev, i) => {
              const Icon = ev.icon;
              const [iconColor, iconBg] = ev.color.split(' ');
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', iconBg)}>
                    <Icon size={12} className={iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-snug">{ev.text}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{ev.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>
      </div>
      </div>
    </div>
  );
}

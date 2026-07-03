import React, { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import {
  Activity, AlertCircle, RefreshCw, Building2,
  Image, X, Send, Link as LinkIcon,
  PlusCircle, DollarSign, FileText, Users, TrendingUp, MessageSquare, Upload, Clock,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import {
  type CRMActivity, type CRMActivityFields,
} from '../services/crmActivities';
import { fetchSharedActivities, postSharedActivity, syncUnsyncedActivities } from '../services/sharedActivities';
import { loadToken } from '../services/oauth';
import { cn } from '../lib/cn';
import { generateAIActivities } from '../services/aiEngine';
import { fetchCRMPortfolio } from '../services/crmPortfolio';
import { fetchCRMDeals } from '../services/crmDeals';
import { fetchCRMApplications } from '../services/crmApplications';
import { fetchCRMFounders } from '../services/crmFounders';

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
      if (!ctx) { reject(new Error('Canvas error')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.75;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 28000 && quality > 0.1) { quality -= 0.1; dataUrl = canvas.toDataURL('image/jpeg', quality); }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Load error')); };
    img.src = objectUrl;
  });
}

// ─── Inline Composer ──────────────────────────────────────────────────────────

function Composer({ onPost, onSyncWarning }: { onPost: (activity: CRMActivity) => void; onSyncWarning?: (msg: string) => void }) {
  const { currentUser, isInvestor, isFounder, founderCompanyName } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded]       = useState(false);
  const [title, setTitle]             = useState('');
  const [content, setContent]         = useState('');
  const [activityType, setActivityType] = useState('update');
  const [companyName, setCompanyName] = useState(founderCompanyName);
  const [imageData, setImageData]     = useState('');   // base64 compressed
  const [imageUrl, setImageUrl]       = useState('');   // public URL
  const [imagePreview, setImagePreview] = useState('');
  const [imageMode, setImageMode]     = useState<'upload' | 'url'>('upload');
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [posting, setPosting]         = useState(false);
  const [generating, setGenerating]   = useState(false);

  // Keep in sync if founderCompanyName loads async
  useEffect(() => {
    if (founderCompanyName && !companyName) setCompanyName(founderCompanyName);
  }, [founderCompanyName]);

  const canPost = title.trim() && content.trim();

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

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setImageData(compressed);
      setImagePreview(compressed);
      setImageUrl('');
    } finally { setCompressing(false); }
  }

  function clearImage() {
    setImageData(''); setImageUrl(''); setImagePreview('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleCancel() {
    setExpanded(false);
    setTitle(''); setContent(''); setActivityType('update');
    setCompanyName(founderCompanyName);
    clearImage(); setShowImagePanel(false);
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
        imageUrl:     imageMode === 'url' ? imageUrl.trim() : '',
        imageData:    imageMode === 'upload' ? imageData : '',
      };
      const activity = await postSharedActivity(fields);

      onPost(activity);
      if (!activity.synced) {
        onSyncWarning?.('Activity saved locally but failed to sync to CRM. It will retry automatically.');
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
          Share activities…
        </div>
        <button
          onClick={e => { e.stopPropagation(); setExpanded(true); setShowImagePanel(true); }}
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
          <p className="text-xs text-gray-500 capitalize">{currentUser.role}</p>
        </div>
      </div>

      {/* Company name */}
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={14} className="text-gray-300 flex-shrink-0" />
        <input
          type="text"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder="Company name"
          className="text-xs text-gray-600 placeholder-gray-300 border-0 outline-none bg-transparent flex-1"
        />
      </div>

      {/* Activity type pills */}
      <div className="flex gap-2 flex-wrap mb-3">
        {ACTIVITY_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setActivityType(t.value)}
            className={cn(
              'text-xs font-medium px-3 py-1 rounded-full border transition-all',
              activityType === t.value
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full text-sm font-semibold text-gray-900 placeholder-gray-300 border-0 outline-none mb-1"
        autoFocus
      />

      {/* Content */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={isInvestor ? "What do you want to share with your founders?" : "What do you want to share with your investor?"}
        className="w-full text-sm text-gray-700 placeholder-gray-400 resize-none border-0 outline-none leading-relaxed min-h-[90px]"
      />

      {/* Image / video preview */}
      {(imagePreview || (imageMode === 'url' && imageUrl.startsWith('http'))) && (() => {
        const videoEmbed = imageMode === 'url' ? getVideoEmbedUrl(imageUrl) : null;
        return (
          <div className="relative mt-2 mb-3 rounded-xl overflow-hidden">
            {videoEmbed ? (
              <div className="aspect-video bg-black">
                <iframe src={videoEmbed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            ) : (
              <img src={imagePreview || getVideoThumbnail(imageUrl) || imageUrl} alt="preview" className="w-full max-h-56 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <button onClick={clearImage} className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center">
              <X size={13} className="text-white" />
            </button>
          </div>
        );
      })()}

      {/* Image panel */}
      {showImagePanel && !(imagePreview || (imageMode === 'url' && imageUrl.startsWith('http'))) && (
        <div className="border border-gray-100 rounded-xl p-3 mb-3 bg-gray-50">
          <div className="flex gap-1 mb-2">
            {(['upload', 'url'] as const).map(m => (
              <button key={m} onClick={() => setImageMode(m)}
                className={cn('text-xs px-2 py-1 rounded-lg font-medium transition-all', imageMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
                {m === 'upload' ? 'Upload' : 'URL'}
              </button>
            ))}
          </div>
          {imageMode === 'upload' ? (
            <button onClick={() => fileRef.current?.click()} disabled={compressing}
              className="w-full border border-dashed border-gray-200 rounded-xl py-4 text-xs text-gray-400 hover:border-gray-400 hover:bg-white transition-all flex items-center justify-center gap-2">
              {compressing ? <><div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Compressing…</> : <><Image size={14} /> Click to upload image</>}
            </button>
          ) : (
            <input type="text" value={imageUrl} onChange={e => { setImageUrl(e.target.value); setImagePreview(''); setImageData(''); }}
              placeholder="https://example.com/image.png"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black" />
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowImagePanel(v => !v)}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors',
              showImagePanel ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-50')}
          >
            <Image size={15} /> Photo
          </button>
          <button
            onClick={() => { setImageMode('url'); setShowImagePanel(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <LinkIcon size={15} /> URL
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-500 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-700 disabled:opacity-60 transition-all shadow-sm"
          >
            {generating ? (
              <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
            ) : (
              <><Sparkles size={13} /> Generate with AI</>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={!canPost || posting}
            className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send size={14} /> {posting ? 'Posting…' : 'Post'}
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

function getDateGroup(iso: string): string {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Earlier';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const actDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (actDate.getTime() === today.getTime()) return 'Today';
  if (actDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return 'Earlier';
}

function groupAndSort(activities: CRMActivity[]): { label: string; items: CRMActivity[] }[] {
  const sorted = [...activities].sort((a, b) => {
    const ta = a.createdTime ? new Date(a.createdTime).getTime() : 0;
    const tb = b.createdTime ? new Date(b.createdTime).getTime() : 0;
    return tb - ta;
  });
  const groups: { label: string; items: CRMActivity[] }[] = [];
  const order = ['Today', 'Yesterday', 'Earlier'];
  const map = new Map<string, CRMActivity[]>();
  for (const a of sorted) {
    const g = getDateGroup(a.createdTime);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(a);
  }
  for (const label of order) {
    const items = map.get(label);
    if (items?.length) groups.push({ label, items });
  }
  return groups;
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ activity }: { activity: CRMActivity }) {
  const { currentUser, founderCompanyName } = useAuth();
  const isOwnPost = currentUser.name.trim().toLowerCase() === activity.authorName?.trim().toLowerCase();
  const displayCompany = activity.companyName || (isOwnPost ? founderCompanyName : '') || activity.authorName || 'General';
  const LIMIT = 220;
  const isLong = activity.content.length > LIMIT;
  const display = isLong ? activity.content.slice(0, LIMIT) : activity.content;
  const tags = activity.tags ? activity.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const cfg = TYPE_CONFIG[activity.activityType?.toLowerCase()] ?? { label: activity.activityType || 'Activity', bg: 'bg-gray-100', text: 'text-gray-600' };
  const timeStr = formatDateTime(activity.createdTime);

  return (
    <Link
      to={`/activities/${activity.id}`}
      className="block bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all"
    >
      {/* Header row: company | type badge */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-gray-400" />
          </div>
          <p className="text-xs font-semibold text-gray-700">{displayCompany}</p>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.bg, cfg.text)}>
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 pt-3 pb-4">
        {activity.title && (
          <h3 className="text-sm font-bold text-gray-900 mb-1 leading-snug">{activity.title}</h3>
        )}
        <div className="flex items-center gap-2 mb-2">
          {activity.authorName && (
            <p className="text-xs text-gray-400">{activity.authorName}</p>
          )}
          {activity.authorName && timeStr && <span className="text-xs text-gray-300">·</span>}
          {timeStr && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={11} className="text-gray-300" />
              {timeStr}
            </p>
          )}
        </div>
        {activity.content && (
          <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
            {display}{isLong && '…'}
          </p>
        )}

        {/* Image or video — prefer full imageData (base64), fallback to imageUrl */}
        {(activity.imageUrl || (activity.imageData && activity.imageData.startsWith('data:'))) && (() => {
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
  const { currentUser, isFounder } = useAuth();
  const [records, setRecords] = useState<CRMActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [syncWarning, setSyncWarning] = useState('');
  const isConnected = !!loadToken();

  const load = () => {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true); setError('');
    fetchSharedActivities(currentUser.name)
      .then(setRecords)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (isConnected) {
      syncUnsyncedActivities().then(count => {
        if (count > 0) load();
      }).catch(() => {});
    }
  }, []);

  const handlePost = (activity: CRMActivity) => {
    setRecords(prev => [activity, ...prev]);
  };

  const RECENT_EVENTS = [
    { icon: PlusCircle,   color: 'text-indigo-500 bg-indigo-50',  text: 'NeuralPath AI added to portfolio',            time: '2h ago' },
    { icon: DollarSign,   color: 'text-emerald-500 bg-emerald-50', text: 'Investment completed — FinFlow Payments $3M', time: '5h ago' },
    { icon: Users,        color: 'text-violet-500 bg-violet-50',   text: 'Founder meeting with Lena Kovacs (Stackly)',  time: '1d ago' },
    { icon: FileText,     color: 'text-blue-500 bg-blue-50',       text: 'Startup application received — GreenVault',  time: '1d ago' },
    { icon: TrendingUp,   color: 'text-amber-500 bg-amber-50',     text: 'Deal stage updated — Orbis Logistics',       time: '2d ago' },
    { icon: Upload,       color: 'text-pink-500 bg-pink-50',       text: 'Document uploaded — Medisync Term Sheet',    time: '2d ago' },
    { icon: MessageSquare,color: 'text-teal-500 bg-teal-50',       text: 'Discussion post created — Q2 Review',        time: '3d ago' },
    { icon: DollarSign,   color: 'text-emerald-500 bg-emerald-50', text: 'Valuation updated — Medisync Health $58M',   time: '4d ago' },
    { icon: PlusCircle,   color: 'text-indigo-500 bg-indigo-50',   text: 'RetailMind 34% revenue milestone achieved',  time: '5d ago' },
    { icon: Users,        color: 'text-violet-500 bg-violet-50',   text: 'Intro: Priya Mehta ↔ Dr. Sarah Okonkwo',    time: '6d ago' },
  ];

  return (
    <div className="min-h-screen py-6 sm:py-8 px-4 sm:px-6 lg:px-8 relative"
      style={{
        backgroundImage: `url("https://images.unsplash.com/photo-1518655048521-f130df041f66?fm=jpg&q=80&w=1920&auto=format&fit=crop")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-white/30" />

      <div className="relative z-10 w-full max-w-5xl">

      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Activities</h1>
        <p className="text-sm text-gray-400 mt-0.5">What's happening across your portfolio network</p>
      </div>

      {/* Not connected */}
      {!isConnected && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Connect Zoho CRM to see live data</p>
            <p className="text-xs text-amber-600 mt-0.5">Sign in with Zoho CRM to get started.</p>
          </div>
          <Link to="/login" className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg">Connect</Link>
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
            <RefreshCw size={12} /> Retry
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
      <Composer onPost={handlePost} onSyncWarning={setSyncWarning} />

      {/* Empty */}
      {!loading && !error && records.length === 0 && isConnected && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl mt-4">
          <Activity size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No activities yet</p>
          <p className="text-xs text-gray-400">Use the composer above to share your first update.</p>
        </div>
      )}

      {/* Feed — grouped by date */}
      {!loading && !error && records.length > 0 && (
        <div className="mt-4 space-y-6">
          {groupAndSort(records).map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.label}</h2>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-1 gap-4">
                {group.items.map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
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
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent Activity</h3>
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
  );
}

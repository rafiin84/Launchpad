import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, ExternalLink, Calendar, Edit3, Trophy,
  MessageSquare, Lightbulb, Link2, Mail, X, Plus, Trash2, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';

/* ── localStorage helpers ───────────────────────────────────── */
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

/* ── Edit Modal ─────────────────────────────────────────────── */
function EditProfileModal({
  extra,
  onSave,
  onClose,
}: {
  extra: ProfileExtra;
  onSave: (data: ProfileExtra) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProfileExtra>({ ...extra });
  const [newTag, setNewTag] = useState('');

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

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-base font-bold text-gray-900">Edit Profile</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Bio</label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={e => set('bio', e.target.value)}
              placeholder="Tell others a bit about yourself…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={form.location}
                onChange={e => set('location', e.target.value)}
                placeholder="City, Country"
                className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* LinkedIn */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">LinkedIn URL</label>
            <div className="relative">
              <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={form.linkedIn}
                onChange={e => set('linkedIn', e.target.value)}
                placeholder="https://linkedin.com/in/yourname"
                className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Twitter */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Twitter / X Handle</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <input
                type="text"
                value={form.twitter.replace('@', '')}
                onChange={e => set('twitter', e.target.value)}
                placeholder="yourhandle"
                className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Expertise / Skills */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Skills &amp; Expertise</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.expertise.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
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
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                onClick={addTag}
                className="w-9 h-9 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-xl transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Profile Page ───────────────────────────────────────────── */
export default function Profile() {
  const { currentUser, role, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }
  const [extra, setExtra] = useState<ProfileExtra>(loadExtra);
  const [showEdit, setShowEdit] = useState(false);

  const handleSave = (data: ProfileExtra) => {
    saveExtra(data);
    setExtra(data);
  };

  const joinedDate = new Date(currentUser.joinedAt).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">

      {showEdit && (
        <EditProfileModal
          extra={extra}
          onSave={handleSave}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Profile card */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" />

        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-8 mb-4">
            <div className="ring-4 ring-white rounded-2xl overflow-hidden">
              <Avatar src={currentUser.avatar} name={currentUser.name} size="xl" />
            </div>
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <Edit3 size={14} /> Edit Profile
            </button>
          </div>

          <h1 className="text-xl font-bold text-gray-900">{currentUser.name}</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{role}</p>

          {extra.bio && (
            <p className="text-sm text-gray-700 mt-3 leading-relaxed max-w-lg">{extra.bio}</p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {extra.location && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin size={13} /> {extra.location}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar size={13} /> Joined {joinedDate}
            </span>
            {extra.twitter && (
              <a
                href={`https://twitter.com/${extra.twitter.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >
                <Link2 size={13} /> @{extra.twitter.replace('@', '')}
              </a>
            )}
            {extra.linkedIn && (
              <a
                href={extra.linkedIn.startsWith('http') ? extra.linkedIn : `https://${extra.linkedIn}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ExternalLink size={13} /> LinkedIn
              </a>
            )}
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Mail size={13} /> {currentUser.email}
            </span>
          </div>

          {/* Expertise pills */}
          {extra.expertise.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {extra.expertise.map(exp => (
                <span key={exp} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                  {exp}
                </span>
              ))}
            </div>
          )}

          {/* Empty state hint */}
          {!extra.bio && !extra.location && extra.expertise.length === 0 && (
            <p className="text-xs text-gray-400 mt-4 italic">
              Your profile is empty — click <strong>Edit Profile</strong> to add your bio, location, and skills.
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Posts',    value: 0,    icon: <MessageSquare size={16} className="text-gray-400" /> },
          { label: 'Role',     value: role === 'investor' ? '🏦' : '🚀', icon: null },
          { label: 'Wins',     value: 0,    icon: <Trophy size={16} className="text-emerald-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl px-4 py-4 text-center">
            <div className="flex justify-center mb-1">{s.icon}</div>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* About section */}
      {(extra.expertise.length > 0 || extra.bio) && (
        <div className="space-y-4">
          {extra.expertise.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Skills &amp; Expertise</h3>
              <div className="flex flex-wrap gap-2">
                {extra.expertise.map(exp => (
                  <span key={exp} className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1.5 rounded-xl font-medium">
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!extra.bio && extra.expertise.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <Lightbulb size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">Complete your profile to stand out</p>
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 text-sm font-medium bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Edit3 size={14} /> Edit Profile
          </button>
        </div>
      )}

      {/* Sign Out */}
      <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Sign Out</p>
            <p className="text-xs text-gray-400 mt-0.5">You'll be returned to the login screen</p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-4 py-2 rounded-xl transition-colors"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

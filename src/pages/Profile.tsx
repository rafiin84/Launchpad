import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Mail, LogOut, Edit3, ExternalLink, Link2, Briefcase,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/layout/PageHeader';

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

/* ── Profile Page ───────────────────────────────────────────── */
export default function Profile() {
  const { currentUser, role, logout } = useAuth();
  const navigate = useNavigate();
  const [extra] = useState<ProfileExtra>(loadExtra);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = currentUser.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hasDetails = extra.bio || extra.location || extra.expertise.length > 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-3xl">

      <PageHeader
        title="Profile"
        description="Your personal profile and account details"
        action={
          <button
            onClick={() => navigate('/profile/edit')}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <Edit3 size={14} /> Edit Profile
          </button>
        }
      />

      {/* ── Avatar + Identity ─────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-4">
        {/* Cover strip */}
        <div className="h-20 bg-gradient-to-r from-gray-900 via-gray-800 to-indigo-900 relative overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 80" preserveAspectRatio="xMidYMid slice">
            <polyline points="0,70 60,55 120,45 180,32 240,22 300,14 360,8 400,4" fill="none" stroke="#a5b4fc" strokeWidth="1.5" />
            <polygon points="0,70 60,55 120,45 180,32 240,22 300,14 360,8 400,4 400,80 0,80" fill="#6366f1" fillOpacity="0.15" />
          </svg>
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-8 mb-4">
            {/* Avatar */}
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md flex-shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-indigo-100 border-4 border-white shadow-md flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-700 font-bold text-xl">{initials}</span>
              </div>
            )}
          </div>

          {/* Name & role */}
          <h2 className="text-lg font-bold text-gray-900">{currentUser.name}</h2>
          <span className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 capitalize">
            <Briefcase size={11} /> {role}
          </span>

          {/* Bio */}
          {extra.bio && (
            <p className="text-sm text-gray-600 mt-3 leading-relaxed max-w-lg">{extra.bio}</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Mail size={13} className="text-gray-400" />
              {currentUser.email}
            </span>
            {extra.location && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin size={13} className="text-gray-400" />
                {extra.location}
              </span>
            )}
            {extra.linkedIn && (
              <a
                href={extra.linkedIn.startsWith('http') ? extra.linkedIn : `https://${extra.linkedIn}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <ExternalLink size={13} /> LinkedIn
              </a>
            )}
            {extra.twitter && (
              <a
                href={`https://twitter.com/${extra.twitter.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <Link2 size={13} /> @{extra.twitter.replace('@', '')}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Skills & Expertise ───────────────────────────────── */}
      {extra.expertise.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Skills &amp; Expertise</h3>
          <div className="flex flex-wrap gap-2">
            {extra.expertise.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {!hasDetails && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center mb-4">
          <Edit3 size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">Your profile is empty</p>
          <p className="text-xs text-gray-400 mb-4">Add your bio, location, and skills to complete your profile</p>
          <button
            onClick={() => navigate('/profile/edit')}
            className="inline-flex items-center gap-2 text-sm font-medium bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Edit3 size={13} /> Complete Profile
          </button>
        </div>
      )}

      {/* ── Sign Out ─────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
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

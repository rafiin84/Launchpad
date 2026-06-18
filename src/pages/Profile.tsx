import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Mail, LogOut, Edit3, ExternalLink, Link2, Phone, Briefcase } from 'lucide-react';
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
  const { currentUser, role, logout, zohoEmail, zohoProfile } = useAuth();
  const navigate = useNavigate();
  const [extra] = useState<ProfileExtra>(loadExtra);

  const displayEmail = zohoProfile.email || zohoEmail || currentUser.email;
  const location = extra.location || [zohoProfile.state, zohoProfile.country].filter(Boolean).join(', ') || null;
  const phone = zohoProfile.phone || zohoProfile.mobile || null;

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

  const hasExtra = extra.bio || extra.location || extra.expertise.length > 0
    || extra.linkedIn || extra.twitter || phone || location || zohoProfile.jobTitle;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-2xl">

      <PageHeader
        title="Profile"
        description="Your account details and personal information"
        action={
          <button
            onClick={() => navigate('/profile/edit')}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <Edit3 size={14} /> Edit Profile
          </button>
        }
      />

      {/* ── Identity card ─────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-700 font-bold text-lg">{initials}</span>
            </div>
          )}

          {/* Name + role */}
          <div>
            <h2 className="text-base font-bold text-gray-900">{currentUser.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {zohoProfile.jobTitle ? `${zohoProfile.jobTitle} · ` : ''}<span className="capitalize">{role}</span>
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="mt-5 space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm text-gray-600">
            <Mail size={14} className="text-gray-400 flex-shrink-0" />
            {displayEmail}
          </div>
          {phone && (
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <Phone size={14} className="text-gray-400 flex-shrink-0" />
              {phone}
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <MapPin size={14} className="text-gray-400 flex-shrink-0" />
              {location}
            </div>
          )}
          {zohoProfile.jobTitle && (
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
              {zohoProfile.jobTitle}
            </div>
          )}
          {extra.linkedIn && (
            <a
              href={extra.linkedIn.startsWith('http') ? extra.linkedIn : `https://${extra.linkedIn}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <ExternalLink size={14} className="flex-shrink-0" />
              LinkedIn
            </a>
          )}
          {extra.twitter && (
            <a
              href={`https://twitter.com/${extra.twitter.replace('@', '')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Link2 size={14} className="flex-shrink-0" />
              @{extra.twitter.replace('@', '')}
            </a>
          )}
        </div>
      </div>

      {/* ── Bio ──────────────────────────────────────────────── */}
      {extra.bio && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">About</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{extra.bio}</p>
        </div>
      )}

      {/* ── Skills ───────────────────────────────────────────── */}
      {extra.expertise.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Skills &amp; Expertise</h3>
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
      {!hasExtra && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center mb-4">
          <p className="text-sm text-gray-500 mb-1">Your profile is incomplete</p>
          <p className="text-xs text-gray-400 mb-4">Add your bio, location, and skills</p>
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

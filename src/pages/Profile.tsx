import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, ExternalLink, Calendar, Edit3, Trophy,
  MessageSquare, Lightbulb, Link2, Mail, LogOut,
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

/* ── Profile Page ───────────────────────────────────────────── */
export default function Profile() {
  const { currentUser, role, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }
  const [extra, setExtra] = useState<ProfileExtra>(loadExtra);

  const joinedDate = new Date(currentUser.joinedAt).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">

      {/* Profile card */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" />

        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-8 mb-4">
            <Avatar src={currentUser.avatar} name={currentUser.name} size="xl" />
            <button
              onClick={() => navigate('/profile/edit')}
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
            onClick={() => navigate('/profile/edit')}
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

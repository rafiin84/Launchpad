import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Mail, LogOut, Edit3, Briefcase, GraduationCap,
  Users, Building2, ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  return {
    bio: 'Coach, Entrepreneur, Engineer, Product Manager and Learner',
    location: 'Chennai, Tamil Nadu, India',
    twitter: '',
    linkedIn: 'https://in.linkedin.com/in/kumar-vembu-a0a45710',
    expertise: ['Entrepreneurship', 'Product Management', 'Engineering', 'Coaching', 'Leadership'],
  };
}

/* ── Static LinkedIn-style data ─────────────────────────────── */
const EXPERIENCE = [
  {
    company: 'Mudhal Partners',
    role: 'Co-founder & CEO',
    period: '2020 – Present',
    logo: null,
    color: 'bg-emerald-600',
  },
  {
    company: 'Launchpad',
    role: 'Founder',
    period: '2024 – Present',
    logo: null,
    color: 'bg-black',
  },
];

const EDUCATION = [
  {
    school: 'Madurai Kamaraj University',
    degree: 'Bachelor of Engineering',
    period: '1990 – 1994',
  },
];

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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">

      {/* ── Card 1: Hero ──────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

        {/* Cover banner — Launchpad branded */}
        <div className="h-32 sm:h-40 relative overflow-hidden bg-black">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 160" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            {/* Deep background */}
            <rect width="800" height="160" fill="#0a0a0a" />

            {/* Subtle grid lines */}
            <g stroke="#ffffff" strokeOpacity="0.04" strokeWidth="1">
              {[0,80,160,240,320,400,480,560,640,720,800].map(x => (
                <line key={x} x1={x} y1="0" x2={x} y2="160" />
              ))}
              {[0,40,80,120,160].map(y => (
                <line key={y} x1="0" y1={y} x2="800" y2={y} />
              ))}
            </g>

            {/* Upward trending line chart — investor/growth theme */}
            <polyline
              points="0,140 80,125 160,115 240,100 320,88 400,70 480,55 560,42 640,30 720,20 800,10"
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.5"
              strokeOpacity="0.6"
            />
            {/* Fill under chart line */}
            <polygon
              points="0,140 80,125 160,115 240,100 320,88 400,70 480,55 560,42 640,30 720,20 800,10 800,160 0,160"
              fill="#6366f1"
              fillOpacity="0.08"
            />

            {/* Second softer line */}
            <polyline
              points="0,155 100,148 200,138 300,122 400,105 500,88 600,72 700,58 800,45"
              fill="none"
              stroke="#a5b4fc"
              strokeWidth="1.5"
              strokeOpacity="0.25"
            />

            {/* Glowing dots on main chart */}
            {[[0,140],[160,115],[320,88],[480,55],[640,30],[800,10]].map(([x,y], i) => (
              <circle key={i} cx={x} cy={y} r="3.5" fill="#6366f1" fillOpacity="0.9" />
            ))}

            {/* Rocket icon — top right */}
            <g transform="translate(720, 18) rotate(-45)" opacity="0.35">
              <ellipse cx="0" cy="0" rx="6" ry="14" fill="white" />
              <polygon points="-6,8 6,8 0,18" fill="white" />
              <circle cx="0" cy="-4" r="3" fill="#0a0a0a" />
            </g>

            {/* Stars / data points scattered */}
            {[[50,30],[150,50],[250,20],[450,35],[550,18],[680,45],[750,60]].map(([x,y],i) => (
              <circle key={i} cx={x} cy={y} r="1.2" fill="white" fillOpacity="0.3" />
            ))}

            {/* "LAUNCHPAD" wordmark faint watermark */}
            <text x="30" y="150" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="700" letterSpacing="4" fill="white" fillOpacity="0.08" textAnchor="start">
              LAUNCHPAD
            </text>

            {/* Right-side indigo glow */}
            <radialGradient id="glow" cx="85%" cy="20%" r="35%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
            <rect width="800" height="160" fill="url(#glow)" />
          </svg>
        </div>

        <div className="px-5 sm:px-6 pb-5">
          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-3">
            <div className="relative">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white shadow-md"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-indigo-100 border-4 border-white shadow-md flex items-center justify-center">
                  <span className="text-indigo-700 font-bold text-2xl">{initials}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/profile/edit')}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 border-2 border-gray-300 hover:border-gray-500 px-4 py-1.5 rounded-full transition-colors"
            >
              <Edit3 size={13} /> Edit Profile
            </button>
          </div>

          {/* Name & title */}
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{currentUser.name}</h1>
          <p className="text-sm text-gray-600 mt-0.5 capitalize">{role} · Launchpad</p>

          {/* Location + email */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {extra.location && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin size={12} /> {extra.location}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Mail size={12} /> {currentUser.email}
            </span>
            {extra.linkedIn && (
              <a
                href={extra.linkedIn}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink size={12} /> LinkedIn
              </a>
            )}
          </div>

          {/* Follower stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Users size={13} className="text-gray-400" />
              <span className="font-semibold text-gray-700">34K</span> followers
            </div>
            <div className="w-px h-3 bg-gray-200" />
            <div className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700">500+</span> connections
            </div>
          </div>

          {/* Skills pills */}
          {extra.expertise.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {extra.expertise.map(tag => (
                <span key={tag} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Card 2: About ────────────────────────────────────── */}
      {extra.bio && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-bold text-gray-900 mb-3">About</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{extra.bio}</p>
        </div>
      )}

      {/* ── Card 3: Experience ───────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Experience</h2>
        <div className="space-y-4">
          {EXPERIENCE.map((exp, i) => (
            <div key={i} className="flex gap-3">
              <div className={`w-10 h-10 rounded-lg ${exp.color} flex items-center justify-center flex-shrink-0`}>
                <Building2 size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{exp.role}</p>
                <p className="text-xs text-gray-600">{exp.company}</p>
                <p className="text-xs text-gray-400 mt-0.5">{exp.period}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card 4: Education ────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Education</h2>
        <div className="space-y-4">
          {EDUCATION.map((edu, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{edu.school}</p>
                <p className="text-xs text-gray-600">{edu.degree}</p>
                <p className="text-xs text-gray-400 mt-0.5">{edu.period}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card 5: Activity ─────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900">Activity</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">34,000 followers</p>
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center">
          <Briefcase size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No recent posts yet</p>
          <p className="text-xs text-gray-400 mt-0.5">Posts shared on Launchpad will appear here</p>
        </div>
      </div>

      {/* ── Sign Out ─────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
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

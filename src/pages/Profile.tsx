import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Mail, LogOut, Edit3, ExternalLink, Link2, Phone, Briefcase, Building2, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PageHeader } from '../components/layout/PageHeader';
import { loadCachedProfile } from '../services/crmAppUsers';

/* ── Profile data: CRM appUser > local cache > old localStorage ──── */
interface ProfileExtra {
  bio: string;
  location: string;
  twitter: string;
  linkedIn: string;
  expertise: string[];
}

function loadExtra(appUser: Record<string, unknown> | null): ProfileExtra {
  // Priority: appUser from CRM > locally cached profile > old lp_profile_extra
  if (appUser) {
    const expertise = appUser.expertise as string[] | undefined;
    if (appUser.bio || appUser.location || (expertise && expertise.length > 0) || appUser.linkedIn || appUser.twitter) {
      return {
        bio:       (appUser.bio as string) || '',
        location:  (appUser.location as string) || '',
        twitter:   (appUser.twitter as string) || '',
        linkedIn:  (appUser.linkedIn as string) || '',
        expertise: expertise || [],
      };
    }
  }

  // Check locally cached profile (from crmAppUsers service)
  const cached = loadCachedProfile();
  if (cached && (cached.bio || cached.location || cached.expertise?.length || cached.linkedIn || cached.twitter)) {
    return {
      bio:       cached.bio || '',
      location:  cached.location || '',
      twitter:   cached.twitter || '',
      linkedIn:  cached.linkedIn || '',
      expertise: cached.expertise || [],
    };
  }

  // Fallback to old localStorage key
  try {
    const raw = localStorage.getItem('lp_profile_extra');
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }

  return { bio: '', location: '', twitter: '', linkedIn: '', expertise: [] };
}

/* ── Profile Page ───────────────────────────────────────────── */
export default function Profile() {
  const { currentUser, role, logout, zohoEmail, zohoProfile, appUser, coverImage } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [extra] = useState<ProfileExtra>(() => loadExtra(appUser as unknown as Record<string, unknown> | null));

  const displayEmail = appUser?.email || zohoProfile.email || zohoEmail || currentUser.email;
  const location = extra.location || appUser?.location || [zohoProfile.state, zohoProfile.country].filter(Boolean).join(', ') || null;
  const phone = appUser?.phone || zohoProfile.phone || appUser?.mobile || zohoProfile.mobile || null;
  const jobTitle = appUser?.jobTitle || zohoProfile.jobTitle || null;

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
    || extra.linkedIn || extra.twitter || phone || location || jobTitle;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl mx-auto">

      <PageHeader
        title={t.profile.title}
        description={t.profile.description}
        action={
          <button
            onClick={() => navigate('/profile/edit')}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <Edit3 size={14} /> {t.profile.editProfile}
          </button>
        }
      />

      {/* Main layout: fixed-width left + fluid right */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* LEFT column */}
        <div className="w-full lg:max-w-[600px] flex-shrink-0 space-y-4">

          {/* Identity card */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">

            {/* Cover image */}
            <div className="h-40 sm:h-52 relative overflow-hidden">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt="cover"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    (e.currentTarget.parentElement as HTMLElement).style.background = 'linear-gradient(135deg,#1e1b4b,#312e81)';
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>

            <div className="px-6 pb-6">
              {/* Avatar overlapping cover */}
              <div className="-mt-12 mb-4 w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden flex-shrink-0 relative bg-indigo-100">
                {/* Initials — always behind */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-indigo-700 font-bold text-xl">{initials}</span>
                </div>
                {currentUser.avatar && (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="relative w-full h-full object-cover object-center bg-white"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    onLoad={(e) => { const img = e.currentTarget; if (img.naturalWidth < 4 || img.naturalHeight < 4) img.style.display = 'none'; }}
                  />
                )}
              </div>

              {/* Name + role */}
              <h2 className="text-lg font-bold text-gray-900">{currentUser.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {jobTitle ? `${jobTitle} · ` : ''}<span className="capitalize">{role}</span>
              </p>

              {/* Details */}
              <div className="mt-5 space-y-2.5">
                {displayEmail && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Mail size={14} className="text-gray-400 flex-shrink-0" />
                  {displayEmail}
                </div>
                )}
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
                {jobTitle && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
                    {jobTitle}
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
          </div>

          {/* About */}
          {extra.bio && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.profile.about}</h3>
              <div className="space-y-3">
                {extra.bio.split('\n\n').map((para, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed">{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t.profile.yearsExperience, value: '20+', icon: <Calendar size={14} className="text-indigo-400" /> },
              { label: t.profile.companiesBuilt, value: '3', icon: <Building2 size={14} className="text-emerald-400" /> },
              { label: t.profile.startupsMentored, value: '50+', icon: <Briefcase size={14} className="text-amber-400" /> },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
                <div className="flex justify-center mb-1.5">{s.icon}</div>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 leading-tight mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {!hasExtra && (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center">
              <p className="text-sm text-gray-500 mb-1">{t.profile.profileIncomplete}</p>
              <p className="text-xs text-gray-400 mb-4">{t.profile.addBioLocationSkills}</p>
              <button
                onClick={() => navigate('/profile/edit')}
                className="inline-flex items-center gap-2 text-sm font-medium bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <Edit3 size={13} /> {t.profile.completeProfile}
              </button>
            </div>
          )}

          {/* Sign Out */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{t.profile.signOut}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.profile.signOutDesc}</p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-4 py-2 rounded-xl transition-colors"
              >
                <LogOut size={14} /> {t.profile.signOut}
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT column */}
        <div className="w-full lg:w-[300px] flex-shrink-0 space-y-4">

          {/* Current Company */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t.profile.currentCompany}</h3>
            <div className="space-y-4">
              {[
                { name: 'Launchpad', role: 'Founder & CEO', period: '2024 – Present', color: 'bg-black' },
                { name: 'Mudhal Partners', role: 'Co-founder', period: '2020 – Present', color: 'bg-emerald-600' },
              ].map(c => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${c.color} flex items-center justify-center flex-shrink-0`}>
                    <Building2 size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.role} · {c.period}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills & Expertise */}
          {extra.expertise.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t.profile.skillsExpertise}</h3>
              <div className="flex flex-wrap gap-2">
                {extra.expertise.map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

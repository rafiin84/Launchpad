import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Mail, LogOut, Edit3, ExternalLink, Link2, Phone, Briefcase, Building2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PageHeader } from '../components/layout/PageHeader';
import { loadCachedProfile } from '../services/crmAppUsers';
import { fetchMyContactId, fetchMyFounderProfile, fetchMyFounderPhoto, type CRMFounder } from '../services/crmFounders';

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
  const { isFounder } = useAuth();
  return isFounder ? <FounderProfile /> : <InvestorProfile />;
}

function InvestorProfile() {
  const { currentUser, role, logout, zohoEmail, zohoProfile, appUser, coverImage } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [extra] = useState<ProfileExtra>(() => loadExtra(appUser as unknown as Record<string, unknown> | null));

  const displayEmail = appUser?.email || zohoProfile.email || zohoEmail || currentUser.email;
  const location = extra.location || appUser?.location || [zohoProfile.state, zohoProfile.country].filter(Boolean).join(', ') || null;
  const phone = appUser?.phone || zohoProfile.phone || appUser?.mobile || zohoProfile.mobile || null;
  const jobTitle = appUser?.jobTitle || zohoProfile.jobTitle || null;
  const company = appUser?.company || null;

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
                {company && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                    {company}
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
          {company && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t.profile.currentCompany}</h3>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
                  <Building2 size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{company}</p>
                  {jobTitle && <p className="text-xs text-gray-500">{jobTitle}</p>}
                </div>
              </div>
            </div>
          )}

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

/* ── Founder Profile — sourced live from the Contacts module ─────────────── */
function FounderProfile() {
  const { currentUser, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [founder, setFounder] = useState<CRMFounder | null>(null);
  const [photo, setPhoto] = useState('');

  // Always re-fetch on mount so this page reflects the latest Contacts data
  // (e.g. right after coming back from Edit Profile, or if an investor edited
  // the founder's record directly in CRM).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const id = await fetchMyContactId();
        if (cancelled || !id) return;
        const [profile, p] = await Promise.all([fetchMyFounderProfile(id), fetchMyFounderPhoto(id)]);
        if (cancelled) return;
        if (profile) setFounder(profile);
        if (p) setPhoto(p);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const displayName = founder ? [founder.firstName, founder.lastName].filter(Boolean).join(' ') || currentUser.name : currentUser.name;
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hasExtra = !!(founder?.bio || founder?.location || founder?.skills.length || founder?.linkedIn || founder?.twitter);

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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* LEFT column */}
          <div className="w-full lg:max-w-[600px] flex-shrink-0 space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="h-40 sm:h-52 relative overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>

              <div className="px-6 pb-6">
                <div className="-mt-12 mb-4 w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden flex-shrink-0 relative bg-indigo-100">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-indigo-700 font-bold text-xl">{initials}</span>
                  </div>
                  {photo && (
                    <img
                      src={photo}
                      alt={displayName}
                      className="relative w-full h-full object-cover object-center bg-white"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>

                <h2 className="text-lg font-bold text-gray-900">{displayName}</h2>
                <p className="text-sm text-gray-500 mt-0.5 capitalize">{t.login.founder}</p>

                <div className="mt-5 space-y-2.5">
                  {founder?.email && (
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Mail size={14} className="text-gray-400 flex-shrink-0" />
                      {founder.email}
                    </div>
                  )}
                  {founder?.mobile && (
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Phone size={14} className="text-gray-400 flex-shrink-0" />
                      {founder.mobile}
                    </div>
                  )}
                  {founder?.location && (
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                      {founder.location}
                    </div>
                  )}
                  {founder?.company && (
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
                      {founder.company}
                    </div>
                  )}
                  {founder?.linkedIn && (
                    <a
                      href={founder.linkedIn.startsWith('http') ? founder.linkedIn : `https://${founder.linkedIn}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      <ExternalLink size={14} className="flex-shrink-0" />
                      LinkedIn
                    </a>
                  )}
                  {founder?.twitter && (
                    <a
                      href={`https://twitter.com/${founder.twitter.replace('@', '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      <Link2 size={14} className="flex-shrink-0" />
                      @{founder.twitter.replace('@', '')}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {founder?.bio && (
              <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.profile.about}</h3>
                <div className="space-y-3">
                  {founder.bio.split('\n\n').map((para, i) => (
                    <p key={i} className="text-sm text-gray-700 leading-relaxed">{para}</p>
                  ))}
                </div>
              </div>
            )}

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
            {founder?.company && (
              <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{t.profile.currentCompany}</h3>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
                    <Building2 size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{founder.company}</p>
                    {founder.title && <p className="text-xs text-gray-500">{founder.title}</p>}
                  </div>
                </div>
              </div>
            )}

            {founder && founder.skills.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t.profile.skillsExpertise}</h3>
                <div className="flex flex-wrap gap-2">
                  {founder.skills.map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

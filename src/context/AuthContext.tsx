import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { loadToken, clearToken, saveRole, loadRole, clearRole, loadUserName, clearUserName, saveUserName } from '../services/oauth';
import { fetchCurrentZohoUser, fetchUserPhoto, fetchZohoAccountsUser } from '../services/zohoApi';
import {
  findAppUserByEmail, fetchAppUserPhoto,
  loadCachedRecordId, clearCachedRecordId,
  loadCachedProfile, clearCachedProfile, clearModuleStatusCache,
  type AppUser,
} from '../services/crmAppUsers';
import { loadPortalSession, clearPortalSession, type PortalSession } from '../services/portalUsers';

export interface ZohoProfile {
  email: string | null;
  phone: string | null;
  mobile: string | null;
  state: string | null;
  country: string | null;
  jobTitle: string | null;
}

interface AuthContextValue {
  currentUser: User;
  role: UserRole;
  isInvestor: boolean;
  isFounder: boolean;
  isLoggedIn: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  zohoEmail: string | null;
  zohoProfile: ZohoProfile;
  appUser: AppUser | null;
  appUserRecordId: string | null;
  portalSession: PortalSession | null;
  isPortalUser: boolean;
  coverImage: string;
  setCoverImage: (dataUrl: string) => void;
  /** Set avatar directly from a data URL (local fallback when CRM isn't available) */
  setProfileImage: (dataUrl: string) => void;
  refreshAvatar: () => void;
  /** Force-reload appUser data from CRM */
  refreshAppUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AVATAR_CACHE_KEY = 'lp_avatar_data';
const COVER_CACHE_KEY  = 'lp_cover_image';

function buildUser(role: UserRole, name?: string | null): User {
  const displayName = name || (role === 'investor' ? 'Investor' : 'Founder');
  return {
    id: role === 'investor' ? 'investor-1' : 'founder-1',
    name: displayName,
    email: `${role}@launchpad.app`,
    avatar: '',
    role,
    bio: '',
    expertise: [],
    joinedAt: new Date().toISOString(),
  };
}

function getInitialState(): { role: UserRole; isLoggedIn: boolean } {
  const token = loadToken();
  const savedRole = loadRole() as UserRole | null;
  if (token && savedRole) {
    return { role: savedRole, isLoggedIn: true };
  }
  // Check if there's a portal session with a valid token
  const session = loadPortalSession();
  if (token && session) {
    return { role: session.role, isLoggedIn: true };
  }
  return { role: 'investor', isLoggedIn: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = getInitialState();
  const [role, setRole] = useState<UserRole>(initial.role);
  const [isLoggedIn, setIsLoggedIn] = useState(initial.isLoggedIn);
  const [userName, setUserName] = useState<string | null>(loadUserName);
  // Initialize avatar from localStorage cache immediately (no flash)
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    try { return localStorage.getItem(AVATAR_CACHE_KEY) || ''; } catch { return ''; }
  });
  const [coverImage, setCoverImageState] = useState<string>(() => {
    try { return localStorage.getItem(COVER_CACHE_KEY) || ''; } catch { return ''; }
  });
  const [zohoEmail, setZohoEmail] = useState<string | null>(null);
  const [zohoProfile, setZohoProfile] = useState<ZohoProfile>({
    email: null, phone: null, mobile: null, state: null, country: null, jobTitle: null,
  });
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [appUserRecordId, setAppUserRecordId] = useState<string | null>(loadCachedRecordId);
  const [portalSession, setPortalSession] = useState<PortalSession | null>(loadPortalSession);

  // Fetch photo from appusers record image API
  const fetchAvatarFromAppUsers = useCallback(async (recordId: string) => {
    try {
      const dataUrl = await fetchAppUserPhoto(recordId);
      if (dataUrl) {
        setAvatarUrl(dataUrl);
        try { localStorage.setItem(AVATAR_CACHE_KEY, dataUrl); } catch { /* ok */ }
        return true;
      }
    } catch { /* fallback below */ }
    return false;
  }, []);

  // Fetch Zoho profile data once on login
  useEffect(() => {
    const token = loadToken();
    if (!token) return;

    fetchCurrentZohoUser().then(async (user) => {
      if (!user) {
        // CRM Users API failed (e.g. portal user) — try Zoho Accounts API
        try {
          const accountsUser = await fetchZohoAccountsUser();
          if (accountsUser?.email) {
            setZohoEmail(accountsUser.email);
            const name = accountsUser.display_name
              || [accountsUser.first_name, accountsUser.last_name].filter(Boolean).join(' ');
            if (name && name !== 'Founder') {
              setUserName(name);
              saveUserName(name);
            }
            setZohoProfile({
              email: accountsUser.email,
              phone: null, mobile: null, state: null, country: null, jobTitle: null,
            });
            // Try to get photo from accounts
            if (accountsUser.picture) {
              setAvatarUrl(accountsUser.picture);
              try { localStorage.setItem(AVATAR_CACHE_KEY, accountsUser.picture); } catch { /* ok */ }
            } else if (accountsUser.zuid) {
              setAvatarUrl(`https://profile.zoho.in/file?ID=${accountsUser.zuid}&fs=medium`);
            }
          }
        } catch { /* ok — truly offline */ }
        return;
      }

      const u = user as unknown as Record<string, unknown>;
      const zuid = (user.Zuid ?? user.zuid ?? null) as string | null;
      if (user.email) setZohoEmail(user.email);
      setZohoProfile({
        email:    user.email ?? null,
        phone:    (u['phone'] as string) ?? null,
        mobile:   (u['mobile'] as string) ?? null,
        state:    (u['state'] as string) ?? null,
        country:  (u['country'] as string) ?? null,
        jobTitle: ((u['role'] as Record<string, string>)?.name) ?? null,
      });

      // Try to load appUser profile and photo from appusers module
      if (user.email) {
        try {
          const found = await findAppUserByEmail(user.email);
          if (found) {
            setAppUser(found);
            setAppUserRecordId(found.id);

            // Use appUser name if available
            if (found.name) setUserName(found.name);

            // Fetch photo from appusers record image API
            const gotPhoto = await fetchAvatarFromAppUsers(found.id);
            if (gotPhoto) return; // done — got photo from appusers
          }
        } catch { /* fallback below */ }
      }

      // Fallback: also try cached record ID
      const cachedId = loadCachedRecordId();
      if (cachedId) {
        setAppUserRecordId(cachedId);
        const gotPhoto = await fetchAvatarFromAppUsers(cachedId);
        if (gotPhoto) return;
      }

      // Final fallback: Zoho Accounts photo or profile URL
      try {
        const photoUrl = await fetchUserPhoto();
        if (photoUrl) {
          setAvatarUrl(photoUrl);
          try { localStorage.setItem(AVATAR_CACHE_KEY, photoUrl); } catch { /* ok */ }
        } else if (zuid) {
          setAvatarUrl(`https://profile.zoho.in/file?ID=${zuid}&fs=medium`);
        }
      } catch {
        if (zuid) setAvatarUrl(`https://profile.zoho.in/file?ID=${zuid}&fs=medium`);
      }
    }).catch(() => {});
  }, [isLoggedIn, fetchAvatarFromAppUsers]);

  // Derive display name: appUser name > locally cached name > portal session name > Zoho name > role default
  const cachedProfile = loadCachedProfile();
  const displayName = appUser?.name || cachedProfile?.name || userName || portalSession?.name;
  const realEmail = zohoEmail || portalSession?.email || undefined;
  const currentUser: User = {
    ...buildUser(role, displayName),
    avatar: avatarUrl,
    ...(realEmail ? { email: realEmail } : {}),
  };

  function login(selectedRole: UserRole) {
    saveRole(selectedRole);
    setRole(selectedRole);
    const name = loadUserName();
    setUserName(name);
    setIsLoggedIn(true);
  }

  function logout() {
    clearToken();
    clearRole();
    clearUserName();
    clearCachedRecordId();
    clearModuleStatusCache();
    clearPortalSession();
    // Don't clear profile cache or cover image on logout — preserve for next login
    try { localStorage.removeItem(AVATAR_CACHE_KEY); } catch { /* ok */ }
    setAvatarUrl('');
    setUserName(null);
    setAppUser(null);
    setAppUserRecordId(null);
    setPortalSession(null);
    setIsLoggedIn(false);
  }

  /** Save cover image as data URL */
  const setCoverImage = useCallback((dataUrl: string) => {
    setCoverImageState(dataUrl);
    try { localStorage.setItem(COVER_CACHE_KEY, dataUrl); } catch { /* ok */ }
  }, []);

  /** Set avatar directly from a data URL (local fallback) */
  const setProfileImage = useCallback((dataUrl: string) => {
    setAvatarUrl(dataUrl);
    try { localStorage.setItem(AVATAR_CACHE_KEY, dataUrl); } catch { /* ok */ }
  }, []);

  /** Re-fetch avatar from appusers (call after uploading a new photo) */
  const refreshAvatar = useCallback(() => {
    const rid = appUserRecordId || loadCachedRecordId();
    if (rid) {
      fetchAvatarFromAppUsers(rid);
    }
  }, [appUserRecordId, fetchAvatarFromAppUsers]);

  /** Force-reload appUser data from CRM */
  const refreshAppUser = useCallback(async () => {
    const email = zohoEmail || appUser?.email;
    if (!email) return;
    try {
      const found = await findAppUserByEmail(email);
      if (found) {
        setAppUser(found);
        setAppUserRecordId(found.id);
        if (found.name) setUserName(found.name);
      }
    } catch { /* ok */ }
  }, [zohoEmail, appUser?.email]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        isInvestor: role === 'investor',
        isFounder: role === 'founder',
        isLoggedIn,
        login,
        logout,
        zohoEmail,
        zohoProfile,
        appUser,
        appUserRecordId,
        portalSession,
        isPortalUser: portalSession?.isPortalUser ?? false,
        coverImage,
        setCoverImage,
        setProfileImage,
        refreshAvatar,
        refreshAppUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

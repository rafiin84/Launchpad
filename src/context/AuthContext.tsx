import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { loadToken, clearToken, saveRole, loadRole, clearRole, loadUserName, clearUserName } from '../services/oauth';
import { fetchCurrentZohoUser, fetchUserPhoto } from '../services/zohoApi';
import { findAppUserByEmail, fetchAppUserPhoto, loadCachedRecordId, clearCachedRecordId, type AppUser } from '../services/crmAppUsers';

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
  refreshAvatar: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AVATAR_CACHE_KEY = 'lp_avatar_data';

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
  return { role: 'investor', isLoggedIn: false };
}

/**
 * Fetch avatar via our Vercel serverless proxy (/api/avatar).
 * The proxy fetches from Zoho server-side — no CORS issues on any device.
 * Returns a data: URL for caching, or null on failure.
 */
async function fetchAvatarViaProxy(token: string, userId: string, zuid: string | null): Promise<string | null> {
  try {
    const params = new URLSearchParams({ token });
    if (zuid) params.set('zuid', zuid);
    if (userId) params.set('userId', userId);

    const res = await fetch(`/api/avatar?${params.toString()}`);
    if (!res.ok) return null;

    const blob = await res.blob();
    if (!blob.size || blob.type.includes('json') || blob.type.includes('html')) return null;

    // Convert to data URL for localStorage caching
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result?.startsWith('data:') ? result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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
  const [zohoEmail, setZohoEmail] = useState<string | null>(null);
  const [zohoProfile, setZohoProfile] = useState<ZohoProfile>({
    email: null, phone: null, mobile: null, state: null, country: null, jobTitle: null,
  });
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [appUserRecordId, setAppUserRecordId] = useState<string | null>(loadCachedRecordId);

  // Fetch photo from appusers record image API
  const fetchAvatarFromAppUsers = async (recordId: string) => {
    try {
      const dataUrl = await fetchAppUserPhoto(recordId);
      if (dataUrl) {
        setAvatarUrl(dataUrl);
        localStorage.setItem(AVATAR_CACHE_KEY, dataUrl);
        return true;
      }
    } catch { /* fallback below */ }
    return false;
  };

  // Fetch Zoho profile data once on login
  useEffect(() => {
    const token = loadToken();
    if (!token) return;

    fetchCurrentZohoUser().then(async (user) => {
      if (!user) return;
      const u = user as unknown as Record<string, unknown>;
      const zuid = (user.Zuid ?? user.zuid ?? null) as string | null;
      if (user.email) setZohoEmail(user.email);
      setZohoProfile({
        email:    user.email ?? null,
        phone:    (u['phone'] as string) ?? null,
        mobile:   (u['mobile'] as string) ?? null,
        state:    (u['state'] as string) ?? null,
        country:  (u['country'] as string) ?? null,
        jobTitle: ((u['role'] as Record<string,string>)?.name) ?? null,
      });

      // Try to load appUser profile and photo from appusers module
      if (user.email) {
        try {
          const found = await findAppUserByEmail(user.email);
          if (found) {
            setAppUser(found);
            setAppUserRecordId(found.id);

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
          localStorage.setItem(AVATAR_CACHE_KEY, photoUrl);
        } else if (zuid) {
          setAvatarUrl(`https://profile.zoho.in/file?ID=${zuid}&fs=medium`);
        }
      } catch {
        if (zuid) setAvatarUrl(`https://profile.zoho.in/file?ID=${zuid}&fs=medium`);
      }
    }).catch(() => {});
  }, [isLoggedIn]);

  // Use appUser name if available (they may have updated it via EditProfile)
  const displayName = appUser?.name || userName;
  const currentUser: User = { ...buildUser(role, displayName), avatar: avatarUrl };

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
    try { localStorage.removeItem(AVATAR_CACHE_KEY); } catch { /* ok */ }
    setAvatarUrl('');
    setUserName(null);
    setAppUser(null);
    setAppUserRecordId(null);
    setIsLoggedIn(false);
  }

  /** Re-fetch avatar from appusers (call after uploading a new photo) */
  function refreshAvatar() {
    const rid = appUserRecordId || loadCachedRecordId();
    if (rid) {
      fetchAvatarFromAppUsers(rid);
    }
  }

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
        refreshAvatar,
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

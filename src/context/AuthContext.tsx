import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { loadToken, clearToken, saveRole, loadRole, clearRole, loadUserName, clearUserName } from '../services/oauth';
import { fetchCurrentZohoUser, fetchUserPhoto } from '../services/zohoApi';

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
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = getInitialState();
  const [role, setRole] = useState<UserRole>(initial.role);
  const [isLoggedIn, setIsLoggedIn] = useState(initial.isLoggedIn);
  const [userName, setUserName] = useState<string | null>(loadUserName);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [zohoEmail, setZohoEmail] = useState<string | null>(null);
  const [zohoProfile, setZohoProfile] = useState<ZohoProfile>({
    email: null, phone: null, mobile: null, state: null, country: null, jobTitle: null,
  });

  // Fetch Zoho profile data once on login
  useEffect(() => {
    if (!loadToken()) return;
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

      // Fetch profile photo via OAuth API (works on all devices including mobile)
      // Check localStorage cache first
      const AVATAR_CACHE_KEY = 'lp_avatar_data';
      const cached = localStorage.getItem(AVATAR_CACHE_KEY);
      if (cached) {
        setAvatarUrl(cached);
      }

      // Always try to refresh from API
      try {
        const photoUrl = await fetchUserPhoto(user.id, zuid ?? undefined);
        if (photoUrl) {
          setAvatarUrl(photoUrl);
          // Cache as data URL in localStorage for persistence
          try {
            const res = await fetch(photoUrl);
            const blob = await res.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              if (dataUrl && dataUrl.startsWith('data:')) {
                localStorage.setItem(AVATAR_CACHE_KEY, dataUrl);
                setAvatarUrl(dataUrl);
              }
            };
            reader.readAsDataURL(blob);
          } catch { /* blob URL works fine even if caching fails */ }
        }
      } catch {
        // If API photo fetch fails, fall back to cookie-based URL (works on desktop)
        if (zuid) setAvatarUrl(`https://profile.zoho.in/file?ID=${zuid}&fs=medium`);
      }
    }).catch(() => {});
  }, [isLoggedIn]);

  const currentUser: User = { ...buildUser(role, userName), avatar: avatarUrl };

  function login(selectedRole: UserRole) {
    saveRole(selectedRole);
    setRole(selectedRole);
    // Reload name in case it was just saved by Callback
    const name = loadUserName();
    setUserName(name);
    setIsLoggedIn(true);
  }

  function logout() {
    clearToken();
    clearRole();
    clearUserName();
    setUserName(null);
    setIsLoggedIn(false);
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

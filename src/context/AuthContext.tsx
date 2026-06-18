import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { loadToken, clearToken, saveRole, loadRole, clearRole, loadUserName, clearUserName } from '../services/oauth';
import { fetchCurrentZohoUser } from '../services/zohoApi';

interface AuthContextValue {
  currentUser: User;
  role: UserRole;
  isInvestor: boolean;
  isFounder: boolean;
  isLoggedIn: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  zohoEmail: string | null;
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

  // Fetch Zoho profile photo + real email once on login
  useEffect(() => {
    if (!loadToken()) return;
    fetchCurrentZohoUser().then(user => {
      if (!user) return;
      const zuid = user.Zuid ?? user.zuid ?? null;
      if (zuid) setAvatarUrl(`https://profile.zoho.in/file?ID=${zuid}&fs=thumb`);
      if (user.email) setZohoEmail(user.email);
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

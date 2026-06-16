import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { loadToken, clearToken, saveRole, loadRole, clearRole, loadUserName, clearUserName } from '../services/oauth';

interface AuthContextValue {
  currentUser: User;
  role: UserRole;
  isInvestor: boolean;
  isFounder: boolean;
  isLoggedIn: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
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

  const currentUser: User = buildUser(role, userName);

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

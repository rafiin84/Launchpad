import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { mockFounder, mockInvestor } from '../data/mockData';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('founder');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const currentUser: User = role === 'investor' ? mockInvestor : mockFounder;

  function login(selectedRole: UserRole) {
    setRole(selectedRole);
    setIsLoggedIn(true);
  }

  function logout() {
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

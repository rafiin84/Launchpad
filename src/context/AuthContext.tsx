import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, UserRole } from '../types';
import { mockFounder, mockInvestor } from '../data/mockData';

interface AuthContextValue {
  currentUser: User;
  role: UserRole;
  switchRole: (role: UserRole) => void;
  isInvestor: boolean;
  isFounder: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(mockFounder);

  const switchRole = useCallback((role: UserRole) => {
    setCurrentUser(role === 'investor' ? mockInvestor : mockFounder);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser.role,
        switchRole,
        isInvestor: currentUser.role === 'investor',
        isFounder: currentUser.role === 'founder',
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

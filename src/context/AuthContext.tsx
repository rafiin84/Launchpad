import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { loadToken, clearToken, saveRole, loadRole, clearRole, loadUserName, clearUserName, saveUserName, loadPortalLoginEmail } from '../services/oauth';
import { fetchCurrentZohoUser, fetchUserPhoto, fetchZohoAccountsUser, searchContactByEmail, searchContactByEmailV6, fetchPortalUserContact } from '../services/zohoApi';
import {
  findAppUserByEmail, fetchAppUserPhoto,
  loadCachedRecordId, clearCachedRecordId,
  clearCachedProfile, clearModuleStatusCache,
  type AppUser,
} from '../services/crmAppUsers';
import { loadPortalSession, savePortalSession, clearPortalSession, type PortalSession } from '../services/portalUsers';

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
  founderCompanyName: string;
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
const FOUNDER_COMPANY_KEY = 'lp_founder_company';

function loadFounderCompanyName(): string {
  try {
    const raw = localStorage.getItem(FOUNDER_COMPANY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.name || '';
    }
  } catch { /* ok */ }
  return '';
}

function buildUser(role: UserRole, name?: string | null, email?: string | null): User {
  const displayName = name || (role === 'investor' ? 'Investor' : 'Founder');
  return {
    id: role === 'investor' ? 'investor-1' : 'founder-1',
    name: displayName,
    email: email || '',
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
  // Initialize zohoEmail from portal session immediately so it's available on first render
  const [zohoEmail, setZohoEmail] = useState<string | null>(() => {
    const session = loadPortalSession();
    return session?.email || null;
  });
  const [zohoProfile, setZohoProfile] = useState<ZohoProfile>({
    email: null, phone: null, mobile: null, state: null, country: null, jobTitle: null,
  });
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [appUserRecordId, setAppUserRecordId] = useState<string | null>(loadCachedRecordId);
  const [portalSession, setPortalSession] = useState<PortalSession | null>(loadPortalSession);
  const [founderCompanyName, setFounderCompanyName] = useState(loadFounderCompanyName);

  // Re-read founder company name when localStorage changes (e.g. after saving on Company page)
  useEffect(() => {
    const onStorage = () => setFounderCompanyName(loadFounderCompanyName());
    window.addEventListener('storage', onStorage);
    window.addEventListener('founder-company-updated', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('founder-company-updated', onStorage);
    };
  }, []);

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
      console.log('[Auth] fetchCurrentZohoUser result:', user);
      if (!user) {
        console.log('[Auth] No CRM user returned — entering portal user flow');
        const isRealN = (n: string | undefined | null) => !!n && n !== 'Founder' && n !== 'Investor' && n !== 'User';
        let resolvedEmail = '';
        let resolvedName = '';
        let resolvedContactId = '';

        const session = loadPortalSession();

        const updateNameAndSession = (name: string, cId?: string, em?: string) => {
          resolvedName = name;
          setUserName(name);
          saveUserName(name);
          if (em) {
            resolvedEmail = em;
            setZohoEmail(em);
          }
          if (session) {
            const updated = { ...session, name, email: em || session.email, contactId: cId || session.contactId };
            savePortalSession(updated);
            setPortalSession(updated);
          }
        };

        // ── PRIMARY: Fetch portal user's own Contact record from CRM ──
        // Portal tokens have ZohoCRM.modules.ALL and can only see their own Contact.
        // This works even when Accounts API returns INVALID_OAUTHSCOPE.
        try {
          const myContact = await fetchPortalUserContact();
          console.log('[Auth] fetchPortalUserContact result:', myContact);
          if (myContact) {
            if (myContact.email) {
              resolvedEmail = myContact.email;
              setZohoEmail(myContact.email);
              setZohoProfile({ email: myContact.email, phone: null, mobile: null, state: null, country: null, jobTitle: null });
            }
            if (isRealN(myContact.name)) {
              updateNameAndSession(myContact.name, myContact.contactId, myContact.email);
              resolvedContactId = myContact.contactId;
            }
          }
        } catch (err) { console.warn('[Auth] fetchPortalUserContact error:', err); }

        // ── FALLBACK: Zoho Accounts API (may fail with INVALID_OAUTHSCOPE) ──
        if (!resolvedEmail) {
          try {
            const accountsUser = await fetchZohoAccountsUser();
            console.log('[Auth] fetchZohoAccountsUser result:', accountsUser);
            if (accountsUser?.email) {
              resolvedEmail = accountsUser.email;
              setZohoEmail(accountsUser.email);
              if (!isRealN(resolvedName)) {
                const name = accountsUser.display_name
                  || [accountsUser.first_name, accountsUser.last_name].filter(Boolean).join(' ');
                if (isRealN(name)) updateNameAndSession(name, undefined, accountsUser.email);
              }
              setZohoProfile({ email: accountsUser.email, phone: null, mobile: null, state: null, country: null, jobTitle: null });
              if (accountsUser.picture) {
                setAvatarUrl(accountsUser.picture);
                try { localStorage.setItem(AVATAR_CACHE_KEY, accountsUser.picture); } catch { /* ok */ }
              } else if (accountsUser.zuid) {
                setAvatarUrl(`https://profile.zoho.in/file?ID=${accountsUser.zuid}&fs=medium`);
              }
            }
          } catch { /* ok */ }
        }

        // Use portal session email, or the email captured on login page
        const loginEmail = loadPortalLoginEmail();
        const emailForLookup = resolvedEmail || session?.email || loginEmail || '';

        // If still no name, use name from session (may have been set by PortalCallback)
        if (!isRealN(resolvedName) && session?.name && isRealN(session.name)) {
          updateNameAndSession(session.name, session.contactId, session.email);
        }

        // ── FALLBACK 2: Search CRM Contacts directly (v6 then v2) ──
        console.log('[Auth] Portal flow — emailForLookup:', emailForLookup, 'resolvedName:', resolvedName);
        if (emailForLookup && !isRealN(resolvedName)) {
          try {
            const contact = await searchContactByEmailV6(emailForLookup);
            console.log('[Auth] searchContactByEmailV6 result:', contact);
            if (contact?.name && isRealN(contact.name)) {
              updateNameAndSession(contact.name, contact.contactId);
            }
          } catch (err) { console.warn('[Auth] searchContactByEmailV6 error:', err); }
          if (!isRealN(resolvedName)) {
            try {
              const contact = await searchContactByEmail(emailForLookup);
              console.log('[Auth] searchContactByEmail result:', contact);
              if (contact?.name && isRealN(contact.name)) {
                updateNameAndSession(contact.name, contact.contactId);
              }
            } catch (err) { console.warn('[Auth] searchContactByEmail error:', err); }
          }
        }

        // Try to look up the user in the appusers CRM module via portal session email
        if (emailForLookup && !appUser) {
          try {
            const found = await findAppUserByEmail(emailForLookup);
            if (found) {
              setAppUser(found);
              setAppUserRecordId(found.id);
              if (found.name) {
                setUserName(found.name);
                saveUserName(found.name);
              }
              await fetchAvatarFromAppUsers(found.id);
            }
          } catch { /* ok */ }
        }
        return;
      }

      const u = user as unknown as Record<string, unknown>;
      console.log('Fetched Zoho user:', u);
      const zuid = (user.Zuid ?? user.zuid ?? null) as string | null;
      if (user.email) setZohoEmail(user.email);

      // Set display name from the CRM Users full_name if it's a real name
      if (user.full_name && user.full_name !== 'Founder' && user.full_name !== 'Investor') {
        setUserName(user.full_name);
        saveUserName(user.full_name);
      }

      // Always try to resolve name from Contacts by email (v6 first, then v2)
      console.log('[Auth] CRM user flow — searching Contacts for email:', user.email);
      if (user.email) {
        let found = false;
        try {
          const contact = await searchContactByEmailV6(user.email);
          console.log('[Auth] CRM user Contact search v6 result:', contact);
          if (contact?.name && contact.name !== 'Founder' && contact.name !== 'Investor') {
            setUserName(contact.name);
            saveUserName(contact.name);
            found = true;
          }
        } catch { /* ok */ }
        if (!found) {
          try {
            const contact = await searchContactByEmail(user.email);
            console.log('[Auth] CRM user Contact search v2 result:', contact);
            if (contact?.name && contact.name !== 'Founder' && contact.name !== 'Investor') {
              setUserName(contact.name);
              saveUserName(contact.name);
            }
          } catch { /* ok */ }
        }
      }

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

  // Derive display name from live/session sources only.
  // DO NOT use cachedProfile.name here — it may belong to a different user
  // who previously logged in on the same browser. The cached profile is only
  // safe for bio/location/expertise (non-identifying fields).
  const isRealName = (n: string | null | undefined): n is string =>
    !!n && n !== 'Founder' && n !== 'Investor' && n !== 'User';
  const displayName = (isRealName(userName) ? userName : null)
    || (isRealName(appUser?.name) ? appUser!.name : null)
    || (isRealName(portalSession?.name) ? portalSession!.name : null)
    || userName || portalSession?.name;
  const realEmail = zohoEmail || portalSession?.email || appUser?.email || '';
  const currentUser: User = {
    ...buildUser(role, displayName, realEmail),
    avatar: avatarUrl,
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
        founderCompanyName,
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

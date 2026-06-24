import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  consumePendingToken, saveToken, loadToken,
  saveUserName, clearRole,
} from '../services/oauth';
import { clearModuleStatusCache, loadCachedProfile } from '../services/crmAppUsers';
import { savePortalSession, clearPortalSession, findPortalUser, getAllPortalUsers } from '../services/portalUsers';
import { fetchZohoAccountsUser } from '../services/zohoApi';
import { useAuth } from '../context/AuthContext';

/** Clear session data before a new portal login.
 *  Preserve user-set profile data (name, bio, avatar, cover) so it
 *  persists across login sessions. */
function clearPreviousSession() {
  clearRole();
  clearModuleStatusCache();
  clearPortalSession();
  // Do NOT clear: userName, cachedProfile, avatar, cover image
  // — these are user-set and should persist across logins
}

export default function PortalCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [statusText, setStatusText] = useState('Connecting to Zoho Portal...');

  useEffect(() => {
    const pending = consumePendingToken();
    if (pending) {
      clearPreviousSession();
      saveToken(pending.token, pending.expiresAt);
      handlePortalLogin(pending.token);
      return;
    }

    // React StrictMode double-mount: token was already consumed
    const existing = loadToken();
    if (existing) {
      setStatus('success');
      const t = setTimeout(() => navigate('/'), 1500);
      return () => clearTimeout(t);
    }

    setStatus('error');
    setStatusText('No token received from portal. Please try again.');
    const t = setTimeout(() => navigate('/login'), 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePortalLogin(_token: string) {
    // Portal users are always founders
    setStatusText('Identifying your portal account...');

    let email = '';
    let displayName = '';
    let contactId = '';
    let zuid = '';

    // Helper: is this a real name (not a placeholder)?
    const isReal = (n: string) => !!n && n !== 'Founder' && n !== 'Investor' && n !== 'User';

    // 1. Try Zoho Accounts API for user identity (gets email + possibly name)
    try {
      const accountsUser = await fetchZohoAccountsUser();
      if (accountsUser?.email) {
        email = accountsUser.email;
        const accountsName = accountsUser.display_name
          || [accountsUser.first_name, accountsUser.last_name].filter(Boolean).join(' ')
          || '';
        if (isReal(accountsName)) displayName = accountsName;
        zuid = accountsUser.zuid || '';
      }
    } catch (err) {
      console.warn('[Portal Auth] Could not fetch accounts user:', err);
    }

    // 2. Check locally cached profile (user-set name from Edit Profile)
    const cachedProfile = loadCachedProfile();
    if (cachedProfile?.name && isReal(cachedProfile.name)) {
      displayName = cachedProfile.name;
    }

    // 3. Look up in portal user registry (set by admin during invitation)
    if (email) {
      const registryEntry = findPortalUser(email);
      if (registryEntry) {
        if (!isReal(displayName) && isReal(registryEntry.name)) {
          displayName = registryEntry.name;
        }
        contactId = registryEntry.contactId || '';
      }
    } else {
      // No email from API — try to match the most recently invited active user
      const allUsers = getAllPortalUsers();
      const active = allUsers.find(u => u.active);
      if (active) {
        email = active.email;
        if (!isReal(displayName) && isReal(active.name)) displayName = active.name;
        contactId = active.contactId || '';
      }
    }

    // 4. Call the server-side portal-identity API to resolve the real name
    //    from the CRM Contact record using the admin token.
    //    This is the most reliable source — works even when portal tokens
    //    can't access the CRM Users or Accounts API.
    if (email) {
      try {
        setStatusText('Resolving your profile...');
        const res = await fetch(`/api/portal-identity?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const identity = await res.json() as { name?: string; email?: string; contactId?: string };
          if (identity.name && isReal(identity.name)) {
            displayName = identity.name;
          }
          if (identity.contactId) contactId = identity.contactId;
          console.log('[Portal Auth] Resolved identity from CRM:', identity);
        }
      } catch (err) {
        console.warn('[Portal Auth] portal-identity API failed:', err);
      }
    }

    // 5. Only save a real name — never save the role-default "Founder"
    if (isReal(displayName)) {
      saveUserName(displayName);
    }
    savePortalSession({
      email,
      name: isReal(displayName) ? displayName : 'Founder',
      role: 'founder',
      contactId,
      zuid,
      isPortalUser: true,
    });

    login('founder');
    setStatus('success');
    setStatusText(isReal(displayName) ? `Welcome, ${displayName}! Redirecting to your dashboard...` : 'Welcome! Redirecting to your dashboard...');
    setTimeout(() => navigate('/'), 1500);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center mb-2">
        <Rocket size={18} className="text-white" />
      </div>

      {status === 'processing' && (
        <>
          <Loader2 size={28} className="text-indigo-500 animate-spin" />
          <p className="text-sm font-medium text-gray-700">{statusText}</p>
          <p className="text-xs text-gray-400">Signing in via Founder Portal</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle size={32} className="text-emerald-500" />
          <p className="text-sm font-semibold text-gray-900">Portal Connected!</p>
          <p className="text-xs text-gray-500">{statusText}</p>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={32} className="text-red-400" />
          <p className="text-sm font-semibold text-gray-700">{statusText}</p>
          <p className="text-xs text-gray-400">Redirecting back to login...</p>
        </>
      )}
    </div>
  );
}

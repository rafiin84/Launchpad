import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  consumePendingToken, saveToken, loadToken,
  saveUserName, clearRole, saveRole, saveApiDomain,
  loadPortalLoginEmail, clearPortalLoginEmail,
} from '../services/oauth';
import { clearModuleStatusCache } from '../services/crmAppUsers';
import { savePortalSession, clearPortalSession, findPortalUser, seedKnownPortalUsers } from '../services/portalUsers';
import { fetchZohoAccountsUser, searchContactByEmail, searchContactByEmailV6, fetchPortalUserContact } from '../services/zohoApi';
import { useAuth } from '../context/AuthContext';

/** Clear ALL user-specific session data before a new portal login.
 *  Must clear cached names/profiles to prevent a previous user's data
 *  from leaking into the new session. Cover image is decorative and safe to keep. */
function clearPreviousSession() {
  clearRole();
  clearModuleStatusCache();
  clearPortalSession();
  // Clear user-specific data that could leak between accounts
  try { localStorage.removeItem('lp_user_name'); } catch { /* ok */ }
  try { localStorage.removeItem('lp_appuser_profile_cache'); } catch { /* ok */ }
  try { localStorage.removeItem('lp_appuser_record_id'); } catch { /* ok */ }
  try { localStorage.removeItem('lp_avatar_data'); } catch { /* ok */ }
  // Keep cover image — it's decorative, not user-identifying
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
      saveRole('founder');
      if (pending.apiDomain) {
        saveApiDomain(pending.apiDomain);
        console.log('[Portal Auth] Saved api_domain:', pending.apiDomain);
      }
      console.log('[Portal Auth] Token info - api_domain:', pending.apiDomain, 'location:', pending.location);
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
    // Seed the registry with known portal users from CRM
    seedKnownPortalUsers();

    // Portal users are always founders
    setStatusText('Identifying your portal account...');

    let email = '';
    let displayName = '';
    let contactId = '';
    let zuid = '';

    const isReal = (n: string) => !!n && n !== 'Founder' && n !== 'Investor' && n !== 'User';

    // ── STRATEGY 0 (BEST): Email captured on login page ──
    // The user entered their email on the login page before the OAuth redirect.
    // This is the most reliable way to identify the portal user.
    const loginEmail = loadPortalLoginEmail();
    if (loginEmail) {
      email = loginEmail;
      console.log('[Portal Auth] Using email from login page:', email);
      clearPortalLoginEmail();

      // Look up in registry for name/contactId
      const registryEntry = findPortalUser(email);
      if (registryEntry) {
        if (isReal(registryEntry.name)) displayName = registryEntry.name;
        if (registryEntry.contactId) contactId = registryEntry.contactId;
        console.log('[Portal Auth] Found in registry:', registryEntry.name);
      }
    }

    // ── STRATEGY 1: Fetch portal user's Contact record from CRM ──
    if (!email || !isReal(displayName)) {
      try {
        setStatusText('Fetching your contact record...');
        const myContact = await fetchPortalUserContact();
        if (myContact) {
          if (!email && myContact.email) email = myContact.email;
          if (!isReal(displayName) && myContact.name && isReal(myContact.name)) displayName = myContact.name;
          if (!contactId && myContact.contactId) contactId = myContact.contactId;
          console.log('[Portal Auth] Got Contact record:', myContact);
        }
      } catch (err) {
        console.warn('[Portal Auth] Could not fetch Contact:', err);
      }
    }

    // ── STRATEGY 2: Zoho Accounts API ──
    if (!email) {
      try {
        const accountsUser = await fetchZohoAccountsUser();
        if (accountsUser?.email) {
          email = accountsUser.email;
          if (!isReal(displayName)) {
            const accountsName = accountsUser.display_name
              || [accountsUser.first_name, accountsUser.last_name].filter(Boolean).join(' ')
              || '';
            if (isReal(accountsName)) displayName = accountsName;
          }
          zuid = accountsUser.zuid || '';
        }
      } catch (err) {
        console.warn('[Portal Auth] Accounts API failed (expected for portal users):', err);
      }
    }

    // ── STRATEGY 3: Registry lookup (if we have email but no name yet) ──
    if (email && !isReal(displayName)) {
      const registryEntry = findPortalUser(email);
      if (registryEntry) {
        if (isReal(registryEntry.name)) displayName = registryEntry.name;
        if (!contactId) contactId = registryEntry.contactId || '';
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

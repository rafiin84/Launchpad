import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  consumePendingToken, saveToken, loadToken,
  saveUserName, clearRole,
} from '../services/oauth';
import { clearModuleStatusCache } from '../services/crmAppUsers';
import { savePortalSession, clearPortalSession, findPortalUser, getAllPortalUsers } from '../services/portalUsers';
import { fetchZohoAccountsUser, searchContactByEmail, fetchPortalUserContact } from '../services/zohoApi';
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

    // ── STRATEGY 1 (BEST): Fetch portal user's own Contact record from CRM ──
    // Portal tokens have ZohoCRM.modules.ALL scope and can only see their own
    // Contact record. This works even when Accounts API returns INVALID_OAUTHSCOPE.
    try {
      setStatusText('Fetching your contact record...');
      const myContact = await fetchPortalUserContact();
      if (myContact) {
        if (myContact.email) email = myContact.email;
        if (myContact.name && isReal(myContact.name)) displayName = myContact.name;
        if (myContact.contactId) contactId = myContact.contactId;
        console.log('[Portal Auth] Got own Contact record:', myContact);
      }
    } catch (err) {
      console.warn('[Portal Auth] Could not fetch own Contact:', err);
    }

    // ── STRATEGY 2: Zoho Accounts API (may fail with INVALID_OAUTHSCOPE) ──
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

    // ── STRATEGY 3: Portal user registry (admin-set during invitation) ──
    if (email) {
      const registryEntry = findPortalUser(email);
      if (registryEntry) {
        if (!isReal(displayName) && isReal(registryEntry.name)) {
          displayName = registryEntry.name;
        }
        if (!contactId) contactId = registryEntry.contactId || '';
      }
    } else {
      // No email at all — try most recently invited active user
      const allUsers = getAllPortalUsers();
      const active = allUsers.find(u => u.active);
      if (active) {
        email = active.email;
        if (!isReal(displayName) && isReal(active.name)) displayName = active.name;
        contactId = active.contactId || '';
      }
    }

    // ── STRATEGY 4: Server-side admin lookup + CRM search by email ──
    if (email && !isReal(displayName)) {
      setStatusText('Resolving your profile...');

      // 4a. Server-side portal-identity API (admin token)
      try {
        const res = await fetch(`/api/portal-identity?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const identity = await res.json() as { name?: string; email?: string; contactId?: string };
          if (identity.name && isReal(identity.name)) displayName = identity.name;
          if (identity.contactId) contactId = identity.contactId;
          console.log('[Portal Auth] Resolved from server API:', identity);
        }
      } catch { /* ok */ }

      // 4b. Fallback: CRM Contact search by email
      if (!isReal(displayName)) {
        try {
          const contact = await searchContactByEmail(email);
          if (contact?.name && isReal(contact.name)) {
            displayName = contact.name;
            if (contact.contactId) contactId = contact.contactId;
            console.log('[Portal Auth] Resolved from Contact search:', contact);
          }
        } catch { /* ok */ }
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

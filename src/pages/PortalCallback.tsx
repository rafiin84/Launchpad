import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, XCircle, Loader2, User } from 'lucide-react';
import {
  consumePendingToken, saveToken, loadToken,
  saveUserName, clearRole, saveRole, saveApiDomain,
} from '../services/oauth';
import { clearModuleStatusCache } from '../services/crmAppUsers';
import { savePortalSession, clearPortalSession, findPortalUser, seedKnownPortalUsers, getAllPortalUsers } from '../services/portalUsers';
import type { PortalUserEntry } from '../services/portalUsers';
import { fetchZohoAccountsUser, fetchPortalUserContact } from '../services/zohoApi';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

const LAST_PORTAL_EMAIL_KEY = 'lp_last_portal_email';

function saveLastPortalEmail(email: string) {
  try { localStorage.setItem(LAST_PORTAL_EMAIL_KEY, email.toLowerCase()); } catch { /* ok */ }
}

function loadLastPortalEmail(): string {
  try { return localStorage.getItem(LAST_PORTAL_EMAIL_KEY) || ''; } catch { return ''; }
}

function clearPreviousSession() {
  clearRole();
  clearModuleStatusCache();
  clearPortalSession();
  try { localStorage.removeItem('lp_user_name'); } catch { /* ok */ }
  try { localStorage.removeItem('lp_appuser_profile_cache'); } catch { /* ok */ }
  try { localStorage.removeItem('lp_appuser_record_id'); } catch { /* ok */ }
  try { localStorage.removeItem('lp_avatar_data'); } catch { /* ok */ }
}

export default function PortalCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'select-account'>('processing');
  const [statusText, setStatusText] = useState('Connecting to Zoho Portal...');
  const [portalUsers, setPortalUsers] = useState<PortalUserEntry[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const pending = consumePendingToken();
    if (pending) {
      clearPreviousSession();
      saveToken(pending.token, pending.expiresAt);
      saveRole('founder');
      if (pending.apiDomain) {
        saveApiDomain(pending.apiDomain);
      }
      handlePortalLogin();
      return;
    }

    const existing = loadToken();
    if (existing) {
      setStatus('success');
      setTimeout(() => navigate('/'), 1500);
      return;
    }

    setStatus('error');
    setStatusText('No token received from portal. Please try again.');
    setTimeout(() => navigate('/login'), 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isReal = (n: string) => !!n && n !== 'Founder' && n !== 'Investor' && n !== 'User';

  async function handlePortalLogin() {
    seedKnownPortalUsers();
    setStatusText('Identifying your portal account...');

    let email = '';
    let displayName = '';
    let contactId = '';
    let zuid = '';

    // Strategy 1: Fetch portal user's Contact record from CRM
    try {
      setStatusText('Fetching your contact record...');
      const myContact = await fetchPortalUserContact();
      if (myContact) {
        if (myContact.email) email = myContact.email;
        if (myContact.name && isReal(myContact.name)) displayName = myContact.name;
        if (myContact.contactId) contactId = myContact.contactId;
        console.log('[Portal Auth] Got Contact record:', myContact);
      }
    } catch (err) {
      console.warn('[Portal Auth] Could not fetch Contact:', err);
    }

    // Strategy 2: Zoho Accounts API
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

    // Strategy 3: Remember last logged-in portal user on this browser
    if (!email) {
      const lastEmail = loadLastPortalEmail();
      if (lastEmail) {
        const registryEntry = findPortalUser(lastEmail);
        if (registryEntry) {
          email = registryEntry.email;
          if (isReal(registryEntry.name)) displayName = registryEntry.name;
          contactId = registryEntry.contactId || '';
          console.log('[Portal Auth] Using remembered email:', email);
        }
      }
    }

    // Strategy 4: Registry lookup if we got email but no name
    if (email && !isReal(displayName)) {
      const registryEntry = findPortalUser(email);
      if (registryEntry) {
        if (isReal(registryEntry.name)) displayName = registryEntry.name;
        if (!contactId) contactId = registryEntry.contactId || '';
      }
    }

    // If we identified the user, finish login
    if (email) {
      finishLogin(email, displayName, contactId, zuid);
      return;
    }

    // No identification — show account selector (first-time only on this browser)
    const users = getAllPortalUsers().filter(u => u.active !== false);
    if (users.length > 0) {
      setPortalUsers(users);
      setStatus('select-account');
      setStatusText('Select your account to continue');
    } else {
      setStatus('error');
      setStatusText('Could not identify your account. Please contact your administrator.');
      setTimeout(() => navigate('/login'), 3000);
    }
  }

  function finishLogin(email: string, displayName: string, contactId: string, zuid: string) {
    saveLastPortalEmail(email);
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
    setStatusText(isReal(displayName) ? `Welcome, ${displayName}!` : 'Welcome!');
    setTimeout(() => navigate('/'), 1500);
  }

  function handleAccountSelect(user: PortalUserEntry) {
    finishLogin(user.email, user.name, user.contactId || '', '');
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

      {status === 'select-account' && (
        <div className="w-full max-w-sm px-4">
          <p className="text-sm font-semibold text-gray-900 text-center mb-1">Select Your Account</p>
          <p className="text-xs text-gray-400 text-center mb-5">Choose your founder profile to continue</p>
          <div className="space-y-2">
            {portalUsers.map(user => (
              <button
                key={user.email}
                onClick={() => handleAccountSelect(user)}
                className={cn(
                  'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-gray-100 bg-white',
                  'hover:border-indigo-500 hover:bg-indigo-50/50 transition-all duration-150 text-left cursor-pointer'
                )}
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-indigo-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
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

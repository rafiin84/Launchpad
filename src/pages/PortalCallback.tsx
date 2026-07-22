import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import {
  consumePendingToken, saveToken, loadToken,
  saveUserName, clearRole, saveRole, saveApiDomain, savePortalLoginEmail,
} from '../services/oauth';
import { clearModuleStatusCache } from '../services/crmAppUsers';
import { savePortalSession, clearPortalSession, findPortalUser, seedKnownPortalUsers } from '../services/portalUsers';
import { fetchZohoAccountsUser, fetchPortalUserContact } from '../services/zohoApi';
import { useAuth } from '../context/AuthContext';

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
  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'need-email'>('processing');
  const [statusText, setStatusText] = useState('Connecting to Zoho Portal...');
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
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

    // Clear remembered email so a different user logging in isn't
    // silently assigned the previous user's identity.
    try { localStorage.removeItem(LAST_PORTAL_EMAIL_KEY); } catch { /* ok */ }

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
      }
    } catch {
      // Portal tokens typically can't call CRM APIs
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
      } catch {
        // Expected to fail for portal tokens
      }
    }

    // Strategy 3: Registry lookup for name if we have email from API
    if (email && !isReal(displayName)) {
      const entry = findPortalUser(email);
      if (entry) {
        if (isReal(entry.name)) displayName = entry.name;
        if (!contactId) contactId = entry.contactId || '';
      }
    }

    if (email) {
      finishLogin(email, displayName, contactId, zuid);
      return;
    }

    // APIs couldn't identify — ask for email confirmation
    setStatus('need-email');
    setStatusText('');
  }

  function finishLogin(email: string, displayName: string, contactId: string, zuid: string) {
    saveLastPortalEmail(email);
    savePortalLoginEmail(email);
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

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }
    const entry = findPortalUser(email);
    if (entry) {
      finishLogin(entry.email, entry.name, entry.contactId || '', '');
    } else {
      // Unknown email — still allow login, just no profile name
      finishLogin(email, '', '', '');
    }
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

      {status === 'need-email' && (
        <form onSubmit={handleEmailSubmit} className="w-full max-w-xs px-4 text-center">
          <p className="text-sm font-semibold text-gray-900 mb-1">Confirm Your Email</p>
          <p className="text-xs text-gray-400 mb-5">Enter the email you used to sign in</p>
          <div className="relative mb-3">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="email"
              value={emailInput}
              onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
              placeholder="you@example.com"
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {emailError && <p className="text-xs text-red-500 mb-2">{emailError}</p>}
          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Continue
          </button>
          <p className="text-[11px] text-gray-300 mt-3">Confirm the email you used to sign in to the portal</p>
        </form>
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

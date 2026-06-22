import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  consumePendingToken, saveToken, loadToken,
  saveUserName, clearToken, clearRole, clearUserName,
} from '../services/oauth';
import { clearCachedRecordId, clearCachedProfile, clearModuleStatusCache } from '../services/crmAppUsers';
import { savePortalSession, clearPortalSession } from '../services/portalUsers';
import { fetchZohoAccountsUser } from '../services/zohoApi';
import { useAuth } from '../context/AuthContext';

/** Clear all previous user session data before a new portal login */
function clearPreviousSession() {
  clearRole();
  clearUserName();
  clearCachedRecordId();
  clearCachedProfile();
  clearModuleStatusCache();
  clearPortalSession();
  try { localStorage.removeItem('lp_avatar_data'); } catch { /* ok */ }
  try { localStorage.removeItem('lp_cover_image'); } catch { /* ok */ }
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

    try {
      // Try to get user info from Zoho Accounts API
      const accountsUser = await fetchZohoAccountsUser();

      if (accountsUser?.email) {
        const displayName = accountsUser.display_name
          || [accountsUser.first_name, accountsUser.last_name].filter(Boolean).join(' ')
          || 'Founder';

        saveUserName(displayName);

        savePortalSession({
          email: accountsUser.email,
          name: displayName,
          role: 'founder',
          contactId: '', // Will be resolved later if needed
          zuid: accountsUser.zuid || '',
          isPortalUser: true,
        });

        login('founder');
        setStatus('success');
        setStatusText(`Welcome, ${displayName}! Redirecting to your dashboard...`);
        setTimeout(() => navigate('/'), 1500);
        return;
      }
    } catch (err) {
      console.warn('[Portal Auth] Could not fetch accounts user:', err);
    }

    // Fallback: no user info but token is valid — proceed as founder anyway
    saveUserName('Founder');
    savePortalSession({
      email: '',
      name: 'Founder',
      role: 'founder',
      contactId: '',
      zuid: '',
      isPortalUser: true,
    });

    login('founder');
    setStatus('success');
    setStatusText('Welcome! Redirecting to your dashboard...');
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

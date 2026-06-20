import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, XCircle } from 'lucide-react';
import { consumePendingToken, saveToken, loadToken, consumePendingRole, saveUserName } from '../services/oauth';
import { fetchCurrentZohoUser, fetchZohoAccountsUser, fetchUserPhoto } from '../services/zohoApi';
import { fullProfileSync, uploadAppUserPhoto } from '../services/crmAppUsers';
import { findPortalUser, savePortalSession } from '../services/portalUsers';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

export default function Callback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [statusText, setStatusText] = useState('Connecting to Zoho...');

  useEffect(() => {
    const pending = consumePendingToken();
    if (pending) {
      saveToken(pending.token, pending.expiresAt);
      const pendingRole = (consumePendingRole() ?? 'investor') as UserRole;

      handleLogin(pendingRole);
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
    const t = setTimeout(() => navigate('/login'), 2500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(pendingRole: UserRole) {
    // ── Step 1: Try CRM user login (admin / staff) ──────────────────
    setStatusText('Identifying your account...');
    const zohoUser = await fetchCurrentZohoUser();

    if (zohoUser?.email) {
      // CRM user — full access, sync to appusers
      setStatusText('Syncing your profile...');
      if (zohoUser.full_name) saveUserName(zohoUser.full_name);

      const u = zohoUser as unknown as Record<string, unknown>;
      try {
        const { recordId } = await fullProfileSync(
          {
            email:      zohoUser.email,
            name:       zohoUser.full_name || 'User',
            phone:      (u['phone'] as string) || '',
            mobile:     (u['mobile'] as string) || '',
            zohoUserId: zohoUser.id || '',
            jobTitle:   ((u['role'] as Record<string, string>)?.name) || '',
            state:      (u['state'] as string) || '',
            country:    (u['country'] as string) || '',
          },
          pendingRole,
        );

        // Upload photo to appusers (best-effort)
        if (recordId) {
          setStatusText('Uploading profile photo...');
          try {
            const photoUrl = await fetchUserPhoto();
            if (photoUrl) {
              const photoRes = await fetch(photoUrl);
              if (photoRes.ok) {
                const blob = await photoRes.blob();
                if (blob.size > 0 && !blob.type.includes('json')) {
                  await uploadAppUserPhoto(recordId, blob, 'profile.jpg');
                }
              }
            }
          } catch { /* best-effort */ }
        }
      } catch { /* best-effort */ }

      login(pendingRole);
      setStatus('success');
      setStatusText('Redirecting to your dashboard...');
      setTimeout(() => navigate('/'), 1500);
      return;
    }

    // ── Step 2: Not a CRM user — check if portal user ───────────────
    setStatusText('Checking portal access...');
    const accountsUser = await fetchZohoAccountsUser();

    if (accountsUser?.email) {
      const displayName = accountsUser.display_name
        || [accountsUser.first_name, accountsUser.last_name].filter(Boolean).join(' ')
        || 'User';

      saveUserName(displayName);

      // Look up in the portal users registry
      const portalEntry = findPortalUser(accountsUser.email);

      if (portalEntry) {
        // Known portal user — use their assigned role
        savePortalSession({
          email: accountsUser.email,
          name: displayName,
          role: portalEntry.role,
          contactId: portalEntry.contactId,
          zuid: accountsUser.zuid,
          isPortalUser: true,
        });

        login(portalEntry.role);
        setStatus('success');
        setStatusText(`Welcome, ${displayName}! Redirecting to your ${portalEntry.role} dashboard...`);
        setTimeout(() => navigate('/'), 1500);
        return;
      }

      // Unknown portal user — they have a Zoho account but weren't explicitly invited
      // Use the role they selected on the login page
      savePortalSession({
        email: accountsUser.email,
        name: displayName,
        role: pendingRole,
        contactId: '',
        zuid: accountsUser.zuid,
        isPortalUser: true,
      });

      login(pendingRole);
      setStatus('success');
      setStatusText(`Welcome, ${displayName}!`);
      setTimeout(() => navigate('/'), 1500);
      return;
    }

    // ── Step 3: Couldn't identify user at all ───────────────────────
    // Fallback — just use the pending role
    login(pendingRole);
    setStatus('success');
    setStatusText('Redirecting...');
    setTimeout(() => navigate('/'), 1500);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center mb-2">
        <Rocket size={18} className="text-white" />
      </div>

      {status === 'processing' && (
        <>
          <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-700">{statusText}</p>
          <p className="text-xs text-gray-400">Please wait</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle size={32} className="text-emerald-500" />
          <p className="text-sm font-semibold text-gray-900">Connected!</p>
          <p className="text-xs text-gray-400">{statusText}</p>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={32} className="text-red-400" />
          <p className="text-sm font-semibold text-gray-700">No token received</p>
          <p className="text-xs text-gray-400">Redirecting back to login...</p>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import {
  consumePendingToken, saveToken, loadToken, consumePendingRole,
  saveUserName, clearToken, clearRole, clearUserName,
} from '../services/oauth';
import { fetchCurrentZohoUser, fetchZohoAccountsUser, fetchUserPhoto } from '../services/zohoApi';
import { fullProfileSync, uploadAppUserPhoto, clearCachedRecordId, clearCachedProfile, clearModuleStatusCache } from '../services/crmAppUsers';
import { findPortalUser, savePortalSession, clearPortalSession } from '../services/portalUsers';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

/** Clear all previous user session data before a new login */
function clearPreviousSession() {
  clearRole();
  clearUserName();
  clearCachedRecordId();
  clearCachedProfile();
  clearModuleStatusCache();
  clearPortalSession();
  try { localStorage.removeItem('lp_avatar_data'); } catch { /* ok */ }
}

export default function Callback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'role-mismatch'>('processing');
  const [statusText, setStatusText] = useState('Connecting to Zoho...');
  const [mismatchInfo, setMismatchInfo] = useState<{ selected: string; actual: string } | null>(null);

  useEffect(() => {
    const pending = consumePendingToken();
    if (pending) {
      // Clear all data from previous user session before saving new token
      clearPreviousSession();
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

  /**
   * Determine role from CRM profile name.
   * - "Administrator" → investor (admin has full access)
   * - "Investor"      → investor
   * - Anything else   → founder (portal users, unknown profiles)
   */
  function roleFromProfile(profileName: string | undefined): UserRole {
    if (!profileName) return 'founder';
    const p = profileName.toLowerCase();
    if (p === 'administrator' || p === 'investor' || p === 'admin') return 'investor';
    return 'founder';
  }

  async function handleLogin(pendingRole: UserRole) {
    // ── Step 1: Try CRM user login (admin / staff) ──────────────────
    setStatusText('Identifying your account...');
    const zohoUser = await fetchCurrentZohoUser();

    console.log('[Auth] fetchCurrentZohoUser result:', zohoUser ? { email: zohoUser.email, profile: zohoUser.profile, id: zohoUser.id } : null);

    if (zohoUser?.email) {
      // CRM user — auto-detect role from CRM profile (ENFORCED)
      const profileName = zohoUser.profile?.name;
      const detectedRole = roleFromProfile(profileName);
      console.log(`[Auth] CRM profile: "${profileName}" → role: ${detectedRole}, selected: ${pendingRole}`);

      // ── STRICT ROLE ENFORCEMENT ──
      // CRM users MUST use their profile-assigned role
      if (pendingRole !== detectedRole) {
        console.warn(`[Auth] Role mismatch! Selected "${pendingRole}" but CRM profile is "${profileName}" (→ ${detectedRole})`);
        clearToken();
        setMismatchInfo({
          selected: pendingRole === 'founder' ? 'Founder' : 'Investor',
          actual: profileName ?? detectedRole,
        });
        setStatus('role-mismatch');
        setStatusText(`Access denied — your account is registered as ${profileName ?? detectedRole}`);
        setTimeout(() => navigate('/login'), 4000);
        return;
      }

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
          detectedRole,
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

      login(detectedRole);
      setStatus('success');
      setStatusText(`Welcome, ${zohoUser.full_name}! Profile: ${profileName}`);
      setTimeout(() => navigate('/'), 1500);
      return;
    }

    // ── Step 2: Not a CRM user — must be a portal user (founder only) ──
    setStatusText('Checking portal access...');
    const accountsUser = await fetchZohoAccountsUser();

    if (accountsUser?.email) {
      const displayName = accountsUser.display_name
        || [accountsUser.first_name, accountsUser.last_name].filter(Boolean).join(' ')
        || 'User';

      // ── STRICT: Portal users can ONLY be founders ──
      if (pendingRole !== 'founder') {
        console.warn(`[Auth] Portal user "${accountsUser.email}" tried to log in as investor — blocked`);
        clearToken();
        setMismatchInfo({
          selected: 'Investor',
          actual: 'Portal User (Founder)',
        });
        setStatus('role-mismatch');
        setStatusText('Access denied — portal users can only sign in as Founder');
        setTimeout(() => navigate('/login'), 4000);
        return;
      }

      saveUserName(displayName);

      // Look up in the portal users registry for contactId
      const portalEntry = findPortalUser(accountsUser.email);

      savePortalSession({
        email: accountsUser.email,
        name: displayName,
        role: 'founder',
        contactId: portalEntry?.contactId ?? '',
        zuid: accountsUser.zuid,
        isPortalUser: true,
      });

      login('founder');
      setStatus('success');
      setStatusText(`Welcome, ${displayName}! Redirecting to your founder dashboard...`);
      setTimeout(() => navigate('/'), 1500);
      return;
    }

    // ── Step 3: Couldn't identify user at all — deny access ─────────
    console.warn('[Auth] Could not identify user from CRM or Accounts API');
    clearToken();
    setStatus('error');
    setStatusText('Could not verify your account. Please try again.');
    setTimeout(() => navigate('/login'), 3000);
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

      {status === 'role-mismatch' && mismatchInfo && (
        <>
          <ShieldAlert size={32} className="text-amber-500" />
          <p className="text-sm font-semibold text-gray-900">Access Denied</p>
          <div className="text-center max-w-sm">
            <p className="text-xs text-gray-600 leading-relaxed">
              You selected <span className="font-bold text-red-600">{mismatchInfo.selected}</span> but
              your account is registered as <span className="font-bold text-emerald-600">{mismatchInfo.actual}</span>.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Please go back and select the correct role.
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-1">Redirecting to login...</p>
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

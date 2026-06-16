import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle, XCircle } from 'lucide-react';
import { consumePendingToken, saveToken, loadToken, consumePendingRole, saveUserName } from '../services/oauth';
import { fetchCurrentZohoUser } from '../services/zohoApi';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

export default function Callback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const pending = consumePendingToken();
    if (pending) {
      saveToken(pending.token, pending.expiresAt);
      const role = (consumePendingRole() ?? 'investor') as UserRole;
      // Fetch real name from Zoho then complete login
      fetchCurrentZohoUser().then((zohoUser) => {
        if (zohoUser?.full_name) saveUserName(zohoUser.full_name);
        login(role);
        setStatus('success');
        setTimeout(() => navigate('/'), 1500);
      });
      return;
    }

    // React StrictMode runs effects twice; on the second run the token was
    // already consumed and saved above — check localStorage directly.
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center mb-2">
        <Rocket size={18} className="text-white" />
      </div>

      {status === 'processing' && (
        <>
          <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-700">Connecting to Zoho...</p>
          <p className="text-xs text-gray-400">Saving your access token</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle size={32} className="text-emerald-500" />
          <p className="text-sm font-semibold text-gray-900">Zoho connected!</p>
          <p className="text-xs text-gray-400">Redirecting to your dashboard...</p>
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

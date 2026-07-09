import { Navigate } from 'react-router-dom';
import {
  Rocket, TrendingUp, Building2, Users,
  PieChart, LayoutDashboard, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { cn } from '../lib/cn';
import { redirectToZoho, redirectToPortal, savePendingRole } from '../services/oauth';

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center">
        <Rocket size={15} className="text-white" />
      </div>
      <span className="text-base font-bold tracking-tight text-gray-900">Launchpad</span>
    </div>
  );
}

export default function Login() {
  const { isLoggedIn } = useAuth();

  if (isLoggedIn) return <Navigate to="/" replace />;

  function handleRoleSelect(role: UserRole) {
    savePendingRole(role);
    if (role === 'founder') {
      redirectToPortal();
    } else {
      redirectToZoho();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 flex flex-col">
      <div className="flex items-center justify-between px-8 py-5 flex-shrink-0">
        <Logo />
        <span className="text-xs text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
          Invite Only
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-12 max-w-xl">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            Private Founder + Investor Network
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
            Welcome to Launchpad
          </h1>
          <p className="text-gray-500 text-base leading-relaxed">
            Select your role to sign in.
          </p>
        </div>

        <div className="w-full max-w-md space-y-6">
          {/* Role selection cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Investor card */}
            <button
              type="button"
              onClick={() => handleRoleSelect('investor')}
              className={cn(
                'rounded-2xl p-5 text-left transition-all duration-200 cursor-pointer border-2',
                'bg-white border-gray-200 hover:bg-black hover:border-black hover:shadow-lg hover:scale-[1.02] group/card'
              )}
            >
              <div className="w-10 h-10 bg-gray-100 group-hover/card:bg-white/15 rounded-xl flex items-center justify-center mb-3 transition-colors">
                <TrendingUp size={18} className="text-gray-600 group-hover/card:text-white transition-colors" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 group-hover/card:text-white mb-1 transition-colors">Investor</h3>
              <div className="space-y-1.5 mt-3">
                {[
                  { icon: LayoutDashboard, label: 'Analytics dashboard' },
                  { icon: PieChart, label: 'Portfolio overview' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[11px] text-gray-500 group-hover/card:text-gray-400 transition-colors">
                    <Icon size={11} className="flex-shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </button>

            {/* Founder (Portal) card */}
            <button
              type="button"
              onClick={() => handleRoleSelect('founder')}
              className={cn(
                'rounded-2xl p-5 text-left transition-all duration-200 cursor-pointer border-2',
                'bg-white border-gray-200 hover:bg-black hover:border-black hover:shadow-lg hover:scale-[1.02] group/card'
              )}
            >
              <div className="w-10 h-10 bg-indigo-50 group-hover/card:bg-white/15 rounded-xl flex items-center justify-center mb-3 transition-colors">
                <Rocket size={18} className="text-indigo-600 group-hover/card:text-white transition-colors" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 group-hover/card:text-white mb-1 transition-colors">Founder</h3>
              <div className="space-y-1.5 mt-3">
                {[
                  { icon: Users, label: 'Founder network' },
                  { icon: Building2, label: 'Company profile' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[11px] text-gray-500 group-hover/card:text-gray-400 transition-colors">
                    <Icon size={11} className="flex-shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </button>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
            <ShieldCheck size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>Investors:</strong> Sign in with your Zoho CRM account.
              <br />
              <strong>Founders:</strong> Sign in via the Launchpad Portal using the account from your invitation email.
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-10 text-center max-w-sm">
          Private & invite-only. All data shared on Launchpad is strictly confidential.
        </p>
      </div>
    </div>
  );
}

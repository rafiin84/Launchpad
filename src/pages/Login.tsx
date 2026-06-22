import { Navigate } from 'react-router-dom';
import {
  Rocket, TrendingUp, ArrowRight, Building2, Users,
  PieChart, Inbox, LayoutDashboard, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { redirectToZoho, savePendingRole } from '../services/oauth';

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

  const handleSignIn = () => {
    // No role selection needed — role is auto-detected from CRM profile after login
    savePendingRole('investor'); // fallback only, overridden by CRM profile detection
    redirectToZoho();
  };

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
            Sign in with your Zoho account. Your dashboard will be assigned
            automatically based on your CRM profile.
          </p>
        </div>

        <div className="w-full max-w-md space-y-6">
          {/* Profile info cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black rounded-2xl p-5 text-left">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center mb-3">
                <TrendingUp size={18} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Administrator / Investor</h3>
              <div className="space-y-1.5 mt-3">
                {[
                  { icon: LayoutDashboard, label: 'Analytics dashboard' },
                  { icon: PieChart, label: 'Portfolio overview' },
                  { icon: Inbox, label: 'Deal pipeline' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[11px] text-gray-400">
                    <Icon size={11} className="flex-shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border-2 border-gray-100 rounded-2xl p-5 text-left">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
                <Rocket size={18} className="text-indigo-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Founder (Portal)</h3>
              <div className="space-y-1.5 mt-3">
                {[
                  { icon: TrendingUp, label: 'Activity feed' },
                  { icon: Users, label: 'Founder network' },
                  { icon: Building2, label: 'Company profile' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[11px] text-gray-500">
                    <Icon size={11} className="flex-shrink-0 text-gray-400" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Single sign-in button */}
          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-800 rounded-2xl px-6 py-4 transition-all hover:shadow-lg group"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="#E42527"/>
              <text x="12" y="17" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white" fontFamily="sans-serif">Z</text>
            </svg>
            <span className="text-sm font-semibold text-white">
              Sign in with Zoho
            </span>
            <ArrowRight size={16} className="text-gray-400 group-hover:text-white ml-auto transition-colors" />
          </button>

          {/* Security note */}
          <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
            <ShieldCheck size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Your role is detected automatically from your Zoho CRM profile.
              Administrators and Investors see the investor dashboard.
              Portal users (founders) see the founder dashboard.
            </p>
          </div>

          {/* Portal user note */}
          <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
            <Users size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-600 leading-relaxed">
              <span className="font-semibold">Received a portal invitation?</span>{' '}
              Use the same Zoho account you set up from the invitation email to sign in.
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

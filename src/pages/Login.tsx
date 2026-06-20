import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Rocket, TrendingUp, ArrowRight, ArrowLeft, Building2, Users,
  PieChart, Inbox, LayoutDashboard, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { cn } from '../lib/cn';
import { redirectToZoho, savePendingRole, setZohoDC, getZohoDC } from '../services/oauth';

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

// ─── Step 1: Role selection ────────────────────────────────────────────────────

function RoleSelection({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center mb-12 max-w-xl">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
          Private Founder + Investor Network
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
          Welcome back.
        </h1>
        <p className="text-gray-500 text-base leading-relaxed">
          Select your role to access your personalized dashboard.
          Founders and investors have separate, dedicated experiences.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        {/* Investor card */}
        <button
          onClick={() => onSelect('investor')}
          className="group relative bg-black rounded-3xl p-8 text-left transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
        >
          <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-white/20 transition-colors">
            <TrendingUp size={22} className="text-white" />
          </div>
          <div className="mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Investor</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-3">I'm an Investor</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Manage your portfolio, track deals, review applications, and stay close to your founders.
          </p>
          <div className="space-y-2 mb-8">
            {[
              { icon: LayoutDashboard, label: 'Analytics dashboard' },
              { icon: PieChart, label: 'Portfolio overview' },
              { icon: Inbox, label: 'Deal pipeline & applications' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-xs text-gray-400">
                <Icon size={13} className="flex-shrink-0" />
                {label}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Continue as Investor</span>
            <div className={cn(
              'w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center transition-all',
              'group-hover:bg-white'
            )}>
              <ArrowRight size={17} className="text-white group-hover:text-black transition-colors" />
            </div>
          </div>
        </button>

        {/* Founder card */}
        <button
          onClick={() => onSelect('founder')}
          className="group relative bg-white border-2 border-gray-100 hover:border-gray-900 rounded-3xl p-8 text-left transition-all duration-200 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
        >
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors">
            <Rocket size={22} className="text-indigo-600" />
          </div>
          <div className="mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Founder</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">I'm a Founder</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Share updates, ask for advice, request intros, and connect with your investor network.
          </p>
          <div className="space-y-2 mb-8">
            {[
              { icon: TrendingUp, label: 'Activity feed & posts' },
              { icon: Users, label: 'Peer founder network' },
              { icon: Building2, label: 'Company profile & milestones' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-xs text-gray-500">
                <Icon size={13} className="flex-shrink-0 text-gray-400" />
                {label}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Continue as Founder</span>
            <div className={cn(
              'w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center transition-all',
              'group-hover:bg-black'
            )}>
              <ArrowRight size={17} className="text-gray-600 group-hover:text-white transition-colors" />
            </div>
          </div>
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-10 text-center max-w-sm">
        Private & invite-only. All data shared on Launchpad is strictly confidential between founders and their investors.
      </p>
    </div>
  );
}

// ─── Step 2: Per-role Zoho auth screen ────────────────────────────────────────

function ZohoAuthScreen({ role, onBack }: { role: UserRole; onBack: () => void }) {
  const isInvestor = role === 'investor';
  const [dc, setDc] = useState<'in' | 'com'>(getZohoDC());

  const handleDcChange = (newDc: 'in' | 'com') => {
    setDc(newDc);
    setZohoDC(newDc);
  };

  const handleZohoSignIn = () => {
    setZohoDC(dc);
    savePendingRole(role);
    redirectToZoho();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to role selection
        </button>

        {/* Role badge */}
        <div className={cn(
          'inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6',
          isInvestor ? 'bg-black text-white' : 'bg-indigo-50 text-indigo-700'
        )}>
          {isInvestor ? <TrendingUp size={12} /> : <Rocket size={12} />}
          {isInvestor ? 'Investor Access' : 'Founder Access'}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Sign in as {isInvestor ? 'an Investor' : 'a Founder'}
        </h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          {isInvestor
            ? 'Connect your Zoho CRM account to access your portfolio, deal flow, and founder network.'
            : 'Connect your Zoho CRM account to share updates, get intros, and grow with your investors.'}
        </p>

        {/* Region selector */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">Zoho Region</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleDcChange('in')}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                dc === 'in'
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              )}
            >
              🇮🇳 India (.in)
            </button>
            <button
              type="button"
              onClick={() => handleDcChange('com')}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                dc === 'com'
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              )}
            >
              🌐 Global (.com)
            </button>
          </div>
        </div>

        {/* Zoho sign-in button */}
        <button
          onClick={handleZohoSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-900 rounded-2xl px-6 py-4 transition-all hover:shadow-lg group mb-6"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="#E42527"/>
            <text x="12" y="17" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white" fontFamily="sans-serif">Z</text>
          </svg>
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Sign in to Launchpad
          </span>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-gray-700 ml-auto transition-colors" />
        </button>

        {/* Security note */}
        <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <ShieldCheck size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">
            You'll be redirected to Zoho's secure login page. We never store your Zoho password.
            Your role will be saved so you're taken directly to your{' '}
            <span className="font-semibold">{isInvestor ? 'investor' : 'founder'}</span> dashboard after sign-in.
          </p>
        </div>

        {/* Portal user note */}
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mt-3">
          <Users size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-600 leading-relaxed">
            <span className="font-semibold">Received a portal invitation?</span>{' '}
            Use the same Zoho account you set up from the invitation email to sign in.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Login() {
  const { isLoggedIn } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  if (isLoggedIn) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 flex flex-col">
      <div className="flex items-center justify-between px-8 py-5 flex-shrink-0">
        <Logo />
        <span className="text-xs text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
          Invite Only
        </span>
      </div>

      {selectedRole === null ? (
        <RoleSelection onSelect={setSelectedRole} />
      ) : (
        <ZohoAuthScreen role={selectedRole} onBack={() => setSelectedRole(null)} />
      )}
    </div>
  );
}

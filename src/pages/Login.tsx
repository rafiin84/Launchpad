import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Rocket, TrendingUp, ArrowRight, ArrowLeft, Building2, Users,
  DollarSign, PieChart, Inbox, LayoutDashboard, Mail, Lock, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { cn } from '../lib/cn';

type Step = 'select' | 'investor' | 'founder';

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

        {/* Investor card — dark */}
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

        {/* Founder card — light */}
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

      <div className="mt-10 text-center">
        <p className="text-xs text-gray-400 mb-3">Trusted by teams building at</p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {['SynthFlow', 'HealthBridge', 'CarbonLoop', 'DataMesh', 'Nexus Ventures'].map(name => (
            <span key={name} className="text-xs font-medium text-gray-400">{name}</span>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-8 text-center max-w-sm">
        Private & invite-only. All data shared on Launchpad is strictly confidential between founders and their investors.
      </p>
    </div>
  );
}

function LoginForm({ role, onBack, onLogin }: { role: UserRole; onBack: () => void; onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isInvestor = role === 'investor';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">

        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center mb-4',
            isInvestor ? 'bg-black' : 'bg-indigo-50'
          )}>
            {isInvestor
              ? <TrendingUp size={22} className="text-white" />
              : <Rocket size={22} className="text-indigo-600" />
            }
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            {isInvestor ? 'Investor' : 'Founder'} Login
          </p>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Sign in to your account
          </h2>
          <p className="text-sm text-gray-500 mt-1.5">
            {isInvestor
              ? 'Access your portfolio and deal pipeline.'
              : 'Connect with your network and share updates.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={isInvestor ? 'investor@fund.com' : 'founder@startup.com'}
                className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-300 transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-300 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-3.5 h-3.5 rounded accent-black" />
              <span className="text-xs text-gray-500">Remember me</span>
            </label>
            <button type="button" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            className={cn(
              'w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 mt-2',
              isInvestor
                ? 'bg-black text-white hover:bg-gray-800 active:scale-[0.98]'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
            )}
          >
            Sign in
            <ArrowRight size={15} />
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Don't have access?{' '}
          <span className="text-gray-600 font-medium">Request an invite →</span>
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  const { isLoggedIn, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('select');
  const [selectedRole, setSelectedRole] = useState<UserRole>('investor');

  if (isLoggedIn) return <Navigate to="/" replace />;

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setStep(role);
  };

  const handleLogin = () => {
    login(selectedRole);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 flex flex-col">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-8 py-5 flex-shrink-0">
        <Logo />
        <span className="text-xs text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
          Invite Only
        </span>
      </div>

      {step === 'select' && (
        <RoleSelection onSelect={handleSelectRole} />
      )}

      {(step === 'investor' || step === 'founder') && (
        <LoginForm
          role={selectedRole}
          onBack={() => setStep('select')}
          onLogin={handleLogin}
        />
      )}
    </div>
  );
}

import { useState, useEffect, type ReactNode } from 'react';
import {
  DollarSign, TrendingUp, Users, Zap,
  Edit3, Check, X, Plus, AlertCircle,
  Clock, Target, Flame, BarChart2,
  Sparkles, ArrowRight, Rocket, Building2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loadToken } from '../services/oauth';
import { fetchZohoOrgName } from '../services/zohoApi';
import { cn } from '../lib/cn';
import { generateFounderInsights, type AIInsight } from '../services/aiEngine';
import { AIBadge } from '../components/ui/AIBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPI {
  key: string;
  label: string;
  value: string;
  sub: string;
  prefix?: string;
  suffix?: string;
  accent?: boolean;
}

interface Milestone {
  id: string;
  text: string;
  done: boolean;
  dueDate: string;
}

const DEFAULT_KPIS: KPI[] = [
  { key: 'mrr',      label: 'MRR',          value: '',  sub: 'monthly recurring revenue', prefix: '$',  accent: true },
  { key: 'runway',   label: 'Runway',        value: '',  sub: 'months of cash left',       suffix: ' mo' },
  { key: 'raised',   label: 'Total Raised',  value: '',  sub: 'capital raised to date',    prefix: '$' },
  { key: 'burn',     label: 'Burn Rate',     value: '',  sub: 'per month',                 prefix: '$' },
  { key: 'customers',label: 'Customers',     value: '',  sub: 'active paying customers' },
  { key: 'growth',   label: 'MoM Growth',    value: '',  sub: 'revenue growth month-on-month', suffix: '%' },
  { key: 'churn',    label: 'Churn',         value: '',  sub: 'monthly churn rate',        suffix: '%' },
  { key: 'team',     label: 'Team Size',     value: '',  sub: 'full-time employees' },
];

const STORAGE_KPIS       = 'lp_founder_kpis';
const STORAGE_MILESTONES = 'lp_founder_milestones';

function loadKPIs(): KPI[] {
  try {
    const saved = localStorage.getItem(STORAGE_KPIS);
    if (saved) {
      const parsed: KPI[] = JSON.parse(saved);
      // Merge in case new keys were added
      return DEFAULT_KPIS.map(def => parsed.find(p => p.key === def.key) ?? def);
    }
  } catch { /* ignore */ }
  // Start with empty KPIs — founders fill in their own data
  return DEFAULT_KPIS;
}

function saveKPIs(kpis: KPI[]) {
  localStorage.setItem(STORAGE_KPIS, JSON.stringify(kpis));
}

function loadMilestones(): Milestone[] {
  try {
    const saved = localStorage.getItem(STORAGE_MILESTONES);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  // Start with empty milestones — founders add their own
  return [];
}

function saveMilestones(ms: Milestone[]) {
  localStorage.setItem(STORAGE_MILESTONES, JSON.stringify(ms));
}

// ─── KPI edit modal ───────────────────────────────────────────────────────────

function KPIEditor({ kpis, onSave, onClose }: {
  kpis: KPI[];
  onSave: (kpis: KPI[]) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(kpis.map(k => ({ ...k })));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Update KPIs</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {local.map((kpi, i) => (
            <div key={kpi.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {kpi.label} {kpi.prefix && <span className="text-gray-400">({kpi.prefix})</span>}{kpi.suffix && <span className="text-gray-400">({kpi.suffix})</span>}
              </label>
              <input
                type="text"
                value={kpi.value}
                onChange={e => {
                  const updated = [...local];
                  updated[i] = { ...updated[i], value: e.target.value };
                  setLocal(updated);
                }}
                placeholder={kpi.key === 'mrr' ? '50,000' : kpi.key === 'runway' ? '18' : '—'}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
          <button
            onClick={() => { onSave(local); onClose(); }}
            className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 flex items-center gap-2"
          >
            <Check size={14} /> Save KPIs
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

/** Generic sparkline area chart using pure SVG */
function AreaChart({ data, color, gradientId }: { data: number[]; color: string; gradientId: string }) {
  const w = 300, h = 80, pad = 4;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (w - pad * 2));
  const ys = data.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const area = `${line} L${xs[xs.length - 1]},${h} L${xs[0]},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === data.length - 1 ? 3.5 : 2} fill={color}
          opacity={i === data.length - 1 ? 1 : 0.4} />
      ))}
    </svg>
  );
}

/** Bar chart for burn rate */
function BurnBarChart({ data, color }: { data: number[]; color: string }) {
  const w = 300, h = 80, gap = 6;
  const max = Math.max(...data, 1);
  const barW = (w - gap * (data.length + 1)) / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      {data.map((v, i) => {
        const bh = (v / max) * (h - 10);
        const x = gap + i * (barW + gap);
        return (
          <rect key={i} x={x} y={h - bh} width={barW} height={bh}
            rx="3" fill={color} opacity={i === data.length - 1 ? 1 : 0.35} />
        );
      })}
    </svg>
  );
}

/** Horizontal runway gauge */
function RunwayGauge({ months, maxMonths = 24 }: { months: number; maxMonths?: number }) {
  const pct = Math.min(months / maxMonths, 1);
  const color = months >= 12 ? '#10b981' : months >= 6 ? '#f59e0b' : '#ef4444';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
        <span>0 mo</span><span>{maxMonths} mo</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-xs text-gray-500">Current runway</span>
        <span className="text-sm font-bold" style={{ color }}>{months} months</span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FounderDashboard() {
  const { currentUser } = useAuth();
  const isConnected = !!loadToken();

  const [kpis, setKPIs]           = useState<KPI[]>(loadKPIs);
  const [milestones, setMilestones] = useState<Milestone[]>(loadMilestones);
  const [showKPIEditor, setShowKPIEditor] = useState(false);
  const [newMilestone, setNewMilestone] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);

  useEffect(() => {
    if (!isConnected) return;
    fetchZohoOrgName().then(org => setCompanyName(org)).catch(() => {});
  }, [isConnected]);

  useEffect(() => {
    const insights = generateFounderInsights(
      kpis.map(k => ({ key: k.key, label: k.label, value: k.value })),
      milestones.map(m => ({ text: m.text, done: m.done, dueDate: m.dueDate }))
    );
    setAiInsights(insights);
  }, [kpis, milestones]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Derive numeric values from KPI state for charts
  const parseNum = (key: string) => {
    const raw = kpis.find(k => k.key === key)?.value ?? '';
    return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
  };
  const totalRaisedVal = parseNum('raised');
  const burnVal        = parseNum('burn');
  const runwayVal      = parseNum('runway');

  // Build 6-month trend data (simulated growth leading to current value)
  const raisedTrend = totalRaisedVal > 0
    ? [0.3, 0.45, 0.55, 0.7, 0.85, 1.0].map(f => totalRaisedVal * f)
    : [0, 0, 0, 0, 0, 0];
  const burnTrend = burnVal > 0
    ? [0.7, 0.8, 0.9, 0.95, 1.05, 1.0].map(f => burnVal * f)
    : [0, 0, 0, 0, 0, 0];

  const months = ['Jan','Feb','Mar','Apr','May','Jun'];

  function handleSaveKPIs(updated: KPI[]) {
    setKPIs(updated);
    saveKPIs(updated);
  }

  function addMilestone() {
    if (!newMilestone.trim()) return;
    const ms: Milestone = { id: Date.now().toString(), text: newMilestone.trim(), done: false, dueDate: newDueDate };
    const updated = [ms, ...milestones];
    setMilestones(updated);
    saveMilestones(updated);
    setNewMilestone('');
    setNewDueDate('');
  }

  function toggleMilestone(id: string) {
    const updated = milestones.map(m => m.id === id ? { ...m, done: !m.done } : m);
    setMilestones(updated);
    saveMilestones(updated);
  }

  function deleteMilestone(id: string) {
    const updated = milestones.filter(m => m.id !== id);
    setMilestones(updated);
    saveMilestones(updated);
  }

  const filledKPIs = kpis.filter(k => k.value.trim());
  const emptyCount = kpis.filter(k => !k.value.trim()).length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">

      {/* Greeting */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow flex-shrink-0 relative bg-indigo-100">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-indigo-700 font-bold text-sm">
                {currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            {currentUser.avatar && (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="relative w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {greeting}, {currentUser.name.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {companyName ?? 'Launchpad'}
              {' · '}
              <span className="hidden sm:inline">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              <span className="sm:hidden">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowKPIEditor(true)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:border-gray-400 px-3 py-2 rounded-xl transition-all"
        >
          <Edit3 size={14} /> Update KPIs
        </button>
      </div>

      {/* Onboarding banner — shown when founder is brand new (all KPIs empty & no milestones) */}
      {emptyCount === kpis.length && milestones.length === 0 && (
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 rounded-2xl px-6 py-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Rocket size={20} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-gray-900 mb-1">Welcome to Launchpad!</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                Get started by setting up your company profile and adding your key metrics.
                Your investors will see this data on their dashboard.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/company"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
                >
                  <Building2 size={13} /> Set Up Company Profile
                </Link>
                <button
                  onClick={() => setShowKPIEditor(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-4 py-2 rounded-lg transition-colors"
                >
                  <Edit3 size={13} /> Add Your KPIs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup nudge — shown when some (but not all) KPIs are missing */}
      {emptyCount > 0 && emptyCount < kpis.length && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 mb-6">
          <AlertCircle size={16} className="text-indigo-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-indigo-900">{emptyCount} KPI{emptyCount > 1 ? 's' : ''} not set yet</p>
            <p className="text-xs text-indigo-600 mt-0.5">Keep your investor dashboard up to date with your latest numbers.</p>
          </div>
          <button onClick={() => setShowKPIEditor(true)} className="text-xs font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            Fill in KPIs
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {kpis.map(kpi => (
          <button
            key={kpi.key}
            onClick={() => setShowKPIEditor(true)}
            className={cn(
              'text-left rounded-2xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98] group',
              kpi.accent ? 'bg-black text-white' : 'bg-white border border-gray-100 hover:border-gray-200'
            )}
          >
            <div className={cn('text-2xl font-bold mb-0.5 min-h-[32px]', kpi.accent ? 'text-white' : 'text-gray-900')}>
              {kpi.value
                ? <>{kpi.prefix}{kpi.value}{kpi.suffix}</>
                : <span className={cn('text-lg', kpi.accent ? 'text-gray-500' : 'text-gray-200')}>—</span>
              }
            </div>
            <p className={cn('text-xs font-semibold', kpi.accent ? 'text-gray-300' : 'text-gray-700')}>{kpi.label}</p>
            <p className={cn('text-xs mt-0.5', kpi.accent ? 'text-gray-500' : 'text-gray-400')}>{kpi.sub}</p>
          </button>
        ))}
      </div>

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900">AI Insights</h2>
            <AIBadge />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aiInsights.slice(0, 3).map(insight => {
              const priorityBorder: Record<string, string> = {
                high: 'border-l-red-400',
                medium: 'border-l-amber-400',
                low: 'border-l-blue-400',
              };
              const typeIcon: Record<string, ReactNode> = {
                risk: <AlertCircle size={14} className="text-red-500" />,
                action: <Target size={14} className="text-amber-500" />,
                trend: <TrendingUp size={14} className="text-emerald-500" />,
                milestone: <Target size={14} className="text-indigo-500" />,
                opportunity: <Zap size={14} className="text-violet-500" />,
              };
              return (
                <div
                  key={insight.id}
                  className={cn(
                    'bg-white border border-gray-100 rounded-xl p-4 border-l-[3px] hover:shadow-sm transition-all',
                    priorityBorder[insight.priority] || 'border-l-indigo-400'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {typeIcon[insight.type] || <Sparkles size={14} className="text-indigo-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-gray-900 mb-1">{insight.title}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{insight.description}</p>
                      {insight.actionLabel && insight.actionPath && (
                        <Link to={insight.actionPath} className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                          {insight.actionLabel} <ArrowRight size={10} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Two-column */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left: Charts */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Total Raised */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp size={14} className="text-indigo-500" /> Total Raised
              </h2>
              <span className="text-lg font-bold text-gray-900">
                {totalRaisedVal > 0
                  ? totalRaisedVal >= 1_000_000 ? `$${(totalRaisedVal/1_000_000).toFixed(1)}M` : `$${(totalRaisedVal/1_000).toFixed(0)}K`
                  : '$2.8M'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Cumulative capital raised · last 6 months</p>
            <AreaChart data={raisedTrend} color="#6366f1" gradientId="raised-grad" />
            <div className="flex justify-between mt-1">
              {months.map(m => <span key={m} className="text-[10px] text-gray-300">{m}</span>)}
            </div>
          </div>

          {/* Burn Rate */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Flame size={14} className="text-orange-400" /> Burn Rate
              </h2>
              <span className="text-lg font-bold text-gray-900">
                {burnVal > 0
                  ? burnVal >= 1_000_000 ? `$${(burnVal/1_000_000).toFixed(1)}M/mo` : `$${(burnVal/1_000).toFixed(0)}K/mo`
                  : '$135K/mo'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Monthly cash burn · last 6 months</p>
            <BurnBarChart data={burnTrend} color="#f97316" />
            <div className="flex justify-between mt-1">
              {months.map(m => <span key={m} className="text-[10px] text-gray-300">{m}</span>)}
            </div>
          </div>

          {/* Runway */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <BarChart2 size={14} className="text-emerald-500" /> Runway
              </h2>
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full',
                (runwayVal || 18) >= 12 ? 'bg-emerald-50 text-emerald-700' :
                (runwayVal || 18) >= 6  ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              )}>
                {(runwayVal || 18) >= 12 ? 'Healthy' : (runwayVal || 18) >= 6 ? 'Watch' : 'Critical'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Months of cash remaining at current burn</p>
            <RunwayGauge months={runwayVal || 18} maxMonths={24} />
          </div>

        </div>

        {/* Right: Milestones + Quick actions */}
        <div className="w-full lg:w-64 flex-shrink-0 space-y-4">

          {/* Milestones */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Target size={14} className="text-indigo-500" /> Milestones
            </h3>

            {/* Add milestone */}
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={newMilestone}
                onChange={e => setNewMilestone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMilestone()}
                placeholder="Add a milestone…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  onClick={addMilestone}
                  disabled={!newMilestone.trim()}
                  className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded-xl disabled:opacity-30"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {milestones.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No milestones yet</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {milestones.map(m => (
                  <div key={m.id} className="flex items-start gap-2 group">
                    <button
                      onClick={() => toggleMilestone(m.id)}
                      className={cn(
                        'mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                        m.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-gray-500'
                      )}
                    >
                      {m.done && <Check size={10} className="text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs leading-snug', m.done ? 'line-through text-gray-400' : 'text-gray-700')}>{m.text}</p>
                      {m.dueDate && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <Clock size={10} /> {new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteMilestone(m.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Flame size={14} className="text-orange-400" /> Quick Actions
            </h3>
            <div className="space-y-0.5">
              {[
                { label: 'Post an update',   path: '/activities/new', icon: Zap },
                { label: 'View Activities',  path: '/activities',     icon: Zap },
                { label: 'Company Profile',  path: '/company',        icon: Users },
                { label: 'Upload Document',  path: '/documents/new',  icon: DollarSign },
              ].map(action => {
                const Icon = action.icon;
                return (
                  <Link key={action.path} to={action.path}
                    className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0 hover:text-indigo-600 transition-colors group"
                  >
                    <Icon size={13} className="text-gray-400 group-hover:text-indigo-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700 group-hover:text-indigo-600">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Investor CTA */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 text-white">
            <TrendingUp size={20} className="text-white/70 mb-2" />
            <p className="text-sm font-bold mb-1">Keep your investor updated</p>
            <p className="text-xs text-indigo-200 mb-3 leading-relaxed">
              Regular updates build trust. Share wins, key metrics, and asks.
            </p>
            <Link to="/activities/new"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Plus size={12} /> Post Update
            </Link>
          </div>

        </div>
      </div>

      {/* KPI editor modal */}
      {showKPIEditor && (
        <KPIEditor kpis={kpis} onSave={handleSaveKPIs} onClose={() => setShowKPIEditor(false)} />
      )}
    </div>
  );
}

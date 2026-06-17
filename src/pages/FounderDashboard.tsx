import { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, Users, Zap, Activity,
  ArrowUpRight, Edit3, Check, X, Plus, AlertCircle,
  Clock, Target, Flame,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchCRMActivities, type CRMActivity } from '../services/crmActivities';
import { loadToken } from '../services/oauth';
import { cn } from '../lib/cn';

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

const SAMPLE_KPIS: KPI[] = [
  { key: 'mrr',       label: 'MRR',         value: '$68,000',  sub: 'monthly recurring revenue',          prefix: '$',  accent: true },
  { key: 'runway',    label: 'Runway',       value: '18',       sub: 'months of cash left',                suffix: ' mo' },
  { key: 'raised',    label: 'Total Raised', value: '$2.8M',    sub: 'capital raised to date',             prefix: '$' },
  { key: 'burn',      label: 'Burn Rate',    value: '$135,000', sub: 'per month',                          prefix: '$' },
  { key: 'customers', label: 'Customers',    value: '312',      sub: 'active paying customers' },
  { key: 'growth',    label: 'MoM Growth',   value: '14',       sub: 'revenue growth month-on-month',      suffix: '%' },
  { key: 'churn',     label: 'Churn',        value: '1.8',      sub: 'monthly churn rate',                 suffix: '%' },
  { key: 'team',      label: 'Team Size',    value: '14',       sub: 'full-time employees' },
];

function loadKPIs(): KPI[] {
  try {
    const saved = localStorage.getItem(STORAGE_KPIS);
    if (saved) {
      const parsed: KPI[] = JSON.parse(saved);
      // Merge in case new keys were added
      return DEFAULT_KPIS.map(def => parsed.find(p => p.key === def.key) ?? def);
    }
  } catch { /* ignore */ }
  // Pre-populate with sample data on first load
  localStorage.setItem(STORAGE_KPIS, JSON.stringify(SAMPLE_KPIS));
  return SAMPLE_KPIS;
}

function saveKPIs(kpis: KPI[]) {
  localStorage.setItem(STORAGE_KPIS, JSON.stringify(kpis));
}

const SAMPLE_MILESTONES: Milestone[] = [
  { id: '1', text: 'Reach $1M ARR',                    done: false, dueDate: '2025-09-30' },
  { id: '2', text: 'Launch Enterprise tier with SSO',   done: false, dueDate: '2025-12-31' },
  { id: '3', text: 'Hire Senior Full-Stack Engineer',   done: true,  dueDate: '2025-06-01' },
  { id: '4', text: 'Reach 500 paying customers',       done: false, dueDate: '2026-03-31' },
  { id: '5', text: 'Close Series A — $15M target',     done: false, dueDate: '2026-06-30' },
  { id: '6', text: 'Reduce LLM inference cost by 60%', done: true,  dueDate: '2025-05-01' },
];

function loadMilestones(): Milestone[] {
  try {
    const saved = localStorage.getItem(STORAGE_MILESTONES);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  // Pre-populate with sample milestones on first load
  localStorage.setItem(STORAGE_MILESTONES, JSON.stringify(SAMPLE_MILESTONES));
  return SAMPLE_MILESTONES;
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

// ─── Activity type badge ──────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  win:          { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  advice:       { bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  insight:      { bg: 'bg-amber-50',   text: 'text-amber-700' },
  update:       { bg: 'bg-sky-50',     text: 'text-sky-700' },
  introduction: { bg: 'bg-purple-50',  text: 'text-purple-700' },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FounderDashboard() {
  const { currentUser } = useAuth();
  const isConnected = !!loadToken();

  const [kpis, setKPIs]           = useState<KPI[]>(loadKPIs);
  const [milestones, setMilestones] = useState<Milestone[]>(loadMilestones);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [loadingActs, setLoadingActs] = useState(true);
  const [showKPIEditor, setShowKPIEditor] = useState(false);
  const [newMilestone, setNewMilestone] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  useEffect(() => {
    if (!isConnected) { setLoadingActs(false); return; }
    fetchCRMActivities()
      .then(data => setActivities(data.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoadingActs(false));
  }, []);

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
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {greeting}, {currentUser.name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' · '}Founder Dashboard
          </p>
        </div>
        <button
          onClick={() => setShowKPIEditor(true)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:border-gray-400 px-3 py-2 rounded-xl transition-all"
        >
          <Edit3 size={14} /> Update KPIs
        </button>
      </div>

      {/* Setup nudge */}
      {emptyCount > 0 && (
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

      {/* Two-column */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left: Recent Updates */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Activity size={15} className="text-indigo-500" /> Recent Updates to Investor
            </h2>
            <Link to="/activities" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>

          {loadingActs ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
                  <div className="h-20 bg-gray-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
              <Zap size={28} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500 mb-1">No updates shared yet</p>
              <p className="text-xs text-gray-400 mb-4">Post wins, milestones, or product updates to keep your investor in the loop.</p>
              <Link to="/activities/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl">
                <Plus size={14} /> Share an Update
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {activities.map(act => {
                const cfg = TYPE_CONFIG[act.activityType?.toLowerCase()] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
                return (
                  <Link key={act.id} to={`/activities/${act.id}`} className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 hover:shadow-sm transition-all flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{act.title || '—'}</h3>
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 capitalize', cfg.bg, cfg.text)}>
                        {act.activityType || 'update'}
                      </span>
                    </div>
                    {act.content && (
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-2">{act.content}</p>
                    )}
                    {(act.imageUrl || (act.imageData && act.imageData.startsWith('data:'))) && (
                      <div className="mt-auto rounded-xl overflow-hidden">
                        <img
                          src={act.imageData?.startsWith('data:') ? act.imageData : act.imageUrl}
                          alt=""
                          className="w-full h-36 object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
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
                { label: 'Post an update',   path: '/activities/new', icon: Activity },
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

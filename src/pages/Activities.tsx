import React, { useState, useEffect } from 'react';
import { Activity, Plus, AlertCircle, RefreshCw, Trash2, Building2, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchCRMActivities, deleteCRMActivity, type CRMActivity } from '../services/crmActivities';
import { loadToken } from '../services/oauth';
import { PageHeader } from '../components/layout/PageHeader';

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  'win':     { label: 'Win',     bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'advice':  { label: 'Advice',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  'insight': { label: 'Insight', bg: 'bg-amber-50',   text: 'text-amber-700' },
  'update':  { label: 'Update',  bg: 'bg-sky-50',     text: 'text-sky-700' },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type?.toLowerCase()] ?? { label: type || 'Activity', bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function ActivityCard({ activity, onDelete }: { activity: CRMActivity; onDelete: (id: string) => void }) {
  const tags = activity.tags ? activity.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const [expanded, setExpanded] = useState(false);
  const isLong = activity.content.length > 320;
  const display = isLong && !expanded ? activity.content.slice(0, 320) : activity.content;

  return (
    <article className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
        <div className="flex items-center gap-3">
          {activity.companyName && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={14} className="text-gray-400" />
              </div>
              <p className="text-xs font-semibold text-gray-800">{activity.companyName}</p>
            </div>
          )}
        </div>
        <TypeBadge type={activity.activityType} />
      </div>

      <div className="px-5 py-4">
        {/* Title */}
        {activity.title && (
          <h3 className="text-sm font-semibold text-gray-900 mb-2 leading-snug">{activity.title}</h3>
        )}

        {/* Author */}
        {activity.authorName && (
          <p className="text-xs text-gray-500 mb-2">{activity.authorName}</p>
        )}

        {/* Content */}
        {activity.content && (
          <div className="mb-3">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {display}{isLong && !expanded && '...'}
            </p>
            {isLong && (
              <button onClick={() => setExpanded(v => !v)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1">
                {expanded ? 'Show less' : 'See more'}
              </button>
            )}
          </div>
        )}

        {/* Image */}
        {activity.imageUrl && (
          <div className="mt-3 rounded-xl overflow-hidden mb-3">
            <img src={activity.imageUrl} alt="" className="w-full h-[220px] object-cover" loading="lazy" />
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map(tag => (
              <span key={tag} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-50">
          <button
            onClick={() => onDelete(activity.id)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Activities() {
  const [records, setRecords] = useState<CRMActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isConnected = !!loadToken();

  const load = () => {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true);
    setError('');
    fetchCRMActivities()
      .then(setRecords)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteCRMActivity(id);
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch {
      // swallow
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="w-full lg:w-[650px]">
        <PageHeader
          title="Activities"
          description="What's happening across your portfolio network"
          action={
            <Link to="/activities/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
              <Plus size={15} /> Share Activity
            </Link>
          }
        />

        {/* Not-connected banner */}
        {!isConnected && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Connect Zoho CRM to see live data</p>
              <p className="text-xs text-amber-600 mt-0.5">Go to Login and sign in with Zoho CRM.</p>
            </div>
            <Link to="/login" className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">Connect</Link>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button onClick={load} className="inline-flex items-center gap-2 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {!loading && !error && records.length === 0 && isConnected && (
          <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
            <Activity size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 mb-1">No activities yet</p>
            <p className="text-xs text-gray-400 mb-4">Share a win, insight, or update with the network.</p>
            <Link to="/activities/new" className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl">
              <Plus size={14} /> Share Activity
            </Link>
          </div>
        )}

        {!loading && !error && records.length > 0 && (
          <div className="space-y-4">
            {records.map(activity => (
              <ActivityCard key={activity.id} activity={activity} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

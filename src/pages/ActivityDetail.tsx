import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Building2, User, Tag, Trash2, Edit2 } from 'lucide-react';
import { getCRMActivity, deleteCRMActivity, type CRMActivity } from '../services/crmActivities';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (u.hostname.includes('loom.com')) {
      const id = u.pathname.split('/').pop();
      if (id) return `https://www.loom.com/embed/${id}`;
    }
  } catch { /* not a valid URL */ }
  return null;
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  win:          { label: 'Win',          bg: 'bg-emerald-50', text: 'text-emerald-700' },
  insight:      { label: 'Insight',      bg: 'bg-violet-50',  text: 'text-violet-700'  },
  update:       { label: 'Update',       bg: 'bg-blue-50',    text: 'text-blue-700'    },
  advice:       { label: 'Advice',       bg: 'bg-amber-50',   text: 'text-amber-700'   },
  introduction: { label: 'Introduction', bg: 'bg-pink-50',    text: 'text-pink-700'    },
};

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [activity, setActivity] = useState<CRMActivity | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    if (!id) return;
    getCRMActivity(id)
      .then(setActivity)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteCRMActivity(id);
      navigate('/activities');
    } catch (err) {
      setDeleting(false);
      setShowDelete(false);
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Only the author can delete
  const isAuthor = activity
    ? currentUser.name.trim().toLowerCase() === activity.authorName.trim().toLowerCase()
    : false;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl">
        <div className="w-24 h-4 bg-gray-100 rounded animate-pulse mb-6" />
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4 animate-pulse">
          <div className="h-5 bg-gray-100 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
          <div className="h-40 bg-gray-100 rounded-xl" />
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-4/5" />
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !activity) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl">
        <Link to="/activities" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 mb-6">
          <ArrowLeft size={15} /> Activities
        </Link>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-sm text-red-600">{error || 'Activity not found'}</p>
        </div>
      </div>
    );
  }

  const tags = activity.tags ? activity.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const cfg  = TYPE_CONFIG[activity.activityType?.toLowerCase()] ?? { label: activity.activityType || 'Activity', bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl">
      {showDelete && (
        <DeleteConfirmModal
          title="Delete Activity"
          message="Are you sure you want to delete this activity? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          deleting={deleting}
        />
      )}

      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/activities" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft size={15} /> Activities
        </Link>
        {isAuthor && (
          <div className="flex items-center gap-2">
            <Link
              to={`/activities/${id}/edit`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 px-2.5 py-1.5 sm:px-3 rounded-xl transition-colors"
              title="Edit"
            >
              <Edit2 size={14} /><span className="hidden sm:inline ml-1">Edit</span>
            </Link>
            <button
              onClick={() => setShowDelete(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 sm:px-3 rounded-xl transition-colors"
              title="Delete"
            >
              <Trash2 size={14} /><span className="hidden sm:inline ml-1">Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Card */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Building2 size={15} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">{activity.companyName || 'General'}</p>
          </div>
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.bg, cfg.text)}>
            {cfg.label}
          </span>
        </div>

        {/* Body */}
        <div className="px-6 pt-4 pb-6">
          {activity.title && (
            <h1 className="text-lg font-bold text-gray-900 mb-1 leading-snug">{activity.title}</h1>
          )}

          {/* Author */}
          <div className="flex items-center gap-1.5 mb-4">
            <User size={12} className="text-gray-300" />
            <p className="text-xs text-gray-400">
              {activity.authorName || 'Unknown'}
              {isAuthor && (
                <span className="ml-1.5 text-indigo-500 font-medium">(you)</span>
              )}
            </p>
          </div>

          {/* Content */}
          {activity.content && (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
              {activity.content}
            </p>
          )}

          {/* Image or video */}
          {(activity.imageData || activity.imageUrl) && (() => {
            const videoEmbed = activity.imageUrl ? getVideoEmbedUrl(activity.imageUrl) : null;
            return (
              <div className="rounded-2xl overflow-hidden mb-4">
                {videoEmbed ? (
                  <div className="aspect-video bg-black">
                    <iframe src={videoEmbed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <img
                    src={activity.imageData || activity.imageUrl}
                    alt=""
                    className="w-full object-cover max-h-80"
                    loading="lazy"
                  />
                )}
              </div>
            );
          })()}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <Tag size={12} className="text-gray-300" />
              {tags.map(tag => (
                <span key={tag} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {!isAuthor && (
            <div className="pt-4 border-t border-gray-50">
              <p className="text-xs text-gray-400 italic text-right">
                Only the author can edit or delete this activity.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

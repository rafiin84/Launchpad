import { useState, useEffect, useRef } from 'react';
import { BarChart3, Check, FileText, Download, MapPin, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import {
  castPollVote, parsePollVotes, parsePollData, parseActivityFileRef, resolveActivityFileUrl,
  type CRMActivity, type PollVote, type ActivityFileRef,
} from '../../services/crmActivities';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';

export type { ActivityFileRef };

// ─── Photo / Video (uploaded) ────────────────────────────────────────────────
// The file lives directly on the activity's own record (My_Activities for an
// investor post, or Feed_Submissions for a founder's — never My_Documents),
// rendered inline instead of as a file card. Unlike a plain imageUrl/videoUrl,
// it has to be fetched (resolveActivityFileUrl) before anything can be shown,
// so this needs its own loading state.
export function MediaAttachment({ fileRef, kind }: { fileRef: string; kind: 'photo' | 'video' }) {
  const ref = parseActivityFileRef(fileRef);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const cleanupRef = useRef<{ url: string; revoke: boolean } | null>(null);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    setUrl(null);
    setError(false);
    resolveActivityFileUrl(ref)
      .then(result => {
        if (cancelled) {
          if (result.revoke) URL.revokeObjectURL(result.url);
          return;
        }
        cleanupRef.current = result;
        setUrl(result.url);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      if (cleanupRef.current?.revoke) URL.revokeObjectURL(cleanupRef.current.url);
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileRef]);

  if (!ref) return null;

  return (
    <div
      className={cn('mt-3 rounded-xl overflow-hidden', kind === 'video' ? 'bg-black' : 'bg-gray-100')}
      onClick={e => kind === 'video' && e.stopPropagation()}
    >
      {!url && !error && (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-40 gap-2 text-xs text-red-400">
          <AlertCircle size={14} /> Failed to load {kind}.
        </div>
      )}
      {url && !error && kind === 'photo' && (
        <img src={url} alt="" className="w-full max-h-64 object-cover" loading="lazy" onError={() => setError(true)} />
      )}
      {url && !error && kind === 'video' && (
        <video src={url} controls className="w-full max-h-64" />
      )}
    </div>
  );
}

// ─── Poll ───────────────────────────────────────────────────────────────────
// One vote per user, no changing your vote, results shown only after voting.
// Votes are separate small activity records (see castPollVote in
// crmActivities.ts) rather than a mutable tally on the poll itself — the poll
// record's own Poll_Data only ever holds {question, options}.
export function PollWidget({ activity, allActivities, onVoteCast }: {
  activity: CRMActivity;
  allActivities: CRMActivity[];
  onVoteCast?: (vote: PollVote) => void;
}) {
  const { currentUser, isInvestor } = useAuth();
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [localVote, setLocalVote] = useState<PollVote | null>(null);

  const poll = parsePollData(activity.pollData);
  if (!poll) return null;

  const myEmail = (currentUser.email || '').toLowerCase();
  const serverVotes = parsePollVotes(allActivities, activity.id);
  const alreadyHasMine = serverVotes.some(v => v.voterEmail === myEmail);
  const allVotes = localVote && !alreadyHasMine ? [...serverVotes, localVote] : serverVotes;
  const myVote = localVote || serverVotes.find(v => v.voterEmail === myEmail) || null;

  const counts = poll.options.map((_, i) => allVotes.filter(v => v.optionIndex === i).length);
  const total = counts.reduce((a, b) => a + b, 0);

  async function handleVote(optionIndex: number) {
    if (myVote || voting) return;
    setVoting(true);
    setError('');
    try {
      const vote: PollVote = {
        activityId: activity.id,
        optionIndex,
        voterEmail: currentUser.email || '',
        voterName: currentUser.name,
      };
      await castPollVote(vote, isInvestor ? 'investor' : 'founder');
      setLocalVote(vote);
      onVoteCast?.(vote);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cast vote. Please try again.');
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="mt-2 mb-1 border border-gray-100 rounded-xl p-3 bg-gray-50/60" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 size={13} className="text-indigo-500 flex-shrink-0" />
        <p className="text-sm font-semibold text-gray-900">{poll.question}</p>
      </div>
      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
          const isMine = myVote?.optionIndex === i;
          if (myVote) {
            return (
              <div key={i} className="relative rounded-lg overflow-hidden border border-gray-200 bg-white">
                <div
                  className={cn('absolute inset-y-0 left-0 transition-all', isMine ? 'bg-indigo-100' : 'bg-gray-100')}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2 text-xs">
                  <span className={cn('font-medium flex items-center gap-1', isMine ? 'text-indigo-700' : 'text-gray-700')}>
                    {isMine && <Check size={11} className="flex-shrink-0" />} {opt}
                  </span>
                  <span className="text-gray-500 font-semibold flex-shrink-0">{pct}%</span>
                </div>
              </div>
            );
          }
          return (
            <button
              key={i}
              type="button"
              disabled={voting}
              onClick={() => handleVote(i)}
              className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-xs font-medium text-gray-700 transition-colors disabled:opacity-50"
            >
              {opt}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5">
        {total} vote{total === 1 ? '' : 's'}{!myVote ? ' · Tap an option to vote' : ''}
      </p>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── Document ───────────────────────────────────────────────────────────────
export function DocumentAttachmentCard({ fileRef, fileName, onOpen }: {
  fileRef: string;
  fileName: string;
  onOpen: (ref: ActivityFileRef) => void;
}) {
  const ref = parseActivityFileRef(fileRef);
  if (!ref) return null;
  return (
    <button
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); onOpen(ref); }}
      className="mt-2 mb-1 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
        <FileText size={14} className="text-orange-500" />
      </div>
      <span className="text-xs font-medium text-gray-700 truncate flex-1">{fileName}</span>
      <Download size={13} className="text-gray-400 flex-shrink-0" />
    </button>
  );
}

// ─── Location ───────────────────────────────────────────────────────────────
export function LocationCard({ name, coords }: { name: string; coords?: string }) {
  if (!name) return null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords || name)}`;
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="mt-2 mb-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
        <MapPin size={14} className="text-rose-500" />
      </div>
      <span className="text-xs font-medium text-gray-700 truncate flex-1">{name}</span>
      <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
    </a>
  );
}

// ─── Link ───────────────────────────────────────────────────────────────────
export function LinkCard({ url }: { url: string }) {
  if (!url) return null;
  let domain = url;
  try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* not a valid URL */ }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="mt-2 mb-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors overflow-hidden"
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        alt=""
        className="w-8 h-8 rounded-lg flex-shrink-0 bg-gray-50"
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{domain}</p>
        <p className="text-[10px] text-gray-400 truncate">{url}</p>
      </div>
      <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
    </a>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox, Plus, FileText, Clock, CheckCircle, XCircle,
  TrendingUp, Building2, DollarSign, ArrowRight, MessageSquare,
  Upload, Check, Send, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getApplications,
  canApplyAgain,
  updateApplication,
  parseRequestedDocuments,
  stringifyRequestedDocuments,
  type InvestmentApplication,
  type ApplicationStatus,
  type RequestedDocument,
} from '../services/investmentApplications';
import { addNotification } from '../services/notifications';
import { PageHeader } from '../components/layout/PageHeader';
import { cn } from '../lib/cn';

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(raw: string): string {
  const num = parseFloat(raw);
  if (!num || isNaN(num)) return '--';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}

// ─── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string; text: string }> = {
  draft:               { label: 'Draft',              color: '#6b7280', bg: 'bg-gray-100',    text: 'text-gray-600' },
  submitted:           { label: 'Submitted',          color: '#3b82f6', bg: 'bg-blue-50',     text: 'text-blue-600' },
  under_review:        { label: 'Under Review',       color: '#6366f1', bg: 'bg-indigo-50',   text: 'text-indigo-600' },
  interested:          { label: 'Interested',         color: '#10b981', bg: 'bg-emerald-50',  text: 'text-emerald-600' },
  more_info_requested: { label: 'More Info Requested',color: '#f59e0b', bg: 'bg-amber-50',    text: 'text-amber-600' },
  documents_requested: { label: 'Docs Requested',     color: '#eab308', bg: 'bg-yellow-50',   text: 'text-yellow-600' },
  shortlisted:         { label: 'Shortlisted',        color: '#a855f7', bg: 'bg-purple-50',   text: 'text-purple-600' },
  meeting_scheduled:   { label: 'Meeting Scheduled',  color: '#8b5cf6', bg: 'bg-violet-50',   text: 'text-violet-600' },
  due_diligence:       { label: 'Due Diligence',      color: '#f97316', bg: 'bg-orange-50',   text: 'text-orange-600' },
  on_hold:             { label: 'On Hold',            color: '#475569', bg: 'bg-slate-100',   text: 'text-slate-600' },
  approved:            { label: 'Approved',           color: '#22c55e', bg: 'bg-green-50',    text: 'text-green-600' },
  invested:            { label: 'Invested',           color: '#15803d', bg: 'bg-green-100',   text: 'text-green-700' },
  rejected:            { label: 'Rejected',           color: '#ef4444', bg: 'bg-red-50',      text: 'text-red-600' },
};

const PIPELINE_STAGES: ApplicationStatus[] = [
  'submitted',
  'under_review',
  'shortlisted',
  'meeting_scheduled',
  'due_diligence',
  'approved',
];

function stageIndex(status: ApplicationStatus): number {
  const idx = PIPELINE_STAGES.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function progressPercent(status: ApplicationStatus): number {
  if (status === 'draft') return 0;
  if (status === 'rejected') return 100;
  const idx = stageIndex(status);
  return Math.round(((idx + 1) / PIPELINE_STAGES.length) * 100);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function PipelineVisualization({ apps }: { apps: InvestmentApplication[] }) {
  const nonDraft = apps.filter(a => a.status !== 'draft');
  const counts: Record<string, number> = {};
  for (const a of nonDraft) {
    counts[a.status] = (counts[a.status] || 0) + 1;
  }

  const allStages: { status: ApplicationStatus; label: string }[] = [
    { status: 'submitted', label: 'Submitted' },
    { status: 'under_review', label: 'Under Review' },
    { status: 'shortlisted', label: 'Shortlisted' },
    { status: 'meeting_scheduled', label: 'Meeting' },
    { status: 'due_diligence', label: 'Due Diligence' },
    { status: 'approved', label: 'Approved' },
    { status: 'on_hold', label: 'On Hold' },
    { status: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 overflow-x-auto">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Application Pipeline</h3>
      <div className="flex items-center gap-1 min-w-[640px]">
        {allStages.map((stage, i) => {
          const count = counts[stage.status] || 0;
          const cfg = STATUS_CONFIG[stage.status] ?? STATUS_CONFIG.submitted;
          const hasApps = count > 0;
          return (
            <div key={stage.status} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    hasApps ? 'border-current shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-300',
                  )}
                  style={hasApps ? { color: cfg.color, backgroundColor: `${cfg.color}15` } : undefined}
                >
                  {count}
                </div>
                <span className={cn(
                  'text-[10px] mt-1.5 text-center font-medium leading-tight',
                  hasApps ? 'text-gray-700' : 'text-gray-400',
                )}>
                  {stage.label}
                </span>
              </div>
              {i < allStages.length - 1 && (
                <div className={cn('h-0.5 w-4 flex-shrink-0', hasApps && (counts[allStages[i + 1]?.status] || 0) > 0 ? 'bg-indigo-200' : 'bg-gray-100')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ParsedMessage {
  timestamp: string;
  sender: string;
  text: string;
}

function parseInvestorMessages(notes: string): ParsedMessage[] {
  if (!notes) return [];
  const messages: ParsedMessage[] = [];
  const pattern = /\[([^\]]+)\]\s*([^:]+):\s*([\s\S]*?)(?=\n\n\[|$)/g;
  let match;
  while ((match = pattern.exec(notes)) !== null) {
    messages.push({
      timestamp: match[1].trim(),
      sender: match[2].trim(),
      text: match[3].trim(),
    });
  }
  return messages;
}

function InvestorMessages({ notes, reviewedBy, reviewedAt }: { notes: string; reviewedBy?: string; reviewedAt?: string }) {
  const messages = parseInvestorMessages(notes);

  if (messages.length === 0 && !notes) return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <MessageSquare size={12} className="text-indigo-500" />
        <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
          Messages from Investor
        </p>
      </div>
      {messages.length > 0 ? (
        <div className="space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-indigo-700">{msg.sender}</span>
                <span className="text-[10px] text-indigo-400">{msg.timestamp}</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{msg.text}</p>
            </div>
          ))}
        </div>
      ) : notes ? (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
          <p className="text-xs text-gray-700 leading-relaxed">{notes}</p>
          {reviewedBy && (
            <p className="text-[10px] text-indigo-400 mt-1.5">
              — {reviewedBy}{reviewedAt ? `, ${new Date(reviewedAt).toLocaleDateString()}` : ''}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DocumentUploadSection({ app, onRefresh }: { app: InvestmentApplication; onRefresh: () => void }) {
  const requestedDocs = parseRequestedDocuments(app.requestedDocuments);
  const [localDocs, setLocalDocs] = useState<RequestedDocument[]>(requestedDocs);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  useEffect(() => {
    setLocalDocs(parseRequestedDocuments(app.requestedDocuments));
  }, [app.requestedDocuments]);

  if (localDocs.length === 0) return null;

  const handleFileSelect = (docType: string) => {
    setUploadTarget(docType);
    setUploadError(null);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    setUploading(uploadTarget);
    setUploadError(null);
    try {
      const base64 = await fileToBase64(file);
      const uploadRes = await fetch(`/api/attachments?id=${encodeURIComponent(app.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: `[${uploadTarget}] ${file.name}`, fileData: base64, mimeType: file.type }),
      });
      const responseText = await uploadRes.text();
      let uploadJson: any;
      try { uploadJson = JSON.parse(responseText); } catch {
        throw new Error(uploadRes.status === 413 ? 'File too large. Max size is 10MB.' : `Upload failed (${uploadRes.status}): ${responseText.slice(0, 100)}`);
      }
      if (!uploadRes.ok) throw new Error(uploadJson?.error || `Upload failed (${uploadRes.status})`);
      const attachmentId = uploadJson?.data?.[0]?.details?.id || '';

      const updatedDocs = localDocs.map(d =>
        d.type === uploadTarget
          ? { ...d, status: 'uploaded' as const, fileName: file.name, attachmentId }
          : d
      );
      setLocalDocs(updatedDocs);

      await updateApplication(app.id, {
        requestedDocuments: stringifyRequestedDocuments(updatedDocs),
      }, false);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
    setUploading(null);
    setUploadTarget(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitDocs = async () => {
    setSubmitting(true);
    setUploadError(null);
    try {
      const submittedDocs = localDocs.map(d =>
        d.status === 'uploaded' ? { ...d, status: 'submitted' as const } : d
      );
      await updateApplication(app.id, {
        requestedDocuments: stringifyRequestedDocuments(submittedDocs),
        status: 'under_review' as ApplicationStatus,
      }, false);

      addNotification({
        type: 'company_update',
        title: 'Documents Submitted',
        message: `Documents have been submitted for ${app.companyName}: ${submittedDocs.filter(d => d.status === 'submitted').map(d => d.type).join(', ')}`,
        actor: app.founderName || 'Founder',
        actorRole: 'founder',
        link: `/applications/${app.id}`,
      });
      window.dispatchEvent(new Event('notifications-updated'));
      onRefresh();
    } catch (err) {
      console.error('Submit failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Submit failed. Please try again.');
    }
    setSubmitting(false);
  };

  const pendingDocs = localDocs.filter(d => d.status === 'pending');
  const uploadedDocs = localDocs.filter(d => d.status === 'uploaded');
  const submittedDocs = localDocs.filter(d => d.status === 'submitted');
  const hasUploaded = uploadedDocs.length > 0;
  const allDone = pendingDocs.length === 0 && uploadedDocs.length === 0;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Upload size={12} className="text-yellow-600" />
        <p className="text-[10px] font-semibold text-yellow-600 uppercase tracking-wider">
          Requested Documents
        </p>
        <span className="text-[10px] text-gray-400 ml-auto">
          {uploadedDocs.length + submittedDocs.length}/{localDocs.length} uploaded
        </span>
      </div>

      {uploadError && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
          <AlertCircle size={12} className="flex-shrink-0" /> {uploadError}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.zip"
      />

      <div className="space-y-1.5">
        {pendingDocs.map((doc, i) => (
          <div key={`p-${i}`} className="flex items-center justify-between bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-yellow-500" />
              <span className="text-xs font-medium text-gray-800">{doc.type}</span>
            </div>
            <button
              onClick={() => handleFileSelect(doc.type)}
              disabled={!!uploading}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-yellow-500 hover:bg-yellow-600 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              <Upload size={11} />
              {uploading === doc.type ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        ))}

        {uploadedDocs.map((doc, i) => (
          <div key={`u-${i}`} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-blue-500" />
              <span className="text-xs font-medium text-gray-800">{doc.type}</span>
            </div>
            <div className="flex items-center gap-2">
              {doc.fileName && <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{doc.fileName}</span>}
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                <Check size={10} /> Ready
              </span>
            </div>
          </div>
        ))}

        {submittedDocs.map((doc, i) => (
          <div key={`s-${i}`} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-green-500" />
              <span className="text-xs font-medium text-gray-800">{doc.type}</span>
            </div>
            <div className="flex items-center gap-2">
              {doc.fileName && <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{doc.fileName}</span>}
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                <Check size={10} /> Submitted
              </span>
            </div>
          </div>
        ))}
      </div>

      {hasUploaded && (
        <button
          onClick={handleSubmitDocs}
          disabled={submitting}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          <Send size={13} />
          {submitting ? 'Submitting Documents...' : `Submit ${uploadedDocs.length} Document${uploadedDocs.length !== 1 ? 's' : ''} to Investor`}
        </button>
      )}

      {allDone && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
          <CheckCircle size={12} /> All documents have been submitted
        </div>
      )}
    </div>
  );
}

const ACTION_REQUIRED: ApplicationStatus[] = ['more_info_requested', 'documents_requested'];

function ApplicationCard({ app, expanded, onToggle, onRefresh }: { app: InvestmentApplication; expanded: boolean; onToggle: () => void; onRefresh: () => void }) {
  const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.submitted;
  const isDraft = app.status === 'draft';
  const isApproved = app.status === 'approved' || app.status === 'invested';
  const needsAction = ACTION_REQUIRED.includes(app.status);
  const progress = progressPercent(app.status);

  return (
    <div className={cn(
      'bg-white border rounded-2xl p-5 transition-all',
      isDraft ? 'border-amber-200 bg-amber-50/30' :
      isApproved ? 'border-green-200 bg-green-50/30' :
      needsAction ? 'border-amber-200 bg-amber-50/20' :
      app.status === 'on_hold' ? 'border-slate-200 bg-slate-50/30' :
      app.status === 'rejected' ? 'border-red-200 bg-red-50/20' :
      'border-gray-100',
    )}>
      {/* Action required banner */}
      {needsAction && (
        <div className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg px-3 py-1.5 mb-3">
          <Clock size={12} />
          {app.status === 'more_info_requested' ? 'Investor has requested more information' : 'Investor has requested documents'}
        </div>
      )}
      {isApproved && (
        <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-100 rounded-lg px-3 py-1.5 mb-3">
          <CheckCircle size={12} />
          Your application has been approved! You are now a Founder.
        </div>
      )}
      {app.status === 'on_hold' && (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg px-3 py-1.5 mb-3">
          <Clock size={12} />
          Your application is currently on hold.
        </div>
      )}
      {app.status === 'rejected' && (
        <div className="flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg px-3 py-1.5 mb-3">
          <XCircle size={12} />
          Your application has been declined.
        </div>
      )}
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
            <Building2 size={16} className="text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{app.companyName || 'Untitled'}</p>
            {app.companyIndustry && (
              <span className="inline-flex text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full mt-0.5">
                {app.companyIndustry}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {/* Info row */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        {app.fundingAsk && (
          <span className="flex items-center gap-1">
            <DollarSign size={12} className="text-gray-400" />
            <span className="font-medium text-gray-700">{formatCurrency(app.fundingAsk)}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={12} className="text-gray-400" />
          {relativeTime(app.status === 'draft' ? app.updatedAt : app.submittedAt)}
        </span>
      </div>

      {/* Progress bar (non-drafts only) */}
      {!isDraft && (
        <div className="mb-3">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: app.status === 'rejected' ? '#ef4444' : cfg.color,
              }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {app.status === 'rejected' ? 'Rejected' : `${PIPELINE_STAGES[stageIndex(app.status)]?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Submitted'} (${progress}%)`}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isDraft ? (
          <Link
            to={`/applications/apply?edit=${app.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <FileText size={12} /> Continue Editing
          </Link>
        ) : (
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            {expanded ? 'Hide Details' : 'View Details'}
            <ArrowRight size={12} className={cn('transition-transform', expanded && 'rotate-90')} />
          </button>
        )}
      </div>

      {/* Investor messages — always visible */}
      {!isDraft && app.investorNotes && (
        <InvestorMessages notes={app.investorNotes} reviewedBy={app.reviewedBy} reviewedAt={app.reviewedAt} />
      )}

      {/* Meeting details */}
      {!isDraft && app.meetingDate && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Clock size={12} className="text-violet-600" />
            <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">
              Meeting Scheduled
            </p>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 space-y-1.5">
            <p className="text-xs font-bold text-gray-900">
              {new Date(app.meetingDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}
              <span className="text-violet-600">
                {new Date(app.meetingDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
            {app.meetingLocation && (
              <p className="text-[11px] text-gray-600"><span className="font-semibold text-gray-500">Location:</span> {app.meetingLocation}</p>
            )}
            {app.meetingLink && (
              <p className="text-[11px] text-gray-600">
                <span className="font-semibold text-gray-500">Link:</span>{' '}
                <a href={app.meetingLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{app.meetingLink}</a>
              </p>
            )}
            {app.meetingAgenda && (
              <p className="text-[11px] text-gray-600"><span className="font-semibold text-gray-500">Agenda:</span> {app.meetingAgenda}</p>
            )}
          </div>
        </div>
      )}

      {/* Requested documents with upload */}
      {!isDraft && (
        <DocumentUploadSection app={app} onRefresh={onRefresh} />
      )}

      {/* Expanded details */}
      {expanded && !isDraft && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {app.companyDescription && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</p>
              <p className="text-xs text-gray-700 leading-relaxed">{app.companyDescription}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {app.companyStage && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Stage</p>
                <p className="text-xs text-gray-700">{app.companyStage}</p>
              </div>
            )}
            {app.companyLocation && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
                <p className="text-xs text-gray-700">{app.companyLocation}</p>
              </div>
            )}
            {app.currentRevenue && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Revenue</p>
                <p className="text-xs text-gray-700">{formatCurrency(app.currentRevenue)}</p>
              </div>
            )}
            {app.equityOffered && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Equity Offered</p>
                <p className="text-xs text-gray-700">{app.equityOffered}%</p>
              </div>
            )}
          </div>
          {app.problemStatement && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Problem</p>
              <p className="text-xs text-gray-700 leading-relaxed">{app.problemStatement}</p>
            </div>
          )}
          {app.solution && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Solution</p>
              <p className="text-xs text-gray-700 leading-relaxed">{app.solution}</p>
            </div>
          )}
          {app.useOfFunds && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Use of Funds</p>
              <p className="text-xs text-gray-700 leading-relaxed">{app.useOfFunds}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FounderApplicationTracker() {
  const { currentUser, isInvestor } = useAuth();
  const [applications, setApplications] = useState<InvestmentApplication[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadApps = useCallback(async () => {
    setLoading(true);
    const all = await getApplications(isInvestor, currentUser?.email);
    setApplications(all);
    setLoading(false);
  }, [isInvestor, currentUser?.email]);

  useEffect(() => { loadApps(); }, [loadApps]);

  const drafts = applications.filter(a => a.status === 'draft');
  const approvedApps = applications.filter(a => a.status === 'approved' || a.status === 'invested');
  const rejectedApps = applications.filter(a => a.status === 'rejected');
  const activeApps = applications.filter(a => a.status !== 'draft' && a.status !== 'approved' && a.status !== 'invested' && a.status !== 'rejected');
  const nonDrafts = applications.filter(a => a.status !== 'draft');

  // Stats
  const inProgressStatuses: ApplicationStatus[] = ['under_review', 'interested', 'shortlisted', 'meeting_scheduled', 'due_diligence', 'more_info_requested', 'documents_requested'];
  const totalSubmitted = nonDrafts.length;
  const inProgress = nonDrafts.filter(a => inProgressStatuses.includes(a.status)).length;
  const approved = nonDrafts.filter(a => a.status === 'approved' || a.status === 'invested').length;
  const rejected = nonDrafts.filter(a => a.status === 'rejected').length;

  const isEmpty = applications.length === 0;
  const hasDraft = drafts.length > 0;
  const allowNewApplication = canApplyAgain(applications) && !hasDraft;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <PageHeader
        title="My Application"
        description="Track the status of your investment proposal"
        action={
          allowNewApplication ? (
            <Link
              to="/applications/apply"
              className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Plus size={14} /> {applications.some(a => a.status === 'rejected') ? 'Re-Apply' : 'New Application'}
            </Link>
          ) : null
        }
      />

      {/* Loading state */}
      {loading && (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading applications...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && isEmpty && (
        <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl">
          <Inbox size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No application yet</p>
          <p className="text-xs text-gray-400 mb-5">Submit your investment proposal to get started</p>
          <Link
            to="/applications/apply"
            className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} /> Apply Now
          </Link>
        </div>
      )}

      {!loading && !isEmpty && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={<FileText size={16} className="text-indigo-500" />}
              label="Total Submitted"
              value={totalSubmitted}
              color="bg-indigo-50"
            />
            <StatCard
              icon={<TrendingUp size={16} className="text-amber-500" />}
              label="In Progress"
              value={inProgress}
              color="bg-amber-50"
            />
            <StatCard
              icon={<CheckCircle size={16} className="text-green-500" />}
              label="Approved"
              value={approved}
              color="bg-green-50"
            />
            <StatCard
              icon={<XCircle size={16} className="text-red-500" />}
              label="Rejected"
              value={rejected}
              color="bg-red-50"
            />
          </div>

          {/* Pipeline visualization */}
          <PipelineVisualization apps={applications} />

          {/* Draft section */}
          {drafts.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText size={14} className="text-amber-500" />
                Drafts
                <span className="text-xs font-medium text-gray-400">{drafts.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {drafts.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    expanded={expandedId === app.id}
                    onToggle={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    onRefresh={loadApps}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Approved applications */}
          {approvedApps.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                Approved
                <span className="text-xs font-medium text-green-400">{approvedApps.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {approvedApps.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    expanded={expandedId === app.id}
                    onToggle={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    onRefresh={loadApps}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active applications */}
          {activeApps.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                In Progress
                <span className="ml-2 text-xs font-medium text-gray-400">{activeApps.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeApps.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    expanded={expandedId === app.id}
                    onToggle={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    onRefresh={loadApps}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Rejected applications */}
          {rejectedApps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                <XCircle size={14} className="text-red-400" />
                Rejected
                <span className="text-xs font-medium text-red-300">{rejectedApps.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rejectedApps.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    expanded={expandedId === app.id}
                    onToggle={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    onRefresh={loadApps}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

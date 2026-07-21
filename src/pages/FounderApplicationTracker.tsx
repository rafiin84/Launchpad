import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox, Plus, FileText, Clock, CheckCircle, XCircle, Edit2,
  TrendingUp, Building2, DollarSign, ArrowRight, MessageSquare,
  Upload, Check, Send, AlertCircle, Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getApplications,
  canApplyAgain,
  updateApplication,
  deleteApplication,
  parseRequestedDocuments,
  stringifyRequestedDocuments,
  type InvestmentApplication,
  type ApplicationStatus,
  type RequestedDocument,
} from '../services/investmentApplications';
import { addNotification, getNotifications } from '../services/notifications';
import { portalUploadAttachment, zohoUploadAttachment, portalGetById } from '../services/zohoApi';
import { loadRole } from '../services/oauth';
import { cn } from '../lib/cn';
import { usePageTitle } from '../context/PageTitleContext';

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
  const { t } = useLanguage();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  const statusLabels: Record<string, string> = {
    draft: t.applicationTracker.statusDraft,
    submitted: t.applicationTracker.statusSubmitted,
    under_review: t.applicationTracker.statusUnderReview,
    interested: t.applicationTracker.statusInterested,
    more_info_requested: t.applicationTracker.statusMoreInfo,
    documents_requested: t.applicationTracker.statusDocsRequested,
    shortlisted: t.applicationTracker.statusShortlisted,
    meeting_scheduled: t.applicationTracker.statusMeeting,
    due_diligence: t.applicationTracker.statusDueDiligence,
    on_hold: t.applicationTracker.statusOnHold,
    approved: t.applicationTracker.statusApproved,
    invested: t.applicationTracker.statusInvested,
    rejected: t.applicationTracker.statusRejected,
  };
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
      {statusLabels[status] || cfg.label}
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
  const { t } = useLanguage();
  const nonDraft = apps.filter(a => a.status !== 'draft');
  const counts: Record<string, number> = {};
  for (const a of nonDraft) {
    counts[a.status] = (counts[a.status] || 0) + 1;
  }

  const allStages: { status: ApplicationStatus; label: string }[] = [
    { status: 'submitted', label: t.applicationTracker.statusSubmitted },
    { status: 'under_review', label: t.applicationTracker.statusUnderReview },
    { status: 'shortlisted', label: t.applicationTracker.statusShortlisted },
    { status: 'meeting_scheduled', label: t.applicationTracker.statusMeeting },
    { status: 'due_diligence', label: t.applicationTracker.statusDueDiligence },
    { status: 'approved', label: t.applicationTracker.statusApproved },
    { status: 'on_hold', label: t.applicationTracker.statusOnHold },
    { status: 'rejected', label: t.applicationTracker.statusRejected },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 overflow-x-auto">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.applicationTracker.applicationPipeline}</h3>
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
  const { t } = useLanguage();
  const messages = parseInvestorMessages(notes);

  if (messages.length === 0 && !notes) return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <MessageSquare size={12} className="text-indigo-500" />
        <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
          {t.applicationTracker.messagesFromInvestor}
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

// Shows per-doc upload buttons sourced from the investor's notification.
// Falls back to a generic upload if no doc list found.
function GenericDocUpload({ app, onRefresh }: { app: InvestmentApplication; onRefresh: () => void }) {
  const [docTypes, setDocTypes] = useState<string[]>([]);
  const [investorName, setInvestorName] = useState<string>('');
  const [uploaded, setUploaded] = useState<Record<string, { fileName: string; attachmentId: string }>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocType, setActiveDocType] = useState<string | null>(null);

  // Load requested doc types from the investor's notification
  useEffect(() => {
    getNotifications().then(notifications => {
      console.log('[GenericDocUpload] all notifications:', notifications.map(n => ({ actor: n.actor, actorRole: n.actorRole, msg: n.message, requestedDocs: n.requestedDocs })));
      const docsNotif = notifications
        .filter(n => n.actorRole === 'investor' && n.message.includes(app.companyName) &&
          (n.requestedDocs?.length || n.message.toLowerCase().includes('requested the following documents')))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      console.log('[GenericDocUpload] matched notif:', docsNotif);
      if (!docsNotif) return;
      setInvestorName(docsNotif.actor || '');
      if (docsNotif.requestedDocs?.length) {
        setDocTypes(docsNotif.requestedDocs);
      } else {
        // Fallback: parse doc names from message string.
        // Format: "...has requested the following documents for {company}: Doc1, Doc2, Doc3"
        const match = docsNotif.message.match(/:\s*([^:]+)$/);
        if (match) {
          const docs = match[1].split(',').map(d => d.trim()).filter(Boolean);
          if (docs.length > 0) setDocTypes(docs);
        }
      }
    }).catch(() => {});
  }, [app.companyName]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDocType) return;
    setUploading(activeDocType);
    setError(null);
    try {
      const fileName = `[${activeDocType}] ${file.name}`;
      const attachmentId = await portalUploadAttachment('Applications', app.id, file, fileName);
      const newUploaded = { ...uploaded, [activeDocType]: { fileName: file.name, attachmentId } };
      setUploaded(newUploaded);

      // Save all uploaded docs + status to CRM immediately
      const allDocs: RequestedDocument[] = docTypes.length > 0
        ? docTypes.map(t => {
            const u = newUploaded[t];
            return u
              ? { type: t, status: 'submitted' as const, fileName: u.fileName, attachmentId: u.attachmentId }
              : { type: t, status: 'pending' as const };
          })
        : [{ type: activeDocType, status: 'submitted' as const, fileName: file.name, attachmentId }];

      await updateApplication(app.id, {
        requestedDocuments: stringifyRequestedDocuments(allDocs),
        status: 'under_review' as ApplicationStatus,
      }, false);

      addNotification({
        type: 'company_update',
        title: 'Document Uploaded',
        message: `${app.founderName || 'Founder'} uploaded "${activeDocType}" for ${app.companyName}`,
        actor: app.founderName || 'Founder',
        actorRole: 'founder',
        targetRole: 'investor',
        link: `/applications/${app.id}`,
      });
      window.dispatchEvent(new Event('notifications-updated'));
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
    setUploading(null);
    setActiveDocType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerUpload = (docType: string) => {
    setActiveDocType(docType);
    setError(null);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const displayDocs = docTypes.length > 0 ? docTypes : ['Document'];

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Upload size={12} className="text-yellow-600" />
        <p className="text-[10px] font-semibold text-yellow-600 uppercase tracking-wider">Documents Requested</p>
        <span className="text-[10px] text-gray-400 ml-auto">{Object.keys(uploaded).length}/{displayDocs.length} uploaded</span>
      </div>
      {investorName && (
        <p className="text-[11px] text-gray-500 mb-2">
          <span className="font-medium text-gray-700">{investorName}</span> has requested:{' '}
          <span className="font-medium text-gray-800">{displayDocs.join(', ')}</span>
        </p>
      )}
      <div className="space-y-2">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        {displayDocs.map(docType => {
          const done = uploaded[docType];
          const isUploading = uploading === docType;
          return (
            <div key={docType} className={cn('flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border text-xs', done ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100')}>
              <div className="flex items-center gap-2 min-w-0">
                {done ? <Check size={12} className="text-green-500 flex-shrink-0" /> : <Upload size={12} className="text-gray-400 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{docType}</p>
                  {done && <p className="text-[10px] text-gray-400 truncate">{done.fileName}</p>}
                </div>
              </div>
              <button
                onClick={() => triggerUpload(docType)}
                disabled={isUploading}
                className={cn('flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-50', done ? 'text-green-700 bg-green-100 hover:bg-green-200' : 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200')}
              >
                <Upload size={9} /> {isUploading ? 'Saving…' : done ? 'Replace' : 'Upload'}
              </button>
            </div>
          );
        })}
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
    </div>
  );
}

function DocumentUploadSection({ app, onRefresh }: { app: InvestmentApplication; onRefresh: () => void }) {
  const { t } = useLanguage();
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

  // If no specific doc types came from CRM (portal field permission issue),
  // fall back to generic upload UI.
  if (localDocs.length === 0) {
    if (app.status === 'documents_requested') {
      return <GenericDocUpload app={app} onRefresh={onRefresh} />;
    }
    return null;
  }

  const handleFileSelect = (docType: string) => {
    setUploadTarget(docType);
    setUploadError(null);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    setUploading(uploadTarget);
    setUploadError(null);
    try {
      const fileName = `[${uploadTarget}] ${file.name}`;
      const isFounderRole = loadRole() === 'founder';
      const attachmentId = isFounderRole
        ? await portalUploadAttachment('Applications', app.id, file, fileName)
        : await zohoUploadAttachment('Applications', app.id, file, fileName);

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
        targetRole: 'investor',
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
          {t.applicationTracker.requestedDocuments}
        </p>
        <span className="text-[10px] text-gray-400 ml-auto">
          {uploadedDocs.length + submittedDocs.length}/{localDocs.length} {t.applicationTracker.uploaded}
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
              {uploading === doc.type ? t.applicationTracker.uploading : 'Upload'}
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
                <Check size={10} /> {t.applicationTracker.ready}
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
                <Check size={10} /> {t.applicationTracker.submittedStatus}
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
          {submitting ? t.applicationTracker.submittingDocuments : t.applicationTracker.submitDocuments.replace('{n}', String(uploadedDocs.length)).replace('{s}', uploadedDocs.length !== 1 ? 's' : '')}
        </button>
      )}

      {allDone && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
          <CheckCircle size={12} /> {t.applicationTracker.allDocumentsSubmitted}
        </div>
      )}
    </div>
  );
}

const ACTION_REQUIRED: ApplicationStatus[] = ['more_info_requested', 'documents_requested'];

function ApplicationCard({ app, expanded, onToggle, onRefresh, onDelete }: { app: InvestmentApplication; expanded: boolean; onToggle: () => void; onRefresh: () => void; onDelete?: () => void }) {
  const { t } = useLanguage();
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
          {app.status === 'more_info_requested' ? t.applicationTracker.moreInfoRequested : t.applicationTracker.docsRequested}
        </div>
      )}
      {isApproved && (
        <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-100 rounded-lg px-3 py-1.5 mb-3">
          <CheckCircle size={12} />
          {t.applicationTracker.applicationApproved}
        </div>
      )}
      {app.status === 'on_hold' && (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg px-3 py-1.5 mb-3">
          <Clock size={12} />
          {t.applicationTracker.applicationOnHold}
        </div>
      )}
      {app.status === 'rejected' && (
        <div className="flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg px-3 py-1.5 mb-3">
          <XCircle size={12} />
          {t.applicationTracker.applicationDeclined}
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
            {app.status === 'rejected' ? t.applicationTracker.statusRejected : `${PIPELINE_STAGES[stageIndex(app.status)]?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || t.applicationTracker.statusSubmitted} (${progress}%)`}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isDraft ? (
          <>
            <Link
              to={`/applications/apply?edit=${app.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileText size={12} /> {t.applicationTracker.continueEditing}
            </Link>
            {onDelete && (
              <button
                onClick={() => { if (window.confirm('Delete this draft?')) onDelete(); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={onToggle}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {expanded ? t.applicationTracker.hideDetails : t.applicationTracker.viewDetails}
              <ArrowRight size={12} className={cn('transition-transform', expanded && 'rotate-90')} />
            </button>
            {!isApproved && app.status !== 'rejected' && (
              <Link
                to={`/applications/apply?edit=${app.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Edit2 size={12} /> {t.applicationTracker.editApplication}
              </Link>
            )}
          </>
        )}
      </div>

      {/* Expanded details — two-column layout: left = company profile, right = messages/meeting/docs */}
      {expanded && !isDraft && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column — company profile */}
            <div className="lg:col-span-2 space-y-3">
              {app.companyDescription && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.applicationTracker.description}</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{app.companyDescription}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {app.companyStage && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{t.applicationTracker.stage}</p>
                    <p className="text-xs text-gray-700">{app.companyStage}</p>
                  </div>
                )}
                {app.companyLocation && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{t.applicationTracker.location}</p>
                    <p className="text-xs text-gray-700">{app.companyLocation}</p>
                  </div>
                )}
                {app.currentRevenue && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{t.applicationTracker.revenue}</p>
                    <p className="text-xs text-gray-700">{formatCurrency(app.currentRevenue)}</p>
                  </div>
                )}
                {app.equityOffered && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{t.applicationTracker.equityOffered}</p>
                    <p className="text-xs text-gray-700">{app.equityOffered}%</p>
                  </div>
                )}
              </div>
              {app.problemStatement && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.applicationTracker.problem}</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{app.problemStatement}</p>
                </div>
              )}
              {app.solution && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.applicationTracker.solution}</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{app.solution}</p>
                </div>
              )}
              {app.useOfFunds && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.applicationTracker.useOfFunds}</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{app.useOfFunds}</p>
                </div>
              )}
            </div>

            {/* Right column — messages, meeting, documents */}
            <div className="lg:col-span-1 space-y-4">
              {app.investorNotes && (
                <InvestorMessages notes={app.investorNotes} reviewedBy={app.reviewedBy} reviewedAt={app.reviewedAt} />
              )}

              {app.meetingDate && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Clock size={12} className="text-violet-600" />
                    <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">
                      {t.applicationTracker.meetingScheduled}
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
                      <p className="text-[11px] text-gray-600"><span className="font-semibold text-gray-500">{t.applicationTracker.location}:</span> {app.meetingLocation}</p>
                    )}
                    {app.meetingLink && (
                      <p className="text-[11px] text-gray-600">
                        <span className="font-semibold text-gray-500">Link:</span>{' '}
                        <a href={app.meetingLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{app.meetingLink}</a>
                      </p>
                    )}
                    {app.meetingAgenda && (
                      <p className="text-[11px] text-gray-600"><span className="font-semibold text-gray-500">{t.applicationTracker.agenda}:</span> {app.meetingAgenda}</p>
                    )}
                  </div>
                </div>
              )}

              <DocumentUploadSection app={app} onRefresh={onRefresh} />
            </div>
          </div>
        </div>
      )}

      {/* When collapsed and docs requested, show upload section directly */}
      {!expanded && !isDraft && app.status === 'documents_requested' && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <DocumentUploadSection app={app} onRefresh={onRefresh} />
        </div>
      )}

      {/* When collapsed, still show messages/meeting/docs below card summary */}
      {!expanded && !isDraft && (app.investorNotes || app.meetingDate) && (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
          {app.investorNotes && (
            <InvestorMessages notes={app.investorNotes} reviewedBy={app.reviewedBy} reviewedAt={app.reviewedAt} />
          )}
          {app.meetingDate && (
            <div>
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
                {app.meetingAgenda && (
                  <p className="text-[11px] text-gray-600"><span className="font-semibold text-gray-500">{t.applicationTracker.agenda}:</span> {app.meetingAgenda}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FounderApplicationTracker() {
  const { t } = useLanguage();
  const { setPageTitle } = usePageTitle();
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

  useEffect(() => { setPageTitle(t.applicationTracker.myApplication, t.applicationTracker.trackDescription); return () => setPageTitle(null); }, [t]);
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
      {allowNewApplication && (
        <div className="flex justify-end mb-4">
          <Link
            to="/applications/apply"
            className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} /> {applications.some(a => a.status === 'rejected') ? t.applicationTracker.reApply : t.applicationTracker.newApplication}
          </Link>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t.applicationTracker.loadingApplications}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && isEmpty && (
        <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl">
          <Inbox size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">{t.applicationTracker.noApplicationYet}</p>
          <p className="text-xs text-gray-400 mb-5">{t.applicationTracker.noApplicationDesc}</p>
          <Link
            to="/applications/apply"
            className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} /> {t.applicationTracker.applyNow}
          </Link>
        </div>
      )}

      {!loading && !isEmpty && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={<FileText size={16} className="text-indigo-500" />}
              label={t.applicationTracker.totalSubmitted}
              value={totalSubmitted}
              color="bg-indigo-50"
            />
            <StatCard
              icon={<TrendingUp size={16} className="text-amber-500" />}
              label={t.applicationTracker.inProgress}
              value={inProgress}
              color="bg-amber-50"
            />
            <StatCard
              icon={<CheckCircle size={16} className="text-green-500" />}
              label={t.applicationTracker.approved}
              value={approved}
              color="bg-green-50"
            />
            <StatCard
              icon={<XCircle size={16} className="text-red-500" />}
              label={t.applicationTracker.rejected}
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
                {t.applicationTracker.drafts}
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
                    onDelete={async () => { await deleteApplication(app.id, false); loadApps(); }}
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
                {t.applicationTracker.approved}
                <span className="text-xs font-medium text-green-400">{approvedApps.length}</span>
              </h2>
              <div className="space-y-4">
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
                {t.applicationTracker.inProgress}
                <span className="ml-2 text-xs font-medium text-gray-400">{activeApps.length}</span>
              </h2>
              <div className="space-y-4">
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
                {t.applicationTracker.rejected}
                <span className="text-xs font-medium text-red-300">{rejectedApps.length}</span>
              </h2>
              <div className="space-y-4">
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

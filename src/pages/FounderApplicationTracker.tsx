import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox, Plus, FileText, Clock, CheckCircle, XCircle, Edit2,
  Building2, ArrowRight, MessageSquare, CalendarClock,
  Upload, Check, Send, Trash2,
} from 'lucide-react';
import FounderReviewProgress from '../components/applications/FounderReviewProgress';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getApplications,
  wasFounderFetchAuthError,
  canApplyAgain,
  updateApplication,
  deleteApplication,
  isApplicationLocked,
  parseRequestedDocuments,
  stringifyRequestedDocuments,
  uploadApplicationDocumentFile,
  attachApplicationDocumentFile,
  resolveApplicationDocumentUrl,
  requestedDocumentFileId,
  type InvestmentApplication,
  type ApplicationStatus,
  type RequestedDocument,
} from '../services/investmentApplications';
import { addNotification } from '../services/notifications';
import { resolveDocumentUrl, type CRMDocument } from '../services/crmDocuments';
import { DocumentViewerModal } from '../components/ui/DocumentViewerModal';
import { cn } from '../lib/cn';
import { usePageTitle } from '../context/PageTitleContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
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
  level1_screening:    { label: 'Level 1 — Screening', color: '#0284c7', bg: 'bg-sky-50',      text: 'text-sky-600' },
  level1_cleared:      { label: 'Level 1 Cleared',    color: '#0369a1', bg: 'bg-sky-100',     text: 'text-sky-700' },
  level2_cleared:      { label: 'Level 2 Cleared',    color: '#4338ca', bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  level3_cleared:      { label: 'Level 3 Cleared',    color: '#6d28d9', bg: 'bg-violet-100',  text: 'text-violet-700' },
  not_shortlisted:     { label: 'Not Shortlisted',    color: '#ef4444', bg: 'bg-red-50',      text: 'text-red-600' },
  approved:            { label: 'Approved',           color: '#22c55e', bg: 'bg-green-50',    text: 'text-green-600' },
  invested:            { label: 'Invested',           color: '#15803d', bg: 'bg-green-100',   text: 'text-green-700' },
  rejected:            { label: 'Rejected',           color: '#ef4444', bg: 'bg-red-50',      text: 'text-red-600' },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusLabel({ status }: { status: ApplicationStatus }) {
  const { t } = useLanguage();
  const map: Record<string, string> = {
    draft: t.applicationTracker.statusDraft, submitted: t.applicationTracker.statusSubmitted,
    under_review: t.applicationTracker.statusUnderReview, interested: t.applicationTracker.statusInterested,
    more_info_requested: t.applicationTracker.statusMoreInfo, documents_requested: t.applicationTracker.statusDocsRequested,
    shortlisted: t.applicationTracker.statusShortlisted, meeting_scheduled: t.applicationTracker.statusMeeting,
    due_diligence: t.applicationTracker.statusDueDiligence, on_hold: t.applicationTracker.statusOnHold,
    level1_screening: t.applicationTracker.statusLevel1Screening, level1_cleared: t.applicationTracker.statusLevel1Cleared,
    level2_cleared: t.applicationTracker.statusLevel2Cleared, level3_cleared: t.applicationTracker.statusLevel3Cleared,
    not_shortlisted: t.applicationTracker.statusNotShortlisted, approved: t.applicationTracker.statusApproved,
    invested: t.applicationTracker.statusInvested, rejected: t.applicationTracker.statusRejected,
  };
  return <>{map[status] || STATUS_CONFIG[status]?.label || status}</>;
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
    <div>
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

interface SubmittedDoc {
  name: string;
  link?: string;             // pasted share link
  documentId?: string;       // LEGACY: My_Documents record id (old direct upload) — canonicalized from doc.recordId too, see requestedDocumentFileId
  attachmentId?: string;     // LEGACY: File_Upload_1 attachment id on that record
  fileAttachmentId?: string; // current uploads: this file's own attachment id on the Application's own Requested_Document_Files field
}

function toRequestedDocs(docTypes: string[], submitted: Record<string, SubmittedDoc>): RequestedDocument[] {
  return docTypes.map(t => {
    const d = submitted[t];
    if (!d) return { type: t, status: 'pending' as const };
    return {
      type: t,
      status: 'submitted' as const,
      fileName: d.name,
      ...(d.link ? { link: d.link } : {}),
      ...(d.documentId ? { documentId: d.documentId, attachmentId: d.attachmentId } : {}),
      ...(d.fileAttachmentId ? { fileAttachmentId: d.fileAttachmentId } : {}),
    };
  });
}

// Shows per-doc upload buttons sourced from the application's Requested_Documents
// field (fetched with the record by portalList/portalSearch). Founders can either
// paste a share link (Google Drive / Dropbox) or upload the file directly — direct
// upload stores the file on the Application's own Requested_Document_Files field
// (uploadApplicationDocumentFile + attachApplicationDocumentFile), never in
// My_Documents, so it's scoped to this application and never shows on the
// Documents page. Works for portal tokens too (unlike the CRM Attachments API,
// which is blocked for founders).
function GenericDocUpload({ app, onRefresh }: { app: InvestmentApplication; onRefresh: () => void }) {
  const [docTypes, setDocTypes] = useState<string[]>([]);
  const [investorName, setInvestorName] = useState<string>('');
  const [submitted, setSubmitted] = useState<Record<string, SubmittedDoc>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileTarget, setFileTarget] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ name: string; fileName: string } | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const viewerRevokeRef = useRef(false);

  // Load requested doc types + any already-submitted files/links from the record.
  useEffect(() => {
    if (app.reviewedBy) setInvestorName(app.reviewedBy);
    const parsed = parseRequestedDocuments(app.requestedDocuments);
    if (parsed.length > 0) {
      setDocTypes(parsed.map(d => d.type));
      const pre: Record<string, SubmittedDoc> = {};
      parsed.forEach(d => {
        const legacyFileId = requestedDocumentFileId(d);
        if (d.fileAttachmentId) {
          pre[d.type] = { name: d.fileName || d.type, fileAttachmentId: d.fileAttachmentId };
        } else if (legacyFileId && d.attachmentId) {
          // Legacy: uploaded before requested docs moved onto the Application itself.
          // The mobile app writes this reference under recordId instead of documentId —
          // canonicalize to documentId here since that's the key this app serializes back.
          pre[d.type] = { name: d.fileName || d.type, documentId: legacyFileId, attachmentId: d.attachmentId };
        } else {
          // attachmentId held the link directly in even older records, before documentId existed.
          const link = d.link || (d.attachmentId && /^https?:\/\//i.test(d.attachmentId) ? d.attachmentId : '');
          if (link) pre[d.type] = { name: d.fileName || d.type, link };
        }
      });
      setSubmitted(pre);
    } else {
      setDocTypes(['Document']);
    }
  }, [app.requestedDocuments, app.reviewedBy]);

  const setErr = (docType: string, msg: string) => setErrors(prev => ({ ...prev, [docType]: msg }));

  // Persist one doc's link/file reference to CRM and notify the investor.
  const save = async (docType: string, entry: SubmittedDoc) => {
    const next = { ...submitted, [docType]: entry };
    setSubmitted(next);
    // Submitting a document must NOT change Application_Status — that field is
    // the review stage, and writing to it here would pull the application out
    // of whichever reviewer's queue it is currently sitting in.
    await updateApplication(app.id, {
      requestedDocuments: stringifyRequestedDocuments(toRequestedDocs(docTypes, next)),
    }, false);
    addNotification({
      type: 'company_update',
      title: 'Document Submitted',
      message: `${app.founderName || 'Founder'} submitted "${docType}" for ${app.companyName}`,
      actor: app.founderName || 'Founder',
      actorRole: 'founder',
      targetRole: 'investor',
      link: `/applications/${app.id}`,
    });
    window.dispatchEvent(new Event('notifications-updated'));
    onRefresh();
  };

  const handleSubmitLink = async (docType: string) => {
    const link = (links[docType] || '').trim();
    if (!link) return;
    if (!/^https?:\/\//i.test(link)) {
      setErr(docType, 'Enter a full link starting with https://');
      return;
    }
    setBusy(docType);
    setErr(docType, '');
    try {
      await save(docType, { name: docType, link });
      setLinks(prev => { const n = { ...prev }; delete n[docType]; return n; });
    } catch (err) {
      setErr(docType, err instanceof Error ? err.message : 'Failed to save.');
    }
    setBusy(null);
  };

  const triggerFile = (docType: string) => {
    setFileTarget(docType);
    setErr(docType, '');
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docType = fileTarget;
    if (!file || !docType) return;
    setBusy(docType);
    setErr(docType, '');
    try {
      const fileId = await uploadApplicationDocumentFile(file);
      const fileAttachmentId = await attachApplicationDocumentFile(app.id, fileId);
      await save(docType, { name: file.name, fileAttachmentId });
    } catch (err) {
      setErr(docType, err instanceof Error ? err.message : 'Upload failed.');
    }
    setBusy(null);
    setFileTarget(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove a submitted doc → set it back to pending so the founder can re-send.
  const handleRemove = async (docType: string) => {
    setBusy(docType);
    setErr(docType, '');
    const next = { ...submitted };
    delete next[docType];
    try {
      await updateApplication(app.id, {
        requestedDocuments: stringifyRequestedDocuments(toRequestedDocs(docTypes, next)),
      }, false);
      setSubmitted(next);
      addNotification({
        type: 'company_update',
        title: 'Document Removed',
        message: `${app.founderName || 'Founder'} removed "${docType}" for ${app.companyName} and may re-send it.`,
        actor: app.founderName || 'Founder',
        actorRole: 'founder',
        targetRole: 'investor',
        link: `/applications/${app.id}`,
      });
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      setErr(docType, err instanceof Error ? err.message : 'Failed to remove.');
    }
    setBusy(null);
  };

  const closeViewer = () => {
    if (viewerRevokeRef.current && viewerUrl) URL.revokeObjectURL(viewerUrl);
    setViewer(null);
    setViewerUrl(null);
    setViewerError('');
  };

  const handleViewFile = async (docType: string, entry: SubmittedDoc) => {
    if (!entry.fileAttachmentId && !(entry.documentId && entry.attachmentId)) return;
    setViewer({ name: docType, fileName: entry.name });
    setViewerUrl(null);
    setViewerError('');
    setViewerLoading(true);
    try {
      const { url, revoke } = entry.fileAttachmentId
        ? await resolveApplicationDocumentUrl(app.id, entry.fileAttachmentId)
        : await resolveDocumentUrl({
            id: entry.documentId!, fileUploadId: entry.attachmentId!, fileUrl: '', fileName: entry.name,
          } as CRMDocument);
      viewerRevokeRef.current = revoke;
      setViewerUrl(url);
    } catch (err) {
      setViewerError(err instanceof Error ? err.message : 'Failed to open document.');
    } finally {
      setViewerLoading(false);
    }
  };

  const handleViewerDownload = () => {
    if (!viewerUrl || !viewer) return;
    const a = document.createElement('a');
    a.href = viewerUrl;
    a.download = viewer.fileName || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Nothing to show unless the investor actually requested documents.
  const hasRealDocs = docTypes.length > 0 && !(docTypes.length === 1 && docTypes[0] === 'Document');
  // Nothing to upload against a decided application.
  if (isApplicationLocked(app)) return null;
  if (!hasRealDocs && pendingDocCount(app) === 0 && app.status !== 'documents_requested') return null;

  const displayDocs = docTypes.length > 0 ? docTypes : ['Document'];
  const doneCount = Object.keys(submitted).length;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {viewer && (
        <DocumentViewerModal
          title={viewer.name}
          fileName={viewer.fileName}
          url={viewerUrl}
          loading={viewerLoading}
          error={viewerError}
          previewable={/\.pdf$/i.test(viewer.fileName || '')}
          onClose={closeViewer}
          onDownload={handleViewerDownload}
        />
      )}
      <div className="flex items-center gap-1.5 mb-1.5">
        <Upload size={12} className="text-yellow-600" />
        <p className="text-[10px] font-semibold text-yellow-600 uppercase tracking-wider">Documents Requested</p>
        <span className="text-[10px] text-gray-400 ml-auto">{doneCount}/{displayDocs.length} submitted</span>
      </div>
      {investorName && (
        <p className="text-[11px] text-gray-500 mb-1.5">
          <span className="font-medium text-gray-700">{investorName}</span> has requested:{' '}
          <span className="font-medium text-gray-800">{displayDocs.join(', ')}</span>
        </p>
      )}
      <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
        Upload a file from your device, or paste a Google Drive / Dropbox share link.
      </p>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.zip" />
      <div className="space-y-2">
        {displayDocs.map(docType => {
          const done = submitted[docType];
          const isBusy = busy === docType;
          const err = errors[docType];
          return (
            <div key={docType} className={cn('rounded-xl px-3 py-2.5 border text-xs', done ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100')}>
              <div className="flex items-center gap-2 mb-1.5">
                {done ? <Check size={12} className="text-green-500 flex-shrink-0" /> : <FileText size={12} className="text-gray-400 flex-shrink-0" />}
                <p className="font-medium text-gray-800 flex-1 truncate">{docType}</p>
                {done && <span className="text-[10px] text-green-600 font-semibold">Submitted</span>}
              </div>
              {done ? (
                <div className="flex items-center gap-2">
                  {done.link ? (
                    <a href={done.link} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-indigo-500 hover:underline truncate flex-1 min-w-0">
                      {done.name}
                    </a>
                  ) : (
                    <button
                      onClick={() => handleViewFile(docType, done)}
                      className="text-[10px] text-indigo-500 hover:underline truncate flex-1 min-w-0 text-left"
                    >
                      {done.name}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(docType)}
                    disabled={isBusy}
                    className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 size={9} /> {isBusy ? 'Removing…' : 'Delete & re-send'}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-1.5 items-center">
                    <span className="text-[10px] text-gray-400 flex-1">Upload from your device</span>
                    <button
                      onClick={() => triggerFile(docType)}
                      disabled={isBusy}
                      className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-40 transition-colors"
                    >
                      <Upload size={9} /> {isBusy && fileTarget === docType ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="…or paste a share link"
                    value={links[docType] || ''}
                    onChange={e => setLinks(prev => ({ ...prev, [docType]: e.target.value }))}
                    onPaste={e => {
                      const text = e.clipboardData.getData('text');
                      if (text) {
                        e.preventDefault();
                        setLinks(prev => ({ ...prev, [docType]: text.trim() }));
                      }
                    }}
                    className="w-full text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-indigo-300"
                  />
                  <button
                    onClick={() => handleSubmitLink(docType)}
                    disabled={isBusy || !(links[docType] || '').trim()}
                    className="w-full inline-flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 disabled:opacity-40 transition-colors"
                  >
                    <Send size={9} /> {isBusy && fileTarget !== docType ? 'Saving…' : 'Submit link'}
                  </button>
                </div>
              )}
              {err && <p className="text-[10px] text-red-500 mt-1">{err}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Supporting actions no longer change Application_Status — that field is the
 * pipeline stage only, so an application never leaves its reviewer's queue
 * when someone asks for a document. The founder-facing "action needed" state
 * is therefore derived from the data itself.
 */
function pendingDocCount(app: InvestmentApplication): number {
  return parseRequestedDocuments(app.requestedDocuments)
    .filter(d => d.status !== 'submitted').length;
}

function needsFounderAction(app: InvestmentApplication): boolean {
  if (pendingDocCount(app) > 0) return true;
  // Legacy records written before stage/activity were separated
  return app.status === 'more_info_requested' || app.status === 'documents_requested';
}


function MeetingBlock({ app }: { app: InvestmentApplication }) {
  const { t } = useLanguage();
  if (!app.meetingDate) return null;
  const when = new Date(app.meetingDate);
  if (isNaN(when.getTime())) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <CalendarClock size={12} className="text-violet-600" />
        <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">
          {t.applicationTracker.meetingScheduled}
        </p>
      </div>
      <div className="flex items-stretch gap-3 bg-violet-50 border border-violet-100 rounded-xl p-3">
        <div className="w-14 flex-shrink-0 rounded-lg bg-white border border-violet-100 flex flex-col items-center justify-center py-1.5">
          <span className="text-[10px] font-semibold uppercase text-violet-500">
            {when.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-lg font-bold leading-none text-gray-900">{when.getDate()}</span>
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold text-gray-900">
            {when.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            <span className="text-violet-600">
              {when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
    </div>
  );
}

/** A labelled, bordered block — the same sectioned look as the investor's application page. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ApplicationCard({ app, expanded, onToggle, onRefresh, onDelete, hideProgress = false }: { app: InvestmentApplication; expanded: boolean; onToggle: () => void; onRefresh: () => void; onDelete?: () => void; hideProgress?: boolean }) {
  const { t } = useLanguage();
  const isDraft = app.status === 'draft';
  const isApproved = app.status === 'approved' || app.status === 'invested';
  const needsAction = needsFounderAction(app);
  const showDocs = expanded || (!isApplicationLocked(app) && (pendingDocCount(app) > 0 || app.status === 'documents_requested'));
  const when = relativeTime((isDraft ? app.updatedAt : app.submittedAt) || app.updatedAt);
  const hasUpdates = !isDraft && (!!app.investorNotes || !!app.meetingDate || showDocs);

  // Soft tints rather than saturated fills — the status reads from the hue
  // without the whole card shouting green or red.
  const tone =
    isDraft ? { band: 'bg-amber-50 border-amber-100', icon: 'bg-amber-100 text-amber-700', pill: 'bg-amber-100 text-amber-800', sub: 'text-amber-800/70' } :
    isApproved ? { band: 'bg-emerald-50 border-emerald-100', icon: 'bg-emerald-100 text-emerald-700', pill: 'bg-emerald-100 text-emerald-800', sub: 'text-emerald-800/70' } :
    app.status === 'rejected' || app.status === 'not_shortlisted' ? { band: 'bg-rose-50 border-rose-100', icon: 'bg-rose-100 text-rose-700', pill: 'bg-rose-100 text-rose-800', sub: 'text-rose-800/70' } :
    app.status === 'on_hold' ? { band: 'bg-slate-50 border-slate-100', icon: 'bg-slate-100 text-slate-600', pill: 'bg-slate-100 text-slate-700', sub: 'text-slate-600/80' } :
    { band: 'bg-indigo-50 border-indigo-100', icon: 'bg-indigo-100 text-indigo-700', pill: 'bg-indigo-100 text-indigo-800', sub: 'text-indigo-800/70' };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Header band */}
      <div className={cn('px-5 py-4 border-b', tone.band)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center', tone.icon)}>
              <Building2 size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-gray-900 truncate">{app.companyName || 'Untitled'}</p>
                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', tone.pill)}>
                  <StatusLabel status={app.status} />
                </span>
              </div>
              <p className={cn('text-xs mt-0.5 truncate', tone.sub)}>
                {[app.companyIndustry, app.companyStage, app.companyLocation].filter(Boolean).join('  ·  ')}
                {when && <>{app.companyIndustry || app.companyStage || app.companyLocation ? '  ·  ' : ''}{isDraft ? 'Edited' : 'Submitted'} {when}</>}
              </p>
            </div>
          </div>
          {app.fundingAsk && (
            <div className="flex-shrink-0 text-right bg-white border border-gray-100 rounded-xl px-3.5 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Funding ask</p>
              <p className="text-lg font-bold leading-tight text-gray-900">{formatCurrency(app.fundingAsk)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Status banners */}
        {needsAction && (
          <div className="flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <Clock size={13} className="flex-shrink-0" />
            {pendingDocCount(app) > 0 || app.status === 'documents_requested'
              ? t.applicationTracker.docsRequested
              : t.applicationTracker.moreInfoRequested}
          </div>
        )}
        {isApproved && !hideProgress && (
          <div className="flex items-center gap-2 text-xs font-medium text-green-800 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
            <CheckCircle size={13} className="flex-shrink-0" />
            {t.applicationTracker.applicationApproved}
          </div>
        )}
        {app.status === 'on_hold' && (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
            <Clock size={13} className="flex-shrink-0" />
            {t.applicationTracker.applicationOnHold}
          </div>
        )}
        {app.status === 'rejected' && (
          <div className="flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <XCircle size={13} className="flex-shrink-0" />
            {t.applicationTracker.applicationDeclined}
          </div>
        )}

        {/* Review progress — compact bar, unless the right-hand rail already shows it */}
        {!isDraft && !hideProgress && <FounderReviewProgress app={app} variant="compact" />}

        {/* Investor updates: messages, meeting and requested documents */}
        {hasUpdates && (
          <div className="space-y-3">
            {app.investorNotes && (
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4">
                <InvestorMessages notes={app.investorNotes} reviewedBy={app.reviewedBy} reviewedAt={app.reviewedAt} />
              </div>
            )}
            {app.meetingDate && !isNaN(new Date(app.meetingDate).getTime()) && (
              <div className="bg-violet-50/40 border border-violet-100 rounded-xl p-4">
                <MeetingBlock app={app} />
              </div>
            )}
            {showDocs && <GenericDocUpload app={app} onRefresh={onRefresh} />}
          </div>
        )}

        {/* Expanded details — the application as submitted */}
        {expanded && !isDraft && (
          <div className="space-y-4 pt-1">
            {!hideProgress && (
              <FounderReviewProgress app={app} variant="detailed" actionNeeded={needsFounderAction(app)} />
            )}
            {(app.companyDescription || app.problemStatement || app.solution) && (
              <Section title="Business overview">
                {app.companyDescription && <Field label={t.applicationTracker.description} value={app.companyDescription} />}
                {app.problemStatement && <Field label={t.applicationTracker.problem} value={app.problemStatement} />}
                {app.solution && <Field label={t.applicationTracker.solution} value={app.solution} />}
              </Section>
            )}
            {(app.companyStage || app.companyLocation || app.currentRevenue || app.equityOffered) && (
              <Section title="Company">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {app.companyStage && <Field label={t.applicationTracker.stage} value={app.companyStage} />}
                  {app.companyLocation && <Field label={t.applicationTracker.location} value={app.companyLocation} />}
                  {app.currentRevenue && <Field label={t.applicationTracker.revenue} value={formatCurrency(app.currentRevenue)} />}
                  {app.equityOffered && <Field label={t.applicationTracker.equityOffered} value={`${app.equityOffered}%`} />}
                </div>
              </Section>
            )}
            {app.useOfFunds && (
              <Section title="Funding">
                <Field label={t.applicationTracker.useOfFunds} value={app.useOfFunds} />
              </Section>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/60">
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              {expanded ? t.applicationTracker.hideDetails : t.applicationTracker.viewDetails}
              <ArrowRight size={12} className={cn('transition-transform', expanded && 'rotate-90')} />
            </button>
            {!isApplicationLocked(app) && (
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
  const [sessionExpired, setSessionExpired] = useState(false);

  const loadApps = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const all = await getApplications(isInvestor, currentUser?.email);
    setApplications(all);
    setSessionExpired(!isInvestor && all.length === 0 && wasFounderFetchAuthError());
    if (!silent) setLoading(false);
  }, [isInvestor, currentUser?.email]);

  useEffect(() => { setPageTitle(t.applicationTracker.myApplication, t.applicationTracker.trackDescription); return () => setPageTitle(null); }, [t]);
  useEffect(() => { loadApps(); }, [loadApps]);

  // Investor decisions land in CRM from a different session, so this page has
  // to re-read rather than wait for a manual refresh. Poll only while the tab
  // is actually visible, and re-read immediately on focus or a new
  // notification — all silently, so the view never flashes a spinner.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') loadApps(true); };
    const onVisibility = () => { if (document.visibilityState === 'visible') loadApps(true); };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('notifications-updated', refresh);
    const timer = window.setInterval(refresh, 60_000);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('notifications-updated', refresh);
      window.clearInterval(timer);
    };
  }, [loadApps]);

  const drafts = applications.filter(a => a.status === 'draft');
  const approvedApps = applications.filter(a => a.status === 'approved' || a.status === 'invested');
  // not_shortlisted is terminal: it belongs with the decided applications, not
  // the live ones, or it would sit under "Your Application" as if still open.
  const rejectedApps = applications.filter(a => a.status === 'rejected' || a.status === 'not_shortlisted');
  const activeApps = applications.filter(a =>
    a.status !== 'draft' && a.status !== 'approved' && a.status !== 'invested'
    && a.status !== 'rejected' && a.status !== 'not_shortlisted');

  // The application whose progress heads the page: the live one if there is
  // one, otherwise the most recent decided one.
  const primaryApp = activeApps[0] ?? approvedApps[0] ?? rejectedApps[0] ?? null;

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

      {/* Session-expired state — the token is invalid, so we couldn't load apps.
          Show this instead of the misleading "no application yet" empty state. */}
      {!loading && isEmpty && sessionExpired && (
        <div className="text-center py-20 border-2 border-dashed border-amber-200 bg-amber-50/30 rounded-2xl">
          <Clock size={32} className="text-amber-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">Session expired</p>
          <p className="text-xs text-gray-500 mb-5">Your sign-in has timed out. Please sign in again to see your applications.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            Sign in again
          </Link>
        </div>
      )}

      {/* Empty state (genuinely no applications) */}
      {!loading && isEmpty && !sessionExpired && (
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
        <div className={cn('grid grid-cols-1 gap-6 items-start', primaryApp && 'lg:grid-cols-3')}>
          {/* Application progress — a sticky rail on the right, mirroring the
              investor's Shortlisting Pipeline, so the founder can follow the
              review while scrolling their application. */}
          {primaryApp && (
            <aside className="order-first lg:order-none lg:col-start-3 lg:row-start-1 lg:sticky lg:top-6">
              <FounderReviewProgress
                app={primaryApp}
                variant="rail"
                actionNeeded={needsFounderAction(primaryApp)}
              />
            </aside>
          )}

          <div className={cn('min-w-0', primaryApp && 'lg:col-span-2 lg:col-start-1 lg:row-start-1')}>
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
                    hideProgress={primaryApp?.id === app.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active applications — progress now lives in the hero above, so this
              section carries the application record and its actions. */}
          {activeApps.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                {t.applicationTracker.yourApplication}
                {activeApps.length > 1 && (
                  <span className="ml-2 text-xs font-medium text-gray-400">{activeApps.length}</span>
                )}
              </h2>
              <div className="space-y-4">
                {activeApps.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    expanded={expandedId === app.id}
                    onToggle={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    onRefresh={loadApps}
                    hideProgress={primaryApp?.id === app.id}
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
                    hideProgress={primaryApp?.id === app.id}
                  />
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

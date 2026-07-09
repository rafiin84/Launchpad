import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, ExternalLink, FileText, Play, StickyNote,
  CheckCircle2, Pause, XCircle, MessageSquare, FileUp, Calendar,
  Star, Send, Inbox, X, Check, Clock, Info, Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getApplicationById,
  updateApplicationStatus,
  updateApplication,
  approveApplication,
  parseRequestedDocuments,
  stringifyRequestedDocuments,
  DOCUMENT_TYPES,
  type InvestmentApplication,
  type ApplicationStatus,
  type RequestedDocument,
  type ApprovalDetails,
} from '../services/investmentApplications';
import { addNotification } from '../services/notifications';
import { cn } from '../lib/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === 0) return '—';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
  draft:                { label: 'Draft',              color: 'text-gray-600',    bg: 'bg-gray-100' },
  submitted:            { label: 'Submitted',          color: 'text-blue-600',    bg: 'bg-blue-50' },
  under_review:         { label: 'Under Review',       color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  interested:           { label: 'Interested',         color: 'text-emerald-600', bg: 'bg-emerald-50' },
  more_info_requested:  { label: 'More Info',          color: 'text-amber-600',   bg: 'bg-amber-50' },
  documents_requested:  { label: 'Docs Requested',     color: 'text-yellow-600',  bg: 'bg-yellow-50' },
  shortlisted:          { label: 'Shortlisted',        color: 'text-purple-600',  bg: 'bg-purple-50' },
  meeting_scheduled:    { label: 'Meeting',            color: 'text-violet-600',  bg: 'bg-violet-50' },
  due_diligence:        { label: 'Due Diligence',      color: 'text-orange-600',  bg: 'bg-orange-50' },
  on_hold:              { label: 'On Hold',            color: 'text-slate-600',   bg: 'bg-slate-100' },
  approved:             { label: 'Approved',           color: 'text-green-600',   bg: 'bg-green-50' },
  invested:             { label: 'Invested',           color: 'text-green-700',   bg: 'bg-green-100' },
  rejected:             { label: 'Rejected',           color: 'text-red-600',     bg: 'bg-red-50' },
};

const NOTIFICATION_MESSAGES: Record<string, (companyName: string, investorName: string) => { title: string; message: string }> = {
  approved:            (c, i) => ({ title: 'Application Approved', message: `Congratulations! Your application for ${c} has been approved by ${i}.` }),
  rejected:            (c, i) => ({ title: 'Application Rejected', message: `Your application for ${c} has been reviewed and was not selected to move forward.` }),
  on_hold:             (c, i) => ({ title: 'Application On Hold', message: `Your application for ${c} has been placed on hold. The investor will follow up soon.` }),
  more_info_requested: (c, i) => ({ title: 'Additional Information Requested', message: `${i} has requested additional information for your application (${c}). Please check your application and provide the requested details.` }),
  documents_requested: (c, i) => ({ title: 'Documents Requested', message: `${i} has requested additional documents for your application (${c}). Please upload the required documents.` }),
  meeting_scheduled:   (c, i) => ({ title: 'Meeting Scheduled', message: `${i} would like to schedule a meeting to discuss your application for ${c}. Please check for further details.` }),
  shortlisted:         (c, i) => ({ title: 'Application Shortlisted', message: `Great news! Your application for ${c} has been shortlisted by ${i} for further evaluation.` }),
  under_review:        (c, i) => ({ title: 'Application Under Review', message: `Your application for ${c} is now being actively reviewed by the investment team.` }),
  interested:          (c, i) => ({ title: 'Investor Interested', message: `${i} has expressed interest in your application for ${c}.` }),
  due_diligence:       (c, i) => ({ title: 'Due Diligence Started', message: `Your application for ${c} has moved to due diligence review.` }),
};

const STAGE_COLORS: Record<string, { color: string; bg: string }> = {
  Idea:        { color: 'text-gray-600',    bg: 'bg-gray-100' },
  'Pre-Seed':  { color: 'text-sky-600',     bg: 'bg-sky-50' },
  Seed:        { color: 'text-blue-600',    bg: 'bg-blue-50' },
  'Series A':  { color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  'Series B':  { color: 'text-violet-600',  bg: 'bg-violet-50' },
  'Series C':  { color: 'text-purple-600',  bg: 'bg-purple-50' },
  Growth:      { color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full', cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_COLORS[stage] ?? { color: 'text-gray-600', bg: 'bg-gray-100' };
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      {stage || 'Unknown'}
    </span>
  );
}

// ─── Video embed ──────────────────────────────────────────────────────────────

function VideoEmbed({ url }: { url: string }) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const ytId = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v');
      if (ytId) return (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <iframe src={`https://www.youtube.com/embed/${ytId}`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      );
    }
    if (u.hostname.includes('vimeo.com')) {
      const vid = u.pathname.split('/').pop();
      if (vid) return (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <iframe src={`https://player.vimeo.com/video/${vid}`} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      );
    }
    if (u.hostname.includes('loom.com')) {
      const lid = u.pathname.split('/').pop();
      if (lid) return (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <iframe src={`https://www.loom.com/embed/${lid}`} className="w-full h-full" allowFullScreen />
        </div>
      );
    }
  } catch { /* not a valid URL */ }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
      <Play size={12} /> Watch Demo Video <ExternalLink size={10} />
    </a>
  );
}

// ─── Detail section components ────────────────────────────────────────────────

function InfoRow({ label, value, href }: { label: string; value?: string; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 font-medium">
          {value} <ExternalLink size={10} />
        </a>
      ) : (
        <span className="text-xs font-medium text-gray-900">{value}</span>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        {children}
      </div>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-xs text-gray-600 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Request Documents Modal ──────────────────────────────────────────────────

function RequestDocsModal({
  existingDocs,
  onSubmit,
  onClose,
}: {
  existingDocs: RequestedDocument[];
  onSubmit: (docs: RequestedDocument[]) => void;
  onClose: () => void;
}) {
  const alreadyRequested = new Set(existingDocs.map(d => d.type));
  const [selected, setSelected] = useState<Set<string>>(new Set(alreadyRequested));
  const [customDoc, setCustomDoc] = useState('');

  const toggle = (type: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const addCustom = () => {
    const trimmed = customDoc.trim();
    if (trimmed && !selected.has(trimmed)) {
      setSelected(prev => new Set(prev).add(trimmed));
      setCustomDoc('');
    }
  };

  const handleSubmit = () => {
    const docs: RequestedDocument[] = Array.from(selected).map(type => {
      const existing = existingDocs.find(d => d.type === type);
      return existing ?? { type, status: 'pending' as const };
    });
    onSubmit(docs);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Request Documents</h3>
            <p className="text-xs text-gray-500 mt-0.5">Select the documents you need from the founder</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-1.5">
            {DOCUMENT_TYPES.map(type => {
              const isSelected = selected.has(type);
              const existing = existingDocs.find(d => d.type === type);
              const isUploaded = existing?.status === 'uploaded';
              return (
                <label
                  key={type}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border',
                    isSelected
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-white border-gray-100 hover:bg-gray-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(type)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <span className="text-xs font-medium text-gray-800 flex-1">{type}</span>
                  {isUploaded && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                      <Check size={10} /> Uploaded
                    </span>
                  )}
                </label>
              );
            })}

            {/* Custom doc types that aren't in the default list */}
            {Array.from(selected).filter(s => !(DOCUMENT_TYPES as readonly string[]).includes(s)).map(type => {
              const existing = existingDocs.find(d => d.type === type);
              const isUploaded = existing?.status === 'uploaded';
              return (
                <label
                  key={type}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border bg-indigo-50 border-indigo-200"
                >
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggle(type)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <span className="text-xs font-medium text-gray-800 flex-1">{type}</span>
                  {isUploaded && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                      <Check size={10} /> Uploaded
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Add custom */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customDoc}
              onChange={e => setCustomDoc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Add custom document type..."
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            <button
              onClick={addCustom}
              disabled={!customDoc.trim()}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-500">{selected.size} document{selected.size !== 1 ? 's' : ''} selected</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selected.size === 0}
              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              Request Documents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Action Confirm Modal ────────────────────────────────────────────────────

const ACTION_CONFIRM_CONFIG: Record<string, {
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}> = {
  approved: {
    title: 'Approve Application',
    description: 'This will approve the application and create a portfolio record for this company. The founder will be notified immediately.',
    confirmLabel: 'Approve Application',
    confirmColor: 'bg-green-600 hover:bg-green-700',
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
  },
  on_hold: {
    title: 'Put On Hold',
    description: 'This will place the application on hold. The founder will be notified that their application is being paused temporarily.',
    confirmLabel: 'Put On Hold',
    confirmColor: 'bg-slate-600 hover:bg-slate-700',
    icon: Pause,
    iconColor: 'text-slate-600',
    iconBg: 'bg-slate-100',
  },
  rejected: {
    title: 'Reject Application',
    description: 'This will reject the application. The founder will be notified that their application was not selected to move forward. This action cannot be easily undone.',
    confirmLabel: 'Reject Application',
    confirmColor: 'bg-red-600 hover:bg-red-700',
    icon: XCircle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
  },
  more_info_requested: {
    title: 'Request More Information',
    description: 'The founder will be notified to provide additional information about their application. You can also send a specific message using the "Send Message" button.',
    confirmLabel: 'Request Info',
    confirmColor: 'bg-amber-600 hover:bg-amber-700',
    icon: Info,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
  },
  meeting_scheduled: {
    title: 'Schedule Meeting',
    description: 'This will mark the application as "Meeting Scheduled" and notify the founder. Please coordinate the actual meeting details separately.',
    confirmLabel: 'Schedule Meeting',
    confirmColor: 'bg-violet-600 hover:bg-violet-700',
    icon: Calendar,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
  },
  shortlisted: {
    title: 'Shortlist Application',
    description: 'This will shortlist the application for further evaluation. The founder will be notified that their application has been selected for deeper review.',
    confirmLabel: 'Shortlist',
    confirmColor: 'bg-purple-600 hover:bg-purple-700',
    icon: Star,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
  },
};

function ActionConfirmModal({
  status,
  companyName,
  onConfirm,
  onClose,
}: {
  status: ApplicationStatus;
  companyName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const config = ACTION_CONFIRM_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-4', config.iconBg)}>
            <Icon size={22} className={config.iconColor} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">{config.title}</h3>
          <p className="text-xs text-gray-500 mb-1 font-medium">{companyName}</p>
          <p className="text-xs text-gray-500 leading-relaxed mt-3">{config.description}</p>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn('flex-1 text-xs font-semibold text-white px-4 py-2.5 rounded-xl transition-colors', config.confirmColor)}
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Approve Application Modal ───────────────────────────────────────────────

const PAYMENT_TYPES = ['Wire Transfer', 'SAFE', 'Convertible Note', 'Equity', 'SAFT', 'Check', 'Other'] as const;

function ApproveApplicationModal({
  app,
  onSubmit,
  onClose,
}: {
  app: InvestmentApplication;
  onSubmit: (data: { investmentAmount: string; paymentType: string; investmentDate: string; equityOffered: string; investmentNotes: string }) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(app.fundingAsk || '');
  const [paymentType, setPaymentType] = useState('');
  const [investDate, setInvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [equity, setEquity] = useState(app.equityOffered || '');
  const [investNotes, setInvestNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!amount.trim()) errs.amount = 'Investment amount is required';
    if (!paymentType) errs.paymentType = 'Payment type is required';
    if (!investDate) errs.investDate = 'Investment date is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    onSubmit({
      investmentAmount: amount.replace(/[,$\s]/g, ''),
      paymentType,
      investmentDate: investDate,
      equityOffered: equity,
      investmentNotes: investNotes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle2 size={22} className="text-green-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Approve & Invest</h3>
          <p className="text-xs text-gray-500 mb-1 font-medium">{app.companyName}</p>
          <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
            Complete the investment details below. This will approve the application, create a portfolio record, and move the applicant to the Founders page.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Investment Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                  <input
                    type="text"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setErrors(p => ({ ...p, amount: '' })); }}
                    placeholder="500,000"
                    className={cn(
                      'w-full text-xs border rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400',
                      errors.amount ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    )}
                  />
                </div>
                {errors.amount && <p className="text-[10px] text-red-500 mt-0.5">{errors.amount}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Equity Offered (%)
                </label>
                <input
                  type="text"
                  value={equity}
                  onChange={e => setEquity(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Payment Type <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_TYPES.map(pt => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => { setPaymentType(pt); setErrors(p => ({ ...p, paymentType: '' })); }}
                    className={cn(
                      'text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-all',
                      paymentType === pt
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {pt}
                  </button>
                ))}
              </div>
              {errors.paymentType && <p className="text-[10px] text-red-500 mt-0.5">{errors.paymentType}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Investment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={investDate}
                onChange={e => { setInvestDate(e.target.value); setErrors(p => ({ ...p, investDate: '' })); }}
                className={cn(
                  'w-full text-xs border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400',
                  errors.investDate ? 'border-red-300 bg-red-50' : 'border-gray-200'
                )}
              />
              {errors.investDate && <p className="text-[10px] text-red-500 mt-0.5">{errors.investDate}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Notes</label>
              <textarea
                value={investNotes}
                onChange={e => setInvestNotes(e.target.value)}
                placeholder="Any additional notes about this investment..."
                rows={2}
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 px-4 py-2.5 rounded-xl transition-colors"
          >
            Approve & Invest
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Meeting Modal ──────────────────────────────────────────────────

function ScheduleMeetingModal({
  companyName,
  onSubmit,
  onClose,
}: {
  companyName: string;
  onSubmit: (data: { meetingDate: string; meetingLocation: string; meetingLink: string; meetingAgenda: string }) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [agenda, setAgenda] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!date) errs.date = 'Date is required';
    if (!time) errs.time = 'Time is required';
    if (!agenda.trim()) errs.agenda = 'Agenda is required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const meetingDate = new Date(`${date}T${time}`).toISOString();
    onSubmit({ meetingDate, meetingLocation: location, meetingLink: link, meetingAgenda: agenda });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
            <Calendar size={22} className="text-violet-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Schedule Meeting</h3>
          <p className="text-xs text-gray-500 mb-4">{companyName}</p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: '' })); }}
                  className={cn(
                    'w-full text-xs border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400',
                    errors.date ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  )}
                />
                {errors.date && <p className="text-[10px] text-red-500 mt-0.5">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={e => { setTime(e.target.value); setErrors(p => ({ ...p, time: '' })); }}
                  className={cn(
                    'w-full text-xs border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400',
                    errors.time ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  )}
                />
                {errors.time && <p className="text-[10px] text-red-500 mt-0.5">{errors.time}</p>}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Office, Conference Room A"
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Meeting Link</label>
              <input
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="e.g. https://zoom.us/j/..."
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Agenda / Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={agenda}
                onChange={e => { setAgenda(e.target.value); setErrors(p => ({ ...p, agenda: '' })); }}
                placeholder="What will be discussed in the meeting?"
                rows={3}
                className={cn(
                  'w-full text-xs border rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400',
                  errors.agenda ? 'border-red-300 bg-red-50' : 'border-gray-200'
                )}
              />
              {errors.agenda && <p className="text-[10px] text-red-500 mt-0.5">{errors.agenda}</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2.5 rounded-xl transition-colors"
          >
            Schedule Meeting
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentUser, isInvestor, isFounder } = useAuth();

  const [app, setApp] = useState<InvestmentApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ApplicationStatus | null>(null);

  const loadApp = useCallback(async () => {
    if (!id) return;
    try {
      const result = await getApplicationById(id, isInvestor);
      if (result) {
        setApp(result);
        setNotes(result.investorNotes || '');
      } else {
        setError('Application not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    }
    setLoading(false);
  }, [id, isInvestor]);

  useEffect(() => { loadApp(); }, [loadApp]);

  if (isFounder) {
    return <Navigate to="/applications/track" replace />;
  }

  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    if (!app || !id) return;
    setActionLoading(newStatus);
    setActionError('');

    try {
      await updateApplicationStatus(id, newStatus, currentUser.name, isInvestor);

      const notifGen = NOTIFICATION_MESSAGES[newStatus];
      if (notifGen) {
        const { title, message } = notifGen(app.companyName, currentUser.name);
        addNotification({
          type: 'company_update',
          title,
          message,
          actor: currentUser.name,
          actorRole: 'investor',
          targetRole: 'founder',
          link: '/applications/track',
        });
      } else {
        const statusLabel = STATUS_CONFIG[newStatus]?.label ?? newStatus;
        addNotification({
          type: 'company_update',
          title: `Application ${statusLabel}`,
          message: `${app.companyName} has been marked as "${statusLabel}" by ${currentUser.name}.`,
          actor: currentUser.name,
          actorRole: 'investor',
          targetRole: 'founder',
          link: '/applications/track',
        });
      }

      window.dispatchEvent(new Event('notifications-updated'));
      await loadApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      console.error('Failed to update status:', err);
      setActionError(msg);
    }
    setActionLoading(null);
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    await updateApplication(id, { investorNotes: notes }, isInvestor);
    setTimeout(() => setSavingNotes(false), 400);
  };

  const handleSendMessage = async () => {
    if (!app || !id || !messageText.trim()) return;
    setSendingMessage(true);
    const existing = app.investorNotes || '';
    const timestamp = new Date().toLocaleString();
    const newNotes = existing
      ? `${existing}\n\n[${timestamp}] ${currentUser.name}: ${messageText}`
      : `[${timestamp}] ${currentUser.name}: ${messageText}`;
    await updateApplication(id, {
      investorNotes: newNotes,
      reviewedBy: currentUser.name,
      reviewedAt: new Date().toISOString(),
    }, isInvestor);

    addNotification({
      type: 'company_update',
      title: 'Message from Investor',
      message: `${currentUser.name} sent a message regarding ${app.companyName}: "${messageText.slice(0, 80)}${messageText.length > 80 ? '...' : ''}"`,
      actor: currentUser.name,
      actorRole: 'investor',
      targetRole: 'founder',
      link: '/applications/track',
    });

    window.dispatchEvent(new Event('notifications-updated'));
    setMessageText('');
    setShowMessage(false);
    setSendingMessage(false);
    await loadApp();
  };

  const handleRequestDocs = async (docs: RequestedDocument[]) => {
    if (!app || !id) return;
    setShowDocsModal(false);
    setActionLoading('documents_requested');
    setActionError('');
    try {
      await updateApplication(id, {
        requestedDocuments: stringifyRequestedDocuments(docs),
        status: 'documents_requested' as ApplicationStatus,
        reviewedBy: currentUser.name,
        reviewedAt: new Date().toISOString(),
      }, isInvestor);

      const docNames = docs.map(d => d.type).join(', ');
      addNotification({
        type: 'company_update',
        title: 'Documents Requested',
        message: `${currentUser.name} has requested the following documents for ${app.companyName}: ${docNames}`,
        actor: currentUser.name,
        actorRole: 'investor',
        targetRole: 'founder',
        link: '/applications/track',
      });
      window.dispatchEvent(new Event('notifications-updated'));
      await loadApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to request documents';
      setActionError(msg);
    }
    setActionLoading(null);
  };

  const handleApprove = async (details: ApprovalDetails) => {
    if (!app || !id) return;
    setShowApproveModal(false);
    setActionLoading('approved');
    setActionError('');
    try {
      await approveApplication(id, currentUser.name, isInvestor, details);

      const { title, message } = NOTIFICATION_MESSAGES.approved(app.companyName, currentUser.name);
      addNotification({
        type: 'company_update',
        title,
        message: `${message} Investment: $${Number(details.investmentAmount).toLocaleString()} via ${details.paymentType}.`,
        actor: currentUser.name,
        actorRole: 'investor',
        targetRole: 'founder',
        link: '/applications/track',
      });
      window.dispatchEvent(new Event('notifications-updated'));
      await loadApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to approve application';
      setActionError(msg);
    }
    setActionLoading(null);
  };

  const handleScheduleMeeting = async (data: { meetingDate: string; meetingLocation: string; meetingLink: string; meetingAgenda: string }) => {
    if (!app || !id) return;
    setShowMeetingModal(false);
    setActionLoading('meeting_scheduled');
    setActionError('');
    try {
      await updateApplication(id, {
        ...data,
        status: 'meeting_scheduled' as ApplicationStatus,
        reviewedBy: currentUser.name,
        reviewedAt: new Date().toISOString(),
      }, isInvestor);

      const meetingTime = new Date(data.meetingDate).toLocaleString('en-US', {
        dateStyle: 'medium', timeStyle: 'short',
      });
      const details = [meetingTime];
      if (data.meetingLocation) details.push(data.meetingLocation);
      if (data.meetingLink) details.push(data.meetingLink);

      addNotification({
        type: 'company_update',
        title: 'Meeting Scheduled',
        message: `${currentUser.name} has scheduled a meeting for ${app.companyName}: ${details.join(' · ')}. Agenda: ${data.meetingAgenda}`,
        actor: currentUser.name,
        actorRole: 'investor',
        targetRole: 'founder',
        link: '/applications/track',
      });
      window.dispatchEvent(new Event('notifications-updated'));
      await loadApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule meeting';
      setActionError(msg);
    }
    setActionLoading(null);
  };

  if (loading) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full animate-pulse space-y-4">
      <div className="h-4 bg-gray-100 rounded w-32" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );

  if (error || !app) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
      <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 mb-6">
        <ArrowLeft size={15} /> Applications
      </Link>
      <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
        <Inbox size={28} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">{error || 'Application not found'}</p>
      </div>
    </div>
  );

  const actions: { label: string; status: ApplicationStatus; icon: React.ElementType; color: string; hoverBg: string; activeBg: string; borderColor: string }[] = [
    { label: 'Approve',          status: 'approved',            icon: CheckCircle2,  color: 'text-green-600',   hoverBg: 'hover:bg-green-50',  activeBg: 'bg-green-50',  borderColor: 'border-green-300' },
    { label: 'Hold',             status: 'on_hold',             icon: Pause,         color: 'text-slate-600',   hoverBg: 'hover:bg-slate-50',  activeBg: 'bg-slate-100', borderColor: 'border-slate-300' },
    { label: 'Reject',           status: 'rejected',            icon: XCircle,       color: 'text-red-600',     hoverBg: 'hover:bg-red-50',    activeBg: 'bg-red-50',    borderColor: 'border-red-300' },
    { label: 'Request Info',     status: 'more_info_requested', icon: MessageSquare, color: 'text-amber-600',   hoverBg: 'hover:bg-amber-50',  activeBg: 'bg-amber-50',  borderColor: 'border-amber-300' },
    { label: 'Request Docs',     status: 'documents_requested', icon: FileUp,        color: 'text-yellow-600',  hoverBg: 'hover:bg-yellow-50', activeBg: 'bg-yellow-50', borderColor: 'border-yellow-300' },
    { label: 'Schedule Meeting', status: 'meeting_scheduled',   icon: Calendar,      color: 'text-violet-600',  hoverBg: 'hover:bg-violet-50', activeBg: 'bg-violet-50', borderColor: 'border-violet-300' },
    { label: 'Shortlist',        status: 'shortlisted',         icon: Star,          color: 'text-purple-600',  hoverBg: 'hover:bg-purple-50', activeBg: 'bg-purple-50', borderColor: 'border-purple-300' },
  ];

  let supportingDocs: { name: string; url: string }[] = [];
  try {
    if (app.supportingDocs) supportingDocs = JSON.parse(app.supportingDocs);
  } catch { /* ignore */ }

  const financials = [
    { label: 'Current Revenue', value: app.currentRevenue },
    { label: 'MRR',             value: app.mrr },
    { label: 'ARR',             value: app.arr },
    { label: 'Monthly Burn',    value: app.monthlyBurn },
    { label: 'Runway',          value: app.runway },
    { label: 'Active Users',    value: app.activeUsers },
    { label: 'MoM Growth',      value: app.momGrowth },
    { label: 'Churn Rate',      value: app.churnRate },
    { label: 'NPS',             value: app.nps },
  ].filter(f => f.value);

  const requestedDocs = parseRequestedDocuments(app.requestedDocuments);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
      {showDocsModal && (
        <RequestDocsModal
          existingDocs={requestedDocs}
          onSubmit={handleRequestDocs}
          onClose={() => setShowDocsModal(false)}
        />
      )}

      {showApproveModal && (
        <ApproveApplicationModal
          app={app}
          onSubmit={handleApprove}
          onClose={() => setShowApproveModal(false)}
        />
      )}

      {showMeetingModal && (
        <ScheduleMeetingModal
          companyName={app.companyName || 'this application'}
          onSubmit={handleScheduleMeeting}
          onClose={() => setShowMeetingModal(false)}
        />
      )}

      {confirmAction && (
        <ActionConfirmModal
          status={confirmAction}
          companyName={app.companyName || 'this application'}
          onConfirm={() => {
            const action = confirmAction;
            setConfirmAction(null);
            handleStatusChange(action);
          }}
          onClose={() => setConfirmAction(null)}
        />
      )}

      <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-6">
        <ArrowLeft size={15} /> Back to Applications
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
            <Building2 size={24} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{app.companyName || 'Untitled Application'}</h1>
              <StatusBadge status={app.status} />
              {app.companyStage && <StageBadge stage={app.companyStage} />}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
              {app.companyIndustry && <span>{app.companyIndustry}</span>}
              {app.companyLocation && <><span className="text-gray-300">|</span><span>{app.companyLocation}</span></>}
              {app.founderName && <><span className="text-gray-300">|</span><span>{app.founderName}</span></>}
              {app.submittedAt && <><span className="text-gray-300">|</span><span>Submitted {relativeTime(app.submittedAt)}</span></>}
            </div>
          </div>
          {app.fundingAsk && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-500">Funding Ask</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(parseFloat(app.fundingAsk))}</p>
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">

          {/* Actions */}
          <Section title="Actions">
            {actionError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
                {actionError}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {actions.map(a => {
                const Icon = a.icon;
                const isActive = app.status === a.status;
                const isLoading = actionLoading === a.status;
                const isApproved = app.status === 'approved' || app.status === 'invested';
                const isRejected = app.status === 'rejected';
                const isTerminal = isApproved || isRejected;
                const isDisabled = !!actionLoading || (isTerminal && a.status !== 'approved' && a.status !== 'rejected');
                const isApproveDisabled = a.status === 'approved' && isApproved;
                const isRejectDisabled = a.status === 'rejected' && isRejected;

                const onClick = a.status === 'documents_requested'
                  ? () => setShowDocsModal(true)
                  : a.status === 'meeting_scheduled'
                  ? () => setShowMeetingModal(true)
                  : a.status === 'approved'
                  ? () => setShowApproveModal(true)
                  : () => setConfirmAction(a.status);
                return (
                  <button
                    key={a.status}
                    onClick={onClick}
                    disabled={isDisabled || isApproveDisabled || isRejectDisabled}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                      isActive
                        ? `${a.color} ${a.activeBg} ${a.borderColor}`
                        : `text-gray-600 border-gray-200 ${a.hoverBg} hover:border-gray-300`,
                      isLoading && 'opacity-50 cursor-wait',
                      (isApproveDisabled || isRejectDisabled) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Icon size={13} /> {isLoading ? 'Updating...' : isApproveDisabled ? 'Approved ✓' : isRejectDisabled ? 'Rejected' : a.label}
                  </button>
                );
              })}
              <button
                onClick={() => setShowMessage(!showMessage)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                  showMessage
                    ? 'text-blue-600 border-blue-300 bg-blue-50'
                    : 'text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-gray-300'
                )}
              >
                <Send size={12} /> Send Message
              </button>
            </div>
            {showMessage && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mt-2">
                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Type a message to the founder..."
                  className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !messageText.trim()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send size={11} /> {sendingMessage ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Business Overview */}
          {(app.problemStatement || app.solution || app.targetMarket || app.businessModel || app.competitiveAdvantage || app.companyDescription) && (
            <Section title="Business Overview">
              <div className="space-y-4">
                <TextBlock label="About the Company" text={app.companyDescription} />
                <TextBlock label="Problem" text={app.problemStatement} />
                <TextBlock label="Solution" text={app.solution} />
                <TextBlock label="Target Market" text={app.targetMarket} />
                <TextBlock label="Business Model" text={app.businessModel} />
                <TextBlock label="Competitive Advantage" text={app.competitiveAdvantage} />
              </div>
            </Section>
          )}

          {/* Funding Details */}
          {(app.fundingAsk || app.useOfFunds || app.previousFunding || app.currentValuation || app.equityOffered) && (
            <Section title="Funding">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {app.fundingAsk && (
                  <div>
                    <p className="text-xs text-gray-500">Funding Ask</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(parseFloat(app.fundingAsk))}</p>
                  </div>
                )}
                {app.currentValuation && (
                  <div>
                    <p className="text-xs text-gray-500">Valuation</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(parseFloat(app.currentValuation))}</p>
                  </div>
                )}
                {app.equityOffered && (
                  <div>
                    <p className="text-xs text-gray-500">Equity Offered</p>
                    <p className="text-sm font-semibold text-gray-900">{app.equityOffered}%</p>
                  </div>
                )}
                {app.previousFunding && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-gray-500">Previous Funding</p>
                    <p className="text-xs text-gray-700 leading-relaxed mt-1">{app.previousFunding}</p>
                  </div>
                )}
                {app.useOfFunds && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-gray-500">Use of Funds</p>
                    <p className="text-xs text-gray-700 leading-relaxed mt-1">{app.useOfFunds}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Financial Metrics */}
          {financials.length > 0 && (
            <Section title="Financial Metrics">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {financials.map(f => (
                  <div key={f.label}>
                    <p className="text-xs text-gray-500">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-900">{f.value}</p>
                  </div>
                ))}
                {app.keyMetric && (
                  <div>
                    <p className="text-xs text-gray-500">{app.keyMetricLabel || 'Key Metric'}</p>
                    <p className="text-sm font-semibold text-gray-900">{app.keyMetric}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Pitch Deck */}
          {app.pitchDeckUrl && (
            <Section title="Pitch Deck">
              {app.pitchDeckUrl.startsWith('data:') ? (
                <iframe src={app.pitchDeckUrl} className="w-full rounded-xl" style={{ height: '500px' }} title="Pitch Deck" />
              ) : (
                <a href={app.pitchDeckUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  <FileText size={14} /> {app.pitchDeckName || 'View Pitch Deck'} <ExternalLink size={10} />
                </a>
              )}
            </Section>
          )}

          {/* Demo Video */}
          {app.demoVideoUrl && (
            <Section title="Demo Video">
              <VideoEmbed url={app.demoVideoUrl} />
            </Section>
          )}

          {/* Supporting Documents */}
          {supportingDocs.length > 0 && (
            <Section title="Supporting Documents">
              <div className="space-y-2">
                {supportingDocs.map((doc, i) => (
                  <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-indigo-600 transition-colors py-1">
                    <FileText size={12} className="text-gray-400 flex-shrink-0" />
                    {doc.name}
                    <ExternalLink size={10} className="text-gray-300 ml-auto flex-shrink-0" />
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-6">

          {/* Meeting Details */}
          {app.meetingDate && (
            <Section title="Meeting Details">
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Calendar size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {new Date(app.meetingDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-violet-600 font-medium">
                      {new Date(app.meetingDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {app.meetingLocation && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="font-semibold text-gray-500 w-16">Location</span>
                    <span>{app.meetingLocation}</span>
                  </div>
                )}
                {app.meetingLink && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="font-semibold text-gray-500 w-16">Link</span>
                    <a href={app.meetingLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">{app.meetingLink}</a>
                  </div>
                )}
                {app.meetingAgenda && (
                  <div className="text-xs text-gray-700 pt-1 border-t border-violet-100">
                    <span className="font-semibold text-gray-500 block mb-1">Agenda</span>
                    <p className="leading-relaxed whitespace-pre-wrap">{app.meetingAgenda}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Requested Documents */}
          {requestedDocs.length > 0 && (
            <Section title="Requested Documents">
              <div className="space-y-2">
                {requestedDocs.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileUp size={12} className={doc.status === 'submitted' ? 'text-green-500' : doc.status === 'uploaded' ? 'text-blue-500' : 'text-gray-400'} />
                      <div className="min-w-0">
                        <span className="text-[11px] font-medium text-gray-800">{doc.type}</span>
                        {doc.fileName && (doc.status === 'submitted' || doc.status === 'uploaded') && (
                          <p className="text-[10px] text-gray-400 truncate max-w-[100px]">{doc.fileName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {doc.status === 'submitted' ? (
                        <>
                          {doc.attachmentId && (
                            <a href={`/api/attachments?id=${id}&attachmentId=${doc.attachmentId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded-md transition-colors">
                              <Download size={9} /> View
                            </a>
                          )}
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                            <Check size={9} /> Submitted
                          </span>
                        </>
                      ) : doc.status === 'uploaded' ? (
                        <>
                          {doc.attachmentId && (
                            <a href={`/api/attachments?id=${id}&attachmentId=${doc.attachmentId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded-md transition-colors">
                              <Download size={9} /> View
                            </a>
                          )}
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                            <Check size={9} /> Uploaded
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                          <Clock size={9} /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Company Details */}
          <Section title="Company Info">
            <div>
              <InfoRow label="Website" value={app.companyWebsite ? app.companyWebsite.replace(/^https?:\/\//, '') : undefined} href={app.companyWebsite ? (app.companyWebsite.startsWith('http') ? app.companyWebsite : `https://${app.companyWebsite}`) : undefined} />
              <InfoRow label="Industry" value={app.companyIndustry} />
              <InfoRow label="Stage" value={app.companyStage} />
              <InfoRow label="Location" value={app.companyLocation} />
              <InfoRow label="Founded" value={app.foundedYear} />
            </div>
          </Section>

          {/* Founder Details */}
          <Section title="Founder Details">
            <div>
              <InfoRow label="Name" value={app.founderName} />
              <InfoRow label="Email" value={app.founderEmail} href={app.founderEmail ? `mailto:${app.founderEmail}` : undefined} />
              <InfoRow label="Phone" value={app.founderPhone} href={app.founderPhone ? `tel:${app.founderPhone}` : undefined} />
              <InfoRow label="Role" value={app.founderRole} />
              <InfoRow label="LinkedIn" value={app.founderLinkedin ? 'View Profile' : undefined} href={app.founderLinkedin || undefined} />
              {app.coFounders && <InfoRow label="Co-Founders" value={app.coFounders} />}
            </div>
          </Section>

          {/* Investor Notes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <StickyNote size={12} /> Investor Notes
            </p>
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Write private notes about this application..."
                className="w-full text-xs text-gray-700 leading-relaxed border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-y"
                rows={5}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="text-xs font-semibold text-white bg-black hover:bg-gray-800 px-3.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, ExternalLink, FileText, Play, StickyNote,
  CheckCircle2, Pause, XCircle, MessageSquare, FileUp, Calendar,
  Star, Send, Inbox, X, Check, Clock, Info, Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKeys } from '../i18n';
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
import { zohoDownloadAttachment, portalDownloadAttachment } from '../services/zohoApi';
import { loadRole } from '../services/oauth';
import { cn } from '../lib/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === 0) return '—';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function relativeTime(iso: string, t: TranslationKeys, language: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return t.activities.justNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t.activities.minutesAgo.replace('{n}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.activities.hoursAgo.replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  if (days === 1) return t.activities.yesterday;
  if (days < 7) return t.activities.daysAgo.replace('{n}', String(days));
  return new Date(iso).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' });
}

// ─── Status config ────────────────────────────────────────────────────────────

function getStatusConfig(t: TranslationKeys): Record<ApplicationStatus, { label: string; color: string; bg: string }> {
  return {
    draft:                { label: t.applicationTracker.statusDraft,         color: 'text-gray-600',    bg: 'bg-gray-100' },
    submitted:            { label: t.applicationTracker.statusSubmitted,     color: 'text-blue-600',    bg: 'bg-blue-50' },
    under_review:         { label: t.applicationTracker.statusUnderReview,   color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    interested:           { label: t.applicationTracker.statusInterested,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
    more_info_requested:  { label: t.applicationTracker.statusMoreInfo,      color: 'text-amber-600',   bg: 'bg-amber-50' },
    documents_requested:  { label: t.applicationTracker.statusDocsRequested, color: 'text-yellow-600',  bg: 'bg-yellow-50' },
    shortlisted:          { label: t.applicationTracker.statusShortlisted,   color: 'text-purple-600',  bg: 'bg-purple-50' },
    meeting_scheduled:    { label: t.applicationTracker.statusMeeting,       color: 'text-violet-600',  bg: 'bg-violet-50' },
    due_diligence:        { label: t.applicationTracker.statusDueDiligence,  color: 'text-orange-600',  bg: 'bg-orange-50' },
    on_hold:              { label: t.applicationTracker.statusOnHold,       color: 'text-slate-600',   bg: 'bg-slate-100' },
    approved:             { label: t.applicationTracker.statusApproved,     color: 'text-green-600',   bg: 'bg-green-50' },
    invested:             { label: t.applicationTracker.statusInvested,     color: 'text-green-700',   bg: 'bg-green-100' },
    rejected:             { label: t.applicationTracker.statusRejected,     color: 'text-red-600',     bg: 'bg-red-50' },
  };
}

function getNotificationMessages(t: TranslationKeys): Record<string, (companyName: string, investorName: string) => { title: string; message: string }> {
  return {
    approved:            (c, i) => ({ title: t.notificationMessages.approvedTitle, message: t.notificationMessages.approvedMessage.replace('{c}', c).replace('{i}', i) }),
    rejected:            (c, i) => ({ title: t.notificationMessages.rejectedTitle, message: t.notificationMessages.rejectedMessage.replace('{c}', c) }),
    on_hold:             (c, i) => ({ title: t.notificationMessages.onHoldTitle, message: t.notificationMessages.onHoldMessage.replace('{c}', c) }),
    more_info_requested: (c, i) => ({ title: t.notificationMessages.moreInfoTitle, message: t.notificationMessages.moreInfoMessage.replace('{i}', i).replace('{c}', c) }),
    documents_requested: (c, i) => ({ title: t.notificationMessages.docsRequestedTitle, message: t.notificationMessages.docsRequestedMessage.replace('{i}', i).replace('{c}', c) }),
    meeting_scheduled:   (c, i) => ({ title: t.notificationMessages.meetingScheduledTitle, message: t.notificationMessages.meetingScheduledMessage.replace('{i}', i).replace('{c}', c) }),
    shortlisted:         (c, i) => ({ title: t.notificationMessages.shortlistedTitle, message: t.notificationMessages.shortlistedMessage.replace('{c}', c).replace('{i}', i) }),
    under_review:        (c, i) => ({ title: t.notificationMessages.underReviewTitle, message: t.notificationMessages.underReviewMessage.replace('{c}', c) }),
    interested:          (c, i) => ({ title: t.notificationMessages.interestedTitle, message: t.notificationMessages.interestedMessage.replace('{i}', i).replace('{c}', c) }),
    due_diligence:       (c, i) => ({ title: t.notificationMessages.dueDiligenceTitle, message: t.notificationMessages.dueDiligenceMessage.replace('{c}', c) }),
  };
}

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
  const { t } = useLanguage();
  const statusConfig = getStatusConfig(t);
  const cfg = statusConfig[status] ?? statusConfig.submitted;
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full', cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const { t } = useLanguage();
  const cfg = STAGE_COLORS[stage] ?? { color: 'text-gray-600', bg: 'bg-gray-100' };
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      {stage || t.common.notSet}
    </span>
  );
}

// ─── Video embed ──────────────────────────────────────────────────────────────

function VideoEmbed({ url }: { url: string }) {
  const { t } = useLanguage();
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
      <Play size={12} /> {t.applicationDetail.watchDemoVideo} <ExternalLink size={10} />
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
  const { t } = useLanguage();
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
            <h3 className="text-sm font-bold text-gray-900">{t.applicationDetail.requestDocumentsTitle}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t.applicationDetail.requestDocumentsDesc}</p>
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
                      <Check size={10} /> {t.applicationDetail.uploadedTag}
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
                      <Check size={10} /> {t.applicationDetail.uploadedTag}
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
              placeholder={t.applicationDetail.addCustomDocPlaceholder}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            <button
              onClick={addCustom}
              disabled={!customDoc.trim()}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 disabled:opacity-40"
            >
              {t.applicationDetail.add}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-500">{t.applicationDetail.documentsSelected.replace('{count}', String(selected.size)).replace('{s}', selected.size !== 1 ? 's' : '')}</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {t.applicationDetail.cancel}
            </button>
            <button
              onClick={handleSubmit}
              disabled={selected.size === 0}
              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {t.applicationDetail.requestDocumentsButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Action Confirm Modal ────────────────────────────────────────────────────

function getActionConfirmConfig(t: TranslationKeys): Record<string, {
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}> {
  return {
    approved: {
      title: t.applicationDetail.approveTitle,
      description: t.applicationDetail.approveDesc,
      confirmLabel: t.applicationDetail.approveConfirm,
      confirmColor: 'bg-green-600 hover:bg-green-700',
      icon: CheckCircle2,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-50',
    },
    on_hold: {
      title: t.applicationDetail.holdTitle,
      description: t.applicationDetail.holdDesc,
      confirmLabel: t.applicationDetail.holdConfirm,
      confirmColor: 'bg-slate-600 hover:bg-slate-700',
      icon: Pause,
      iconColor: 'text-slate-600',
      iconBg: 'bg-slate-100',
    },
    rejected: {
      title: t.applicationDetail.rejectTitle,
      description: t.applicationDetail.rejectDesc,
      confirmLabel: t.applicationDetail.rejectConfirm,
      confirmColor: 'bg-red-600 hover:bg-red-700',
      icon: XCircle,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
    },
    more_info_requested: {
      title: t.applicationDetail.requestInfoTitle,
      description: t.applicationDetail.requestInfoDesc,
      confirmLabel: t.applicationDetail.requestInfoConfirm,
      confirmColor: 'bg-amber-600 hover:bg-amber-700',
      icon: Info,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
    },
    meeting_scheduled: {
      title: t.applicationDetail.scheduleMeetingTitle,
      description: t.applicationDetail.scheduleMeetingDesc,
      confirmLabel: t.applicationDetail.scheduleMeetingConfirm,
      confirmColor: 'bg-violet-600 hover:bg-violet-700',
      icon: Calendar,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
    },
    shortlisted: {
      title: t.applicationDetail.shortlistTitle,
      description: t.applicationDetail.shortlistDesc,
      confirmLabel: t.applicationDetail.shortlistConfirm,
      confirmColor: 'bg-purple-600 hover:bg-purple-700',
      icon: Star,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
    },
  };
}

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
  const { t } = useLanguage();
  const config = getActionConfirmConfig(t)[status];
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
            {t.applicationDetail.cancel}
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
  const { t } = useLanguage();
  const [amount, setAmount] = useState(app.fundingAsk || '');
  const [paymentType, setPaymentType] = useState('');
  const [investDate, setInvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [equity, setEquity] = useState(app.equityOffered || '');
  const [investNotes, setInvestNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!amount.trim()) errs.amount = t.applicationDetail.amountRequired;
    if (!paymentType) errs.paymentType = t.applicationDetail.paymentTypeRequired;
    if (!investDate) errs.investDate = t.applicationDetail.investmentDateRequired;
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
          <h3 className="text-base font-bold text-gray-900 mb-1">{t.applicationDetail.approveInvestTitle}</h3>
          <p className="text-xs text-gray-500 mb-1 font-medium">{app.companyName}</p>
          <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
            {t.applicationDetail.approveInvestDesc}
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  {t.applicationDetail.investmentAmount} <span className="text-red-500">*</span>
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
                  {t.applicationDetail.equityOfferedPct}
                </label>
                <input
                  type="text"
                  value={equity}
                  onChange={e => setEquity(e.target.value)}
                  placeholder={t.applicationDetail.equityOfferedPlaceholder}
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                {t.applicationDetail.paymentType} <span className="text-red-500">*</span>
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
                {t.applicationDetail.investmentDate} <span className="text-red-500">*</span>
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
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">{t.applicationDetail.notes}</label>
              <textarea
                value={investNotes}
                onChange={e => setInvestNotes(e.target.value)}
                placeholder={t.applicationDetail.investmentNotesPlaceholder}
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
            {t.applicationDetail.cancel}
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 px-4 py-2.5 rounded-xl transition-colors"
          >
            {t.applicationDetail.approveInvestButton}
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
  const { t } = useLanguage();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [agenda, setAgenda] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!date) errs.date = t.applicationDetail.dateRequired;
    if (!time) errs.time = t.applicationDetail.timeRequired;
    if (!agenda.trim()) errs.agenda = t.applicationDetail.agendaRequired;
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
          <h3 className="text-base font-bold text-gray-900 mb-1">{t.applicationDetail.scheduleMeetingModalTitle}</h3>
          <p className="text-xs text-gray-500 mb-4">{companyName}</p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  {t.applicationDetail.date} <span className="text-red-500">*</span>
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
                  {t.applicationDetail.time} <span className="text-red-500">*</span>
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
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">{t.applicationDetail.location}</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder={t.applicationDetail.locationPlaceholder}
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">{t.applicationDetail.meetingLink}</label>
              <input
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder={t.applicationDetail.meetingLinkPlaceholder}
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                {t.applicationDetail.agendaNotes} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={agenda}
                onChange={e => { setAgenda(e.target.value); setErrors(p => ({ ...p, agenda: '' })); }}
                placeholder={t.applicationDetail.agendaPlaceholder}
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
            {t.applicationDetail.cancel}
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2.5 rounded-xl transition-colors"
          >
            {t.applicationDetail.scheduleMeetingButton}
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
  const { t, language } = useLanguage();

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
        setError(t.applicationDetail.applicationNotFound);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.applicationDetail.failedToLoad);
    }
    setLoading(false);
  }, [id, isInvestor, t]);

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

      const notifGen = getNotificationMessages(t)[newStatus];
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
        const statusLabel = getStatusConfig(t)[newStatus]?.label ?? newStatus;
        addNotification({
          type: 'company_update',
          title: t.notificationMessages.genericStatusTitle.replace('{status}', statusLabel),
          message: t.notificationMessages.genericStatusMessage.replace('{c}', app.companyName).replace('{status}', statusLabel).replace('{i}', currentUser.name),
          actor: currentUser.name,
          actorRole: 'investor',
          targetRole: 'founder',
          link: '/applications/track',
        });
      }

      window.dispatchEvent(new Event('notifications-updated'));
      await loadApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.applicationDetail.failedToUpdateStatus;
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
      title: t.notificationMessages.messageFromInvestorTitle,
      message: t.notificationMessages.messageFromInvestorMessage
        .replace('{i}', currentUser.name)
        .replace('{c}', app.companyName)
        .replace('{msg}', `${messageText.slice(0, 80)}${messageText.length > 80 ? '...' : ''}`),
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
        title: t.notificationMessages.documentsRequestedNotifTitle,
        message: t.notificationMessages.documentsRequestedNotifMessage.replace('{i}', currentUser.name).replace('{c}', app.companyName).replace('{docs}', docNames),
        actor: currentUser.name,
        actorRole: 'investor',
        targetRole: 'founder',
        link: '/applications/track',
        requestedDocs: docs.map(d => d.type),
      });
      window.dispatchEvent(new Event('notifications-updated'));
      await loadApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.applicationDetail.failedToRequestDocuments;
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

      const { title, message } = getNotificationMessages(t).approved(app.companyName, currentUser.name);
      const investmentSuffix = t.notificationMessages.approvedInvestmentSuffix
        .replace('{amount}', `$${Number(details.investmentAmount).toLocaleString()}`)
        .replace('{paymentType}', details.paymentType);
      addNotification({
        type: 'company_update',
        title,
        message: `${message}${investmentSuffix}`,
        actor: currentUser.name,
        actorRole: 'investor',
        targetRole: 'founder',
        link: '/applications/track',
      });
      window.dispatchEvent(new Event('notifications-updated'));
      await loadApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.applicationDetail.failedToApprove;
      setActionError(msg);
    }
    setActionLoading(null);
  };

  const handleDownloadAttachment = async (recordId: string, attachmentId: string, fileName: string) => {
    try {
      const isFounderRole = loadRole() === 'founder';
      const blob = isFounderRole
        ? await portalDownloadAttachment('Applications', recordId, attachmentId)
        : await zohoDownloadAttachment('Applications', recordId, attachmentId);
      if (!blob) { alert('Could not download file.'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    }
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

      const meetingTime = new Date(data.meetingDate).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', {
        dateStyle: 'medium', timeStyle: 'short',
      });
      const details = [meetingTime];
      if (data.meetingLocation) details.push(data.meetingLocation);
      if (data.meetingLink) details.push(data.meetingLink);

      addNotification({
        type: 'company_update',
        title: t.applicationDetail.scheduleMeetingTitle,
        message: t.notificationMessages.meetingScheduledNotifMessage
          .replace('{i}', currentUser.name)
          .replace('{c}', app.companyName)
          .replace('{details}', details.join(' · '))
          .replace('{agenda}', data.meetingAgenda),
        actor: currentUser.name,
        actorRole: 'investor',
        targetRole: 'founder',
        link: '/applications/track',
      });
      window.dispatchEvent(new Event('notifications-updated'));
      await loadApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.applicationDetail.failedToScheduleMeeting;
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
        <ArrowLeft size={15} /> {t.applications.title}
      </Link>
      <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
        <Inbox size={28} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">{error || t.applicationDetail.applicationNotFound}</p>
      </div>
    </div>
  );

  const actions: { label: string; status: ApplicationStatus; icon: React.ElementType; color: string; hoverBg: string; activeBg: string; borderColor: string }[] = [
    { label: t.applicationDetail.approve,         status: 'approved',            icon: CheckCircle2,  color: 'text-green-600',   hoverBg: 'hover:bg-green-50',  activeBg: 'bg-green-50',  borderColor: 'border-green-300' },
    { label: t.applicationDetail.hold,            status: 'on_hold',             icon: Pause,         color: 'text-slate-600',   hoverBg: 'hover:bg-slate-50',  activeBg: 'bg-slate-100', borderColor: 'border-slate-300' },
    { label: t.applicationDetail.reject,          status: 'rejected',            icon: XCircle,       color: 'text-red-600',     hoverBg: 'hover:bg-red-50',    activeBg: 'bg-red-50',    borderColor: 'border-red-300' },
    { label: t.applicationDetail.requestInfo,     status: 'more_info_requested', icon: MessageSquare, color: 'text-amber-600',   hoverBg: 'hover:bg-amber-50',  activeBg: 'bg-amber-50',  borderColor: 'border-amber-300' },
    { label: t.applicationDetail.requestDocs,     status: 'documents_requested', icon: FileUp,        color: 'text-yellow-600',  hoverBg: 'hover:bg-yellow-50', activeBg: 'bg-yellow-50', borderColor: 'border-yellow-300' },
    { label: t.applicationDetail.scheduleMeeting, status: 'meeting_scheduled',   icon: Calendar,      color: 'text-violet-600',  hoverBg: 'hover:bg-violet-50', activeBg: 'bg-violet-50', borderColor: 'border-violet-300' },
    { label: t.applicationDetail.shortlist,       status: 'shortlisted',         icon: Star,          color: 'text-purple-600',  hoverBg: 'hover:bg-purple-50', activeBg: 'bg-purple-50', borderColor: 'border-purple-300' },
  ];

  let supportingDocs: { name: string; url: string }[] = [];
  try {
    if (app.supportingDocs) supportingDocs = JSON.parse(app.supportingDocs);
  } catch { /* ignore */ }

  const financials = [
    { label: t.applicationDetail.currentRevenue, value: app.currentRevenue },
    { label: t.applicationDetail.mrr,            value: app.mrr },
    { label: t.applicationDetail.arr,            value: app.arr },
    { label: t.applicationDetail.monthlyBurn,    value: app.monthlyBurn },
    { label: t.applicationDetail.runway,         value: app.runway },
    { label: t.applicationDetail.activeUsers,    value: app.activeUsers },
    { label: t.applicationDetail.momGrowth,      value: app.momGrowth },
    { label: t.applicationDetail.churnRate,      value: app.churnRate },
    { label: t.applicationDetail.nps,            value: app.nps },
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
          companyName={app.companyName || t.applicationDetail.untitledApplication}
          onSubmit={handleScheduleMeeting}
          onClose={() => setShowMeetingModal(false)}
        />
      )}

      {confirmAction && (
        <ActionConfirmModal
          status={confirmAction}
          companyName={app.companyName || t.applicationDetail.untitledApplication}
          onConfirm={() => {
            const action = confirmAction;
            setConfirmAction(null);
            handleStatusChange(action);
          }}
          onClose={() => setConfirmAction(null)}
        />
      )}

      <Link to="/applications" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-6">
        <ArrowLeft size={15} /> {t.applicationDetail.backToApplications}
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
            <Building2 size={24} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{app.companyName || t.applicationDetail.untitledApplication}</h1>
              <StatusBadge status={app.status} />
              {app.companyStage && <StageBadge stage={app.companyStage} />}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
              {app.companyIndustry && <span>{app.companyIndustry}</span>}
              {app.companyLocation && <><span className="text-gray-300">|</span><span>{app.companyLocation}</span></>}
              {app.founderName && <><span className="text-gray-300">|</span><span>{app.founderName}</span></>}
              {app.submittedAt && <><span className="text-gray-300">|</span><span>{t.applicationDetail.submittedAgo.replace('{time}', relativeTime(app.submittedAt, t, language))}</span></>}
            </div>
          </div>
          {app.fundingAsk && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-500">{t.applicationDetail.fundingAsk}</p>
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
          <Section title={t.applicationDetail.actions}>
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
                    <Icon size={13} /> {isLoading ? t.applicationDetail.updating : isApproveDisabled ? t.applicationDetail.approvedCheck : isRejectDisabled ? t.applicationDetail.rejectedLabel : a.label}
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
                <Send size={12} /> {t.applicationDetail.sendMessage}
              </button>
            </div>
            {showMessage && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mt-2">
                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder={t.applicationDetail.messagePlaceholder}
                  className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !messageText.trim()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send size={11} /> {sendingMessage ? t.applicationDetail.sending : t.applicationDetail.sendMessage}
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Business Overview */}
          {(app.problemStatement || app.solution || app.targetMarket || app.businessModel || app.competitiveAdvantage || app.companyDescription) && (
            <Section title={t.applicationDetail.businessOverview}>
              <div className="space-y-4">
                <TextBlock label={t.applicationDetail.aboutTheCompany} text={app.companyDescription} />
                <TextBlock label={t.applicationDetail.problem} text={app.problemStatement} />
                <TextBlock label={t.applicationDetail.solution} text={app.solution} />
                <TextBlock label={t.applicationDetail.targetMarket} text={app.targetMarket} />
                <TextBlock label={t.applicationDetail.businessModel} text={app.businessModel} />
                <TextBlock label={t.applicationDetail.competitiveAdvantage} text={app.competitiveAdvantage} />
              </div>
            </Section>
          )}

          {/* Funding Details */}
          {(app.fundingAsk || app.useOfFunds || app.previousFunding || app.currentValuation || app.equityOffered) && (
            <Section title={t.applicationDetail.funding}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {app.fundingAsk && (
                  <div>
                    <p className="text-xs text-gray-500">{t.applicationDetail.fundingAsk}</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(parseFloat(app.fundingAsk))}</p>
                  </div>
                )}
                {app.currentValuation && (
                  <div>
                    <p className="text-xs text-gray-500">{t.applicationDetail.valuation}</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(parseFloat(app.currentValuation))}</p>
                  </div>
                )}
                {app.equityOffered && (
                  <div>
                    <p className="text-xs text-gray-500">{t.applicationDetail.equityOffered}</p>
                    <p className="text-sm font-semibold text-gray-900">{app.equityOffered}%</p>
                  </div>
                )}
                {app.previousFunding && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-gray-500">{t.applicationDetail.previousFunding}</p>
                    <p className="text-xs text-gray-700 leading-relaxed mt-1">{app.previousFunding}</p>
                  </div>
                )}
                {app.useOfFunds && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-gray-500">{t.applicationDetail.useOfFunds}</p>
                    <p className="text-xs text-gray-700 leading-relaxed mt-1">{app.useOfFunds}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Financial Metrics */}
          {financials.length > 0 && (
            <Section title={t.applicationDetail.financialMetrics}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {financials.map(f => (
                  <div key={f.label}>
                    <p className="text-xs text-gray-500">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-900">{f.value}</p>
                  </div>
                ))}
                {app.keyMetric && (
                  <div>
                    <p className="text-xs text-gray-500">{app.keyMetricLabel || t.applicationDetail.keyMetric}</p>
                    <p className="text-sm font-semibold text-gray-900">{app.keyMetric}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Pitch Deck */}
          {app.pitchDeckUrl && (
            <Section title={t.applicationDetail.pitchDeck}>
              {app.pitchDeckUrl.startsWith('data:') ? (
                <iframe src={app.pitchDeckUrl} className="w-full rounded-xl" style={{ height: '500px' }} title={t.applicationDetail.pitchDeck} />
              ) : (
                <a href={app.pitchDeckUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  <FileText size={14} /> {app.pitchDeckName || t.applicationDetail.viewPitchDeck} <ExternalLink size={10} />
                </a>
              )}
            </Section>
          )}

          {/* Demo Video */}
          {app.demoVideoUrl && (
            <Section title={t.applicationDetail.demoVideo}>
              <VideoEmbed url={app.demoVideoUrl} />
            </Section>
          )}

          {/* Supporting Documents */}
          {supportingDocs.length > 0 && (
            <Section title={t.applicationDetail.supportingDocuments}>
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
            <Section title={t.applicationDetail.meetingDetails}>
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Calendar size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {new Date(app.meetingDate).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-violet-600 font-medium">
                      {new Date(app.meetingDate).toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {app.meetingLocation && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="font-semibold text-gray-500 w-16">{t.applicationDetail.location}</span>
                    <span>{app.meetingLocation}</span>
                  </div>
                )}
                {app.meetingLink && (
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="font-semibold text-gray-500 w-16">{t.applicationDetail.link}</span>
                    <a href={app.meetingLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">{app.meetingLink}</a>
                  </div>
                )}
                {app.meetingAgenda && (
                  <div className="text-xs text-gray-700 pt-1 border-t border-violet-100">
                    <span className="font-semibold text-gray-500 block mb-1">{t.applicationDetail.agenda}</span>
                    <p className="leading-relaxed whitespace-pre-wrap">{app.meetingAgenda}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Requested Documents */}
          {requestedDocs.length > 0 && (
            <Section title={t.applicationDetail.requestedDocuments}>
              <div className="space-y-2">
                {requestedDocs.map((doc, i) => {
                  // A submitted doc is either a share link (doc.link, or an older
                  // record where attachmentId holds an http URL) or a real CRM
                  // attachment (attachmentId that is not a URL).
                  const linkUrl = doc.link || (doc.attachmentId && /^https?:\/\//i.test(doc.attachmentId) ? doc.attachmentId : '');
                  const crmAttachmentId = doc.attachmentId && !/^https?:\/\//i.test(doc.attachmentId) ? doc.attachmentId : '';
                  const hasFile = doc.status === 'submitted' || doc.status === 'uploaded';
                  const ViewButton = () => {
                    if (linkUrl) {
                      return (
                        <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded-md transition-colors">
                          <ExternalLink size={9} /> {t.applicationDetail.view}
                        </a>
                      );
                    }
                    if (crmAttachmentId) {
                      return (
                        <button onClick={() => handleDownloadAttachment(id!, crmAttachmentId, doc.fileName || 'document')} className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded-md transition-colors">
                          <Download size={9} /> {t.applicationDetail.view}
                        </button>
                      );
                    }
                    return null;
                  };
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileUp size={12} className={doc.status === 'submitted' ? 'text-green-500' : doc.status === 'uploaded' ? 'text-blue-500' : 'text-gray-400'} />
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium text-gray-800">{doc.type}</span>
                          {doc.fileName && hasFile && doc.fileName !== doc.type && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{doc.fileName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {doc.status === 'submitted' ? (
                          <>
                            <ViewButton />
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                              <Check size={9} /> {t.applicationDetail.submittedStatus}
                            </span>
                          </>
                        ) : doc.status === 'uploaded' ? (
                          <>
                            <ViewButton />
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                              <Check size={9} /> {t.applicationDetail.uploadedStatus}
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                            <Clock size={9} /> {t.applicationDetail.pendingStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Company Details */}
          <Section title={t.applicationDetail.companyInfo}>
            <div>
              <InfoRow label={t.applicationDetail.website} value={app.companyWebsite ? app.companyWebsite.replace(/^https?:\/\//, '') : undefined} href={app.companyWebsite ? (app.companyWebsite.startsWith('http') ? app.companyWebsite : `https://${app.companyWebsite}`) : undefined} />
              <InfoRow label={t.applicationDetail.industry} value={app.companyIndustry} />
              <InfoRow label={t.applicationDetail.stage} value={app.companyStage} />
              <InfoRow label={t.applicationDetail.location} value={app.companyLocation} />
              <InfoRow label={t.applicationDetail.founded} value={app.foundedYear} />
            </div>
          </Section>

          {/* Founder Details */}
          <Section title={t.applicationDetail.founderDetails}>
            <div>
              <InfoRow label={t.applicationDetail.name} value={app.founderName} />
              <InfoRow label={t.applicationDetail.email} value={app.founderEmail} href={app.founderEmail ? `mailto:${app.founderEmail}` : undefined} />
              <InfoRow label={t.applicationDetail.phone} value={app.founderPhone} href={app.founderPhone ? `tel:${app.founderPhone}` : undefined} />
              <InfoRow label={t.applicationDetail.role} value={app.founderRole} />
              <InfoRow label={t.applicationDetail.linkedIn} value={app.founderLinkedin ? t.applicationDetail.viewProfile : undefined} href={app.founderLinkedin || undefined} />
              {app.coFounders && <InfoRow label={t.applicationDetail.coFounders} value={app.coFounders} />}
            </div>
          </Section>

          {/* Investor Notes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <StickyNote size={12} /> {t.applicationDetail.investorNotes}
            </p>
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t.applicationDetail.notesPlaceholder}
                className="w-full text-xs text-gray-700 leading-relaxed border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-y"
                rows={5}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="text-xs font-semibold text-white bg-black hover:bg-gray-800 px-3.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingNotes ? t.applicationDetail.savingNotes : t.applicationDetail.saveNotes}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

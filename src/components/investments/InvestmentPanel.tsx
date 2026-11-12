import { useRef, useState } from 'react';
import {
  X, ExternalLink, Pencil, Plus, Upload, Download, FileText, Loader2, AlertCircle, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';
import { Button } from '../ui/Button';
import {
  addCashFlow, amountsOf, isPermissionError, resolveSupportingDocumentUrl, SingleFileFieldError,
  uploadSupportingDocument, type InvestmentRecord,
} from '../../services/crmInvestments';
import {
  CashFlowsFullError, formatAmountFull, ownership, returnMetrics,
} from '../../lib/investmentCalc';
import { formatDate, toCsv } from '../../lib/portfolioFormat';
import { cn } from '../../lib/cn';
import CashFlowModal, { type CashFlowFormValue } from './CashFlowModal';
import { Field, StatusBadge } from './investmentUi';
import { flowLabel, type InvText } from './investmentText';

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function InvestmentPanel({
  inv, canEdit, language, t, onClose, onEdit, onOpenCompany, onChanged,
}: {
  inv: InvestmentRecord;
  /** Whether the signed-in user may change records (false = CRM says no). */
  canEdit: boolean;
  language: string;
  t: InvText;
  onClose: () => void;
  onEdit: () => void;
  onOpenCompany: () => void;
  /** Called with the refreshed record after a transaction or document is saved. */
  onChanged: (updated: InvestmentRecord) => void;
}) {
  const locale = language === 'ja' ? 'ja-JP' : 'en-US';
  const money = (n: number | null) => formatAmountFull(n, inv.currency, locale);
  const date = (d: string) => formatDate(d, locale);

  const [txOpen, setTxOpen] = useState(false);
  const [txSaving, setTxSaving] = useState(false);
  const [txError, setTxError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const amounts = amountsOf(inv);
  const returns = returnMetrics({ flows: inv.cashFlows, holdingValue: inv.holdingValue, holdingValueAsOf: inv.holdingValueAsOf });
  const own = ownership({
    sharesAcquired: inv.sharesAcquired, fullyDilutedShares: inv.fullyDilutedShares,
    capTableApproved: inv.capTableApproved, recordedPct: inv.recordedOwnershipPct,
  });

  function failMessage(err: unknown, fallback: string): string {
    if (err instanceof CashFlowsFullError) return t.txFull;
    if (err instanceof SingleFileFieldError) return t.documentSingleFile;
    if (isPermissionError(err)) return t.noPermission;
    return err instanceof Error && err.message ? err.message : fallback;
  }

  async function saveTransaction(v: CashFlowFormValue) {
    setTxSaving(true); setTxError('');
    try {
      onChanged(await addCashFlow(inv.id, v));
      setTxOpen(false);
      setNotice({ ok: true, message: t.txSaved });
    } catch (err) {
      setTxError(failMessage(err, t.actionFailed));
    } finally {
      setTxSaving(false);
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true); setNotice(null);
    try {
      onChanged(await uploadSupportingDocument(inv.id, file));
      setNotice({ ok: true, message: t.documentUploaded });
    } catch (err) {
      setNotice({ ok: false, message: failMessage(err, t.actionFailed) });
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(attachmentId: string, fileName: string) {
    setOpeningId(attachmentId); setNotice(null);
    try {
      const url = await resolveSupportingDocumentUrl(inv.id, attachmentId);
      const blob = await (await fetch(url)).blob();
      URL.revokeObjectURL(url);
      download(blob, fileName || 'document');
    } catch {
      setNotice({ ok: false, message: t.documentFailed });
    } finally {
      setOpeningId('');
    }
  }

  function exportCashFlows() {
    const header = [t.txDate, t.txType, t.txAmount, t.colCurrency, t.txNote, t.colReference, t.colCompany];
    const rows = inv.cashFlows.map(f => [f.date, f.type, f.amount, inv.currency, f.note, inv.reference, inv.companyName]);
    const blob = new Blob(['﻿' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
    download(blob, `${t.exportFilename}-${inv.reference || inv.id}-cash-flows.csv`);
  }

  const amountRow = (label: string, amount: number | null, when: string, extra?: string) => (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-400">{when ? date(when) : t.amountsNoDate}{extra ? ` · ${extra}` : ''}</p>
      </div>
      <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{amount === null ? t.notRecorded : money(amount)}</p>
    </div>
  );

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[30rem] bg-white border-l border-gray-100 shadow-2xl flex flex-col" aria-label={inv.reference}>
      <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-gray-900 truncate">{inv.companyName || '—'}</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{[inv.reference, inv.round].filter(Boolean).join(' · ')}</p>
          <div className="mt-2"><StatusBadge status={inv.status} t={t} /></div>
        </div>
        <button onClick={onClose} aria-label={t.close} className="text-gray-400 hover:text-gray-700 p-1"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onOpenCompany} disabled={!inv.companyId}>
            <ExternalLink size={13} className="mr-1.5" /> {t.colCompany}
          </Button>
          {canEdit && <Button variant="outline" size="sm" onClick={onEdit}><Pencil size={13} className="mr-1.5" /> {t.edit}</Button>}
        </div>

        {notice && (
          <div role={notice.ok ? 'status' : 'alert'}
            className={cn('flex items-start gap-2 text-xs rounded-lg px-3 py-2', notice.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {!notice.ok && <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />}{notice.message}
          </div>
        )}

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.sectionOverview}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label={t.colReference}>{inv.reference || '—'}</Field>
            <Field label={t.colInvestorEntity}>{inv.investorEntity || '—'}</Field>
            <Field label={t.colRound}>{inv.round || '—'}</Field>
            <Field label={t.colInstrument}>{inv.instrument || '—'}</Field>
            <Field label={t.colCurrency}>{inv.currency || '—'}</Field>
            <Field label={t.colInvestmentDate}>{date(inv.investmentDate)}</Field>
            <Field label={t.fTermsReference}>{inv.termsReference || '—'}</Field>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{t.sectionAmounts}</h3>
          {amountRow(t.amountProposed, inv.proposedAmount, inv.proposedDate, inv.approvalDate ? `${t.statuses.Approved} ${date(inv.approvalDate)}` : '')}
          {amountRow(t.amountCommitted, inv.committedAmount, inv.commitmentDate)}
          {amountRow(t.amountFunded, amounts.funded, inv.lastFundingDate)}
          {amountRow(t.amountRefunded, amounts.refunded, '')}
          {amountRow(t.amountRealized, amounts.realized, '')}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.sectionValuation}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label={t.fPreMoney}>{inv.preMoney === null ? '—' : money(inv.preMoney)}</Field>
            <Field label={t.fPostMoney}>{inv.postMoney === null ? '—' : money(inv.postMoney)}</Field>
            <Field label={t.fValuationDate}>{date(inv.valuationDate)}</Field>
            <Field label={t.fPricePerShare}>{inv.pricePerShare === null ? '—' : money(inv.pricePerShare)}</Field>
            <Field label={t.fShares}>{inv.sharesAcquired === null ? '—' : inv.sharesAcquired.toLocaleString(locale)}</Field>
            <Field label={t.fFullyDiluted}>{inv.fullyDilutedShares === null ? '—' : inv.fullyDilutedShares.toLocaleString(locale)}</Field>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">{t.sectionOwnership}</h3>
          {own.pct === null ? (
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">{t.ownershipUnavailable}</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{own.pct.toLocaleString(locale, { maximumFractionDigits: 2 })}%</p>
              <p className="text-xs text-gray-500 mt-1">
                {own.basis === 'cap_table'
                  ? t.ownershipFromCapTable
                    .replace('{shares}', (inv.sharesAcquired ?? 0).toLocaleString(locale))
                    .replace('{total}', (inv.fullyDilutedShares ?? 0).toLocaleString(locale))
                    .replace('{date}', date(inv.capTableAsOf))
                  : t.ownershipRecorded.replace('{date}', inv.capTableAsOf ? ` (${date(inv.capTableAsOf)})` : '')}
              </p>
            </>
          )}
          {inv.capTableReference && <p className="text-[11px] text-gray-400 mt-1">{t.capTableReference}: {inv.capTableReference}</p>}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.sectionReturns}</h3>
          {(returns.realized !== null || returns.unrealized !== null) && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3">
              {returns.realized !== null && <Field label={t.metricRealized}>{money(returns.realized)}</Field>}
              {returns.unrealized !== null && (
                <Field label={t.metricUnrealized}>
                  {money(returns.unrealized)}
                  {inv.holdingValueAsOf && <span className="block text-[11px] font-normal text-gray-400">{t.holdingAsOf.replace('{date}', date(inv.holdingValueAsOf))}</span>}
                </Field>
              )}
            </div>
          )}
          {returns.moic === null ? (
            <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 space-y-1">
              <p>{t.returnsUnavailable}</p>
              {returns.missing.includes('cashFlows') && <p className="text-xs text-gray-400">{t.returnsMissingFlows}</p>}
              {returns.missing.includes('valuation') && <p className="text-xs text-gray-400">{t.returnsMissingValuation}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label={t.metricMoic}>{returns.moic.toFixed(2)}x</Field>
              <Field label={t.metricIrr}>
                {returns.irrPct === null
                  ? <span className="text-gray-400 font-normal text-xs">{t.irrUnavailable}</span>
                  : `${returns.irrPct.toFixed(1)}%`}
              </Field>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">{t.sectionTransactions}</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCashFlows} disabled={inv.cashFlows.length === 0}>
                <Download size={13} className="mr-1.5" /> {t.exportCashFlows}
              </Button>
              {canEdit && <Button variant="outline" size="sm" onClick={() => { setTxError(''); setTxOpen(true); }}><Plus size={13} className="mr-1.5" /> {t.addTransaction}</Button>}
            </div>
          </div>
          {inv.cashFlows.length === 0 ? (
            <p className="text-sm text-gray-500">{t.transactionsEmpty}</p>
          ) : (
            <ol className="space-y-2">
              {[...inv.cashFlows].reverse().map(f => {
                const inflow = f.type !== 'Funding';
                return (
                  <li key={f.id} className="flex items-start gap-3">
                    <span className={cn('w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0',
                      inflow ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-gray-50 border-gray-100 text-gray-500')}>
                      {inflow ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900">{flowLabel(t, f.type)}</p>
                        <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{money(f.amount)}</p>
                      </div>
                      <p className="text-[11px] text-gray-400">{date(f.date)}</p>
                      {f.note && <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-line break-words">{f.note}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900">{t.sectionDocuments}</h3>
            {canEdit && (
              <>
                <input ref={fileInput} type="file" className="hidden" onChange={onFilePicked} />
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Upload size={13} className="mr-1.5" />}
                  {uploading ? t.uploadingDocument : t.uploadDocument}
                </Button>
              </>
            )}
          </div>
          {inv.documents.length === 0 ? (
            <p className="text-sm text-gray-500">{t.documentsEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {inv.documents.map(d => (
                <li key={d.attachmentId} className="flex items-center gap-3 border border-gray-100 rounded-xl px-3 py-2">
                  <FileText size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-800 truncate flex-1">{d.fileName || '—'}</span>
                  <button onClick={() => void openDocument(d.attachmentId, d.fileName)} disabled={openingId === d.attachmentId}
                    className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50">
                    {openingId === d.attachmentId ? '…' : t.viewDocument}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {inv.notes && (
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{t.sectionNotes}</h3>
            <p className="text-sm text-gray-600 whitespace-pre-line break-words">{inv.notes}</p>
          </section>
        )}
      </div>

      {txOpen && (
        <CashFlowModal currency={inv.currency} saving={txSaving} error={txError} t={t}
          onSave={v => void saveTransaction(v)} onClose={() => setTxOpen(false)} />
      )}
    </aside>
  );
}

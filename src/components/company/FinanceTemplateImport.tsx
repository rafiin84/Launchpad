import React, { useState } from 'react';
import {
  Download, Upload, X, Check, AlertTriangle, FileSpreadsheet, Loader2, Info,
} from 'lucide-react';
import {
  buildTemplateWorkbook, parseTemplateWorkbook, reconcile, templateFileName,
  downloadBlob, type ParseResult, type ReconcileIssue,
} from '../../services/financialTemplate';
import {
  saveFinancialQuarter, saveFinancialQuarterAsFounder, computeDerived,
  formatMetric, METRICS,
  type FinancialEntry, type EntrySource, type Quarter,
} from '../../services/companyFinancials';
import { cn } from '../../lib/cn';

/**
 * Spreadsheet round trip for the Finance Update tab.
 *
 * Download a template, fill it in Excel, upload it back. Because the template
 * is generated here, reading it back is an exact lookup rather than an attempt
 * to interpret an arbitrary statement — see financialTemplate.ts.
 *
 * An upload is never saved on sight. What was read is shown first, alongside
 * anything that looks wrong, and only then confirmed. Extraction speeds up the
 * typing; it does not become the record on its own.
 */

const CURRENT_YEAR = new Date().getFullYear();

// Metrics worth showing in the preview — enough to tell at a glance whether
// the right column was read, without reprinting all 26 rows.
const PREVIEW_KEYS = ['revenue', 'cogs', 'grossProfit', 'ebitda', 'netProfit', 'closingCash'] as const;

export default function FinanceTemplateImport({
  companyId, companyName, existing, writeAs, reviewerName, reviewerEmail, onImported,
}: {
  companyId: string;
  companyName: string;
  existing: FinancialEntry[];
  /** Imported figures inherit the uploader's own provenance. */
  writeAs: EntrySource;
  /** Who the import is attributed to, same as a manual entry. */
  reviewerName: string;
  reviewerEmail?: string;
  onImported: (entries: FinancialEntry[]) => void;
}) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [busy, setBusy] = useState<'download' | 'parse' | 'save' | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [issues, setIssues] = useState<ReconcileIssue[]>([]);
  const [selected, setSelected] = useState<Set<Quarter>>(new Set());
  const inputRef = React.useRef<HTMLInputElement>(null);

  const years = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 4 + i);

  const handleDownload = async () => {
    setBusy('download');
    setError('');
    try {
      const blob = await buildTemplateWorkbook({
        portfolioId: companyId, companyName, year, existing,
      });
      downloadBlob(blob, templateFileName(companyName, year));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the template.');
    }
    setBusy(null);
  };

  const handleFile = async (file: File) => {
    setBusy('parse');
    setError('');
    try {
      const result = await parseTemplateWorkbook(file);
      setPreview(result);
      setIssues(reconcile(result.quarters));
      // Everything that carried figures is selected by default; the user can
      // deselect a quarter they would rather not overwrite.
      setSelected(new Set(result.quarters.map(q => q.quarter)));
    } catch (err) {
      setError(err instanceof Error
        ? `Could not read that file: ${err.message}`
        : 'Could not read that file.');
    }
    setBusy(null);
  };

  const confirmImport = async () => {
    if (!preview) return;
    const targetYear = preview.year ?? year;
    setBusy('save');
    setError('');
    try {
      let latest: FinancialEntry[] = existing;
      // Saved one quarter at a time: each write re-reads the stored series, so
      // a partial failure leaves the earlier quarters safely persisted.
      for (const q of preview.quarters) {
        if (!selected.has(q.quarter)) continue;
        const entry: FinancialEntry = {
          ...q.inputs,
          year: targetYear,
          quarter: q.quarter,
          source: writeAs,
          reviewer: reviewerName,
          reviewerEmail,
          updatedAt: new Date().toISOString(),
          notes: preview.notes || undefined,
        };
        latest = writeAs === 'founder'
          ? await saveFinancialQuarterAsFounder(companyId, entry)
          : await saveFinancialQuarter(companyId, entry);
      }
      onImported(latest);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the imported figures.');
    }
    setBusy(null);
  };

  const toggle = (q: Quarter) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q); else next.add(q);
      return next;
    });

  return (
    <>
      {/* ── The two controls ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet size={16} className="text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-900">Fill in a spreadsheet instead</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
              Download the template, enter the quarters in Excel, then upload it back.
              It arrives pre-filled with anything already on record, and shows the
              calculated figures live so a typo is obvious before you upload.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {years.map(y => <option key={y} value={y}>FY{y}</option>)}
          </select>

          <button
            onClick={handleDownload}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            {busy === 'download'
              ? <><Loader2 size={12} className="animate-spin" /> Building...</>
              : <><Download size={12} /> Download template</>}
          </button>

          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === 'parse'
              ? <><Loader2 size={12} className="animate-spin" /> Reading...</>
              : <><Upload size={12} /> Upload filled template</>}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = '';   // allow re-picking the same file
              if (f) void handleFile(f);
            }}
          />
        </div>

        {error && !preview && (
          <p className="text-[11px] text-red-600 font-medium mt-2.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* ── Preview & confirm ── */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-start gap-3 p-5 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet size={17} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">Check before saving</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {preview.quarters.length
                    ? `Read ${preview.quarters.length} quarter${preview.quarters.length > 1 ? 's' : ''} for FY${preview.year ?? year}. Nothing is saved until you confirm.`
                    : 'Nothing could be read from that file.'}
                </p>
              </div>
              <button
                onClick={() => { setPreview(null); setError(''); }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Was this our template? */}
              {!preview.recognised && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    This wasn't a downloaded template, so rows were matched by name.
                    Read every figure below carefully before saving.
                  </p>
                </div>
              )}

              {/* Company mismatch is worth stopping for */}
              {preview.recognised && preview.portfolioId && preview.portfolioId !== companyId && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-100 rounded-xl">
                  <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-900 leading-relaxed">
                    <span className="font-bold">This template was generated for a different company.</span>{' '}
                    Saving will attach these figures to {companyName || 'this company'} anyway.
                    Check you have the right file.
                  </p>
                </div>
              )}

              {preview.warnings.map(w => (
                <div key={w} className="flex items-start gap-2.5 px-3.5 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900">{w}</p>
                </div>
              ))}

              {issues.length > 0 && (
                <div className="bg-white border border-amber-200 rounded-xl p-3.5">
                  <p className="text-[11px] font-bold text-amber-900 mb-1.5">
                    Worth a second look
                  </p>
                  <ul className="space-y-1">
                    {issues.map(i => (
                      <li key={`${i.quarter}-${i.message}`} className="text-[11px] text-amber-800 flex gap-1.5">
                        <span className="font-semibold flex-shrink-0">Q{i.quarter}</span>
                        <span>{i.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What was read, per quarter */}
              {preview.quarters.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left font-semibold text-gray-500 py-2 pr-3">Save</th>
                        <th className="text-left font-semibold text-gray-500 py-2 pr-3">Quarter</th>
                        {PREVIEW_KEYS.map(k => (
                          <th key={k} className="text-right font-semibold text-gray-500 py-2 px-3 whitespace-nowrap">
                            {METRICS.find(m => m.key === k)?.label ?? k}
                          </th>
                        ))}
                        <th className="text-right font-semibold text-gray-500 py-2 pl-3">Fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.quarters.map(q => {
                        const derived = computeDerived(q.inputs);
                        const merged = { ...q.inputs, ...derived } as Record<string, number | undefined>;
                        const already = existing.some(e =>
                          e.year === (preview.year ?? year) && e.quarter === q.quarter);
                        return (
                          <tr key={q.quarter} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 pr-3">
                              <input
                                type="checkbox"
                                checked={selected.has(q.quarter)}
                                onChange={() => toggle(q.quarter)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              <span className="font-semibold text-gray-900">Q{q.quarter}</span>
                              {already && (
                                <span className="ml-1.5 text-[10px] text-amber-600 font-semibold">
                                  REPLACES
                                </span>
                              )}
                            </td>
                            {PREVIEW_KEYS.map(k => {
                              const def = METRICS.find(m => m.key === k);
                              const v = merged[k];
                              return (
                                <td key={k} className={cn('py-2 px-3 text-right whitespace-nowrap',
                                  v === undefined ? 'text-gray-300'
                                    : (v < 0 && (k === 'netProfit' || k === 'ebitda')) ? 'text-red-700 font-semibold'
                                    : 'text-gray-900')}>
                                  {formatMetric(v, def?.format ?? 'currency')}
                                </td>
                              );
                            })}
                            <td className="py-2 pl-3 text-right text-gray-400">{q.filled}/14</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.notes && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                    Notes from the sheet
                  </p>
                  <p className="text-[11px] text-gray-700 whitespace-pre-wrap">{preview.notes}</p>
                </div>
              )}

              <p className="text-[11px] text-gray-400">
                {writeAs === 'founder'
                  ? 'These will be saved as self-reported until the Level 1 Reviewer verifies them.'
                  : 'These will be saved as reviewer-verified.'}
              </p>

              {error && (
                <p className="text-[11px] text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => { setPreview(null); setError(''); }}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={busy !== null || selected.size === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                {busy === 'save'
                  ? <><Loader2 size={12} className="animate-spin" /> Saving...</>
                  : <><Check size={13} /> Save {selected.size} quarter{selected.size === 1 ? '' : 's'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

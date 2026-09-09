import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Cell, AreaChart, Area,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Plus, Pencil, X, Save, Lock,
  FileText, AlertCircle, Table2, BarChart3, ShieldCheck, UserCircle2, Pencil as PencilIcon, Paperclip, Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchFinancials, saveFinancialQuarter, buildRows, comparePeriods,
  fetchFinancialsAsFounder, saveFinancialQuarterAsFounder,
  findDiscrepancies, entrySource,
  METRICS, METRIC_GROUPS, INPUT_KEYS, formatMetric, formatCurrency, hasAnyInput,
  type FinancialEntry, type FinancialInputs, type FinancialRow,
  type ViewMode, type Quarter, type MetricDef, type EntrySource,
  type SourcePreference,
} from '../../services/companyFinancials';
import { fetchCRMDocuments, type CRMDocument } from '../../services/crmDocuments';
import FinanceTemplateImport from './FinanceTemplateImport';
import FinanceDocumentUpload from './FinanceDocumentUpload';
import { cn } from '../../lib/cn';

/**
 * Finance Update — the first tab on the Company page.
 *
 *   Founder uploads quarterly documents → Level 1 Reviewer reviews them →
 *   Reviewer enters the structured summary here → Investors read the figures.
 *
 * Only a Level 1 Reviewer can enter or change figures. Everyone else, the
 * investor included, gets the same numbers read-only.
 *
 * Every figure below is computed from the reviewer's stored quarters. Halves
 * and full years are aggregated from the quarters rather than entered, so they
 * can never disagree with each other.
 */

// ─── Chart palette ───────────────────────────────────────────────────────────
// Categorical slots 1 and 2 of the validated palette. Adjacent-pair checks:
// CVD ΔE 24.7 (protan), normal-vision ΔE 33.6, both ≥3:1 on the light surface.
const SERIES_1 = '#2a78d6';   // blue   — primary measure
const SERIES_2 = '#eb6834';   // orange — the contrasting measure
const POS = '#0ca30c';        // status good     — profit
const NEG = '#d03b3b';        // status critical — loss
const GRID = '#eef0f2';
const AXIS = '#8a8f98';

const CURRENT_YEAR = new Date().getFullYear();

// ─── Small building blocks ───────────────────────────────────────────────────

function DeltaBadge({ change, changePct, direction }: {
  change?: number; changePct?: number; direction: 'up' | 'down' | 'flat' | 'na';
}) {
  if (direction === 'na') return <span className="text-[11px] text-gray-300">—</span>;
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const tone = direction === 'up' ? 'text-emerald-700 bg-emerald-50'
    : direction === 'down' ? 'text-red-700 bg-red-50'
    : 'text-gray-500 bg-gray-50';
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded', tone)}>
      <Icon size={10} />
      {changePct !== undefined ? `${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%` : formatCurrency(change)}
    </span>
  );
}

/** Shared tooltip so every chart reads the same way. */
function ChartTip({ active, payload, label, format = 'currency' }: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
  format?: 'currency' | 'percent';
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-[11px] font-bold text-gray-900 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey ?? p.name} className="text-[11px] text-gray-600 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}</span>
          <span className="font-semibold text-gray-900 ml-auto pl-3">
            {format === 'percent' ? `${(p.value ?? 0).toFixed(1)}%` : formatCurrency(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children, empty }: {
  title: string; subtitle?: string; children: React.ReactNode; empty?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="mb-3">
        <h4 className="text-xs font-bold text-gray-900">{title}</h4>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {empty
        ? <div className="h-[180px] flex items-center justify-center text-[11px] text-gray-300">
            Not enough data yet
          </div>
        : <div style={{ height: 180 }}>{children}</div>}
    </div>
  );
}

const axisProps = {
  tick: { fontSize: 10, fill: AXIS },
  axisLine: { stroke: GRID },
  tickLine: false,
} as const;

// ─── Reviewer entry form ─────────────────────────────────────────────────────

const INPUT_LABELS: Record<keyof FinancialInputs, string> = {
  revenue: 'Revenue',
  cogs: 'COGS',
  salaryExpenses: 'Salary / Employee Expenses',
  operatingExpenses: 'Operating Expenses',
  depreciation: 'Depreciation & Amortisation',
  interest: 'Interest',
  tax: 'Tax',
  cashInflow: 'Cash Inflow',
  cashOutflow: 'Cash Outflow',
  openingCash: 'Opening Cash',
  accountsReceivable: 'Accounts Receivable',
  accountsPayable: 'Accounts Payable',
  totalAssets: 'Total Assets',
  totalLiabilities: 'Total Liabilities',
};

const INPUT_SECTIONS: { label: string; keys: (keyof FinancialInputs)[]; hint?: string }[] = [
  { label: 'Income & Expenses', keys: ['revenue', 'cogs', 'salaryExpenses', 'operatingExpenses'] },
  { label: 'Below the line', keys: ['depreciation', 'interest', 'tax'] },
  { label: 'Cash Flow', keys: ['cashInflow', 'cashOutflow', 'openingCash'],
    hint: 'Closing cash, burn rate and runway are calculated from these.' },
  { label: 'Balance Sheet', keys: ['accountsReceivable', 'accountsPayable', 'totalAssets', 'totalLiabilities'],
    hint: 'Equity is calculated as assets minus liabilities.' },
];

/** Owns the period selection; the editor below it remounts per period. */
function QuarterForm(props: {
  companyId: string;
  existing: FinancialEntry[];
  documents: CRMDocument[];
  reviewerName: string;
  reviewerEmail: string;
  writeAs: EntrySource;
  onSaved: (entries: FinancialEntry[]) => void;
  onClose: () => void;
}) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [quarter, setQuarter] = useState<Quarter>(1);
  return (
    <QuarterEditor
      key={`${year}-${quarter}`}
      {...props}
      year={year}
      quarter={quarter}
      onYear={setYear}
      onQuarter={setQuarter}
    />
  );
}

function QuarterEditor({
  companyId, existing, documents, reviewerName, reviewerEmail, onSaved, onClose,
  year, quarter, onYear, onQuarter, writeAs,
}: {
  companyId: string;
  existing: FinancialEntry[];
  documents: CRMDocument[];
  reviewerName: string;
  reviewerEmail: string;
  onSaved: (entries: FinancialEntry[]) => void;
  onClose: () => void;
  year: number;
  quarter: Quarter;
  onYear: (y: number) => void;
  onQuarter: (q: Quarter) => void;
  /** Whether these figures are self-reported or reviewer-verified. */
  writeAs: EntrySource;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Whatever is already stored for the selected quarter seeds the fields, so
  // editing is an update rather than a blank re-entry. This is derived state,
  // so the fields remount on a period key (see the `key` below) instead of
  // being synced in an effect.
  const match = existing.find(e =>
    e.year === year && e.quarter === quarter && entrySource(e) === writeAs);
  const seed: Record<string, string> = {};
  if (match) {
    for (const k of INPUT_KEYS) {
      if (match[k] !== undefined) seed[k] = String(match[k]);
    }
  }

  const [values, setValues] = useState<Record<string, string>>(seed);
  const [notes, setNotes] = useState(match?.notes ?? '');
  const [docIds, setDocIds] = useState<string[]>(match?.sourceDocumentIds ?? []);

  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  const parsed = useMemo(() => {
    const out: FinancialInputs = {};
    for (const k of INPUT_KEYS) {
      const raw = values[k];
      if (raw === undefined || raw.trim() === '') continue;
      const n = Number(raw.replace(/[,$\s]/g, ''));
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }, [values]);

  const isEditing = !!match;

  const save = async () => {
    if (!hasAnyInput(parsed)) { setError('Enter at least one figure before saving.'); return; }
    setSaving(true);
    setError('');
    try {
      const entry: FinancialEntry = {
        ...parsed,
        year, quarter,
        source: writeAs,
        reviewer: reviewerName,
        reviewerEmail,
        updatedAt: new Date().toISOString(),
        notes: notes.trim() || undefined,
        sourceDocumentIds: docIds.length ? docIds : undefined,
      };
      // Founders reach Portfolios through the proxy; reviewers use their own
      // CRM token. Both write to the same record, which is what makes a
      // founder's update appear on the investor's Company page.
      const next = writeAs === 'founder'
        ? await saveFinancialQuarterAsFounder(companyId, entry)
        : await saveFinancialQuarter(companyId, entry);
      onSaved(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the financial summary.');
      setSaving(false);
    }
  };

  const years = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 4 + i);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Pencil size={17} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900">
              {isEditing ? 'Update' : 'Add'} quarterly financials
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {writeAs === 'founder'
                ? 'Enter your figures for the quarter. Margins, EBITDA, profit, burn and runway are calculated — you don’t enter them.'
                : 'Enter the figures from the founder’s documents. Margins, EBITDA, profit, burn and runway are calculated — you don’t enter them.'}
            </p>
            <p className={cn('text-[11px] font-semibold mt-1.5 inline-flex items-center gap-1',
              writeAs === 'founder' ? 'text-amber-700' : 'text-emerald-700')}>
              {writeAs === 'founder'
                ? <><UserCircle2 size={11} /> Saved as self-reported</>
                : <><ShieldCheck size={11} /> Saved as reviewer-verified</>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Financial year</label>
              <select
                value={year}
                onChange={e => onYear(Number(e.target.value))}
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {years.map(y => <option key={y} value={y}>FY{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Quarter</label>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4] as Quarter[]).map(q => {
                  const filled = existing.some(e =>
                    e.year === year && e.quarter === q && entrySource(e) === writeAs);
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => onQuarter(q)}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-xs font-bold border transition-all relative',
                        quarter === q
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      )}
                    >
                      Q{q}
                      {filled && quarter !== q && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {isEditing && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Q{quarter} FY{year} already has figures — saving will replace them.
            </p>
          )}

          {/* Inputs */}
          {INPUT_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                {section.label}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.keys.map(k => (
                  <div key={k}>
                    <label className="block text-[11px] text-gray-600 mb-1">{INPUT_LABELS[k]}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={values[k] ?? ''}
                      onChange={e => set(k, e.target.value)}
                      placeholder="—"
                      className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                  </div>
                ))}
              </div>
              {section.hint && <p className="text-[10px] text-gray-400 mt-1.5">{section.hint}</p>}
            </div>
          ))}

          {/* Source documents */}
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              Source documents
            </p>
            {documents.length === 0 ? (
              <p className="text-[11px] text-gray-400">
                No documents uploaded for this company yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {documents.map(doc => (
                  <label
                    key={doc.id}
                    className="flex items-center gap-2.5 px-3 py-2 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={docIds.includes(doc.id)}
                      onChange={e => setDocIds(prev =>
                        e.target.checked ? [...prev, doc.id] : prev.filter(id => id !== doc.id))}
                      className="rounded border-gray-300"
                    />
                    <FileText size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-[11px] text-gray-700 truncate">
                      {doc.documentName || doc.fileName || 'Untitled'}
                    </span>
                    {doc.documentType && (
                      <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{doc.documentType}</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reviewer notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the investor should know about these figures..."
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>

          {error && (
            <p className="text-[11px] text-red-600 font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-black rounded-lg disabled:opacity-50"
          >
            <Save size={13} /> {saving ? 'Saving...' : `Save Q${quarter} FY${year}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Metric table ────────────────────────────────────────────────────────────

function MetricTable({ rows }: { rows: FinancialRow[] }) {
  // Comparison to the previous comparable period, per metric.
  const comparisons = useMemo(() => {
    const map = new Map<string, ReturnType<typeof comparePeriods>>();
    for (const m of METRICS) map.set(String(m.key), comparePeriods(rows, m.key));
    return map;
  }, [rows]);

  const cellTone = (m: MetricDef, v?: number) => {
    if (v === undefined) return 'text-gray-300';
    if (m.key === 'netProfit' || m.key === 'pbt' || m.key === 'ebitda') {
      return v < 0 ? 'text-red-700 font-semibold' : 'text-gray-900';
    }
    return 'text-gray-900';
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 sticky left-0 bg-gray-50/60 min-w-[190px]">
                Metric
              </th>
              {rows.map(r => (
                <th key={r.label} className="text-right font-semibold text-gray-700 px-4 py-2.5 whitespace-nowrap min-w-[130px]">
                  {r.label}
                  {r.provenance === 'founder' && (
                    <span
                      className="ml-1 text-[9px] text-amber-600 font-semibold"
                      title={r.mixedProvenance
                        ? 'Mixes verified and self-reported quarters'
                        : 'Self-reported by the company, not yet verified'}
                    >
                      {r.mixedProvenance ? 'MIXED' : 'REPORTED'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_GROUPS.map(group => (
              <React.Fragment key={group.key}>
                <tr className="bg-gray-50/40">
                  <td
                    colSpan={rows.length + 1}
                    className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide"
                  >
                    {group.label}
                  </td>
                </tr>
                {METRICS.filter(m => m.group === group.key).map(m => {
                  const cmp = comparisons.get(String(m.key)) ?? [];
                  return (
                    <tr key={String(m.key)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                      <td className="px-4 py-2 sticky left-0 bg-white">
                        <span className="text-gray-600">{m.label}</span>
                        {m.derived && (
                          <span
                            className="ml-1.5 text-[9px] text-indigo-400 font-semibold"
                            title="Calculated from the reviewer's entered figures"
                          >
                            CALC
                          </span>
                        )}
                      </td>
                      {rows.map((r, i) => (
                        <td key={r.label} className="px-4 py-2 text-right whitespace-nowrap">
                          <span className={cellTone(m, r[m.key] as number | undefined)}>
                            {formatMetric(r[m.key] as number | undefined, m.format)}
                          </span>
                          {i > 0 && cmp[i] && cmp[i].direction !== 'na' && (
                            <span className="ml-2 inline-block align-middle">
                              <DeltaBadge {...cmp[i]} />
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Charts ──────────────────────────────────────────────────────────────────

function Charts({ rows }: { rows: FinancialRow[] }) {
  const data = rows.map(r => ({
    label: r.label,
    revenue: r.revenue,
    totalExpenses: r.totalExpenses,
    grossProfit: r.grossProfit,
    ebitda: r.ebitda,
    netProfit: r.netProfit,
    closingCash: r.closingCash,
    burnRate: r.burnRate,
  }));
  const thin = rows.length < 2;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Revenue vs Expenses — the only two-series chart, so the only legend */}
      <ChartCard
        title="Revenue vs Expenses"
        subtitle="Both on one scale — the gap is the operating result"
        empty={!rows.length}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={v => formatCurrency(v)} width={54} />
            <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            />
            <Bar dataKey="revenue" name="Revenue" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="totalExpenses" name="Total Expenses" fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Gross Profit" subtitle="Revenue less cost of goods sold" empty={thin}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={v => formatCurrency(v)} width={54} />
            <Tooltip content={<ChartTip />} />
            <ReferenceLine y={0} stroke={AXIS} strokeDasharray="2 2" />
            <Line
              type="monotone" dataKey="grossProfit" name="Gross Profit"
              stroke={SERIES_1} strokeWidth={2}
              dot={{ r: 4, fill: SERIES_1, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }} connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="EBITDA" subtitle="Earnings before interest, tax, depreciation & amortisation" empty={thin}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={v => formatCurrency(v)} width={54} />
            <Tooltip content={<ChartTip />} />
            <ReferenceLine y={0} stroke={AXIS} strokeDasharray="2 2" />
            <Line
              type="monotone" dataKey="ebitda" name="EBITDA"
              stroke={SERIES_1} strokeWidth={2}
              dot={{ r: 4, fill: SERIES_1, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }} connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Sign is carried by position against the zero baseline, not colour alone */}
      <ChartCard title="Net Profit / (Loss)" subtitle="Bars below the line are losses" empty={!rows.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={v => formatCurrency(v)} width={54} />
            <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <ReferenceLine y={0} stroke={AXIS} />
            <Bar dataKey="netProfit" name="Net Profit / (Loss)" radius={[4, 4, 0, 0]} maxBarSize={30}>
              {data.map(d => (
                <Cell key={d.label} fill={(d.netProfit ?? 0) < 0 ? NEG : POS} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cash Balance" subtitle="Closing cash at the end of each period" empty={thin}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.18} />
                <stop offset="100%" stopColor={SERIES_1} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={v => formatCurrency(v)} width={54} />
            <Tooltip content={<ChartTip />} />
            <Area
              type="monotone" dataKey="closingCash" name="Closing Cash"
              stroke={SERIES_1} strokeWidth={2} fill="url(#cashFill)"
              dot={{ r: 4, fill: SERIES_1, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }} connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Burn Rate" subtitle="Average monthly net cash outflow — below zero means cash generated" empty={!rows.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={v => formatCurrency(v)} width={54} />
            <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <ReferenceLine y={0} stroke={AXIS} />
            <Bar dataKey="burnRate" name="Monthly Burn" fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ─── Headline tiles ──────────────────────────────────────────────────────────

function Headline({ rows }: { rows: FinancialRow[] }) {
  if (!rows.length) return null;
  const latest = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : undefined;

  const tiles: { label: string; value: string; metric: keyof FinancialRow }[] = [
    { label: 'Revenue', value: formatMetric(latest.revenue, 'currency'), metric: 'revenue' },
    { label: 'Net Profit / (Loss)', value: formatMetric(latest.netProfit, 'currency'), metric: 'netProfit' },
    { label: 'Closing Cash', value: formatMetric(latest.closingCash, 'currency'), metric: 'closingCash' },
    { label: 'Runway', value: formatMetric(latest.runwayMonths, 'months'), metric: 'runwayMonths' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map(tile => {
        const cur = latest[tile.metric] as number | undefined;
        const before = prev?.[tile.metric] as number | undefined;
        const change = cur !== undefined && before !== undefined ? cur - before : undefined;
        const pctChange = change !== undefined && before ? (change / Math.abs(before)) * 100 : undefined;
        const dir = change === undefined ? 'na' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
        const negative = (cur ?? 0) < 0 && tile.metric === 'netProfit';
        return (
          <div key={tile.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-[11px] text-gray-500">{tile.label}</p>
            <p className={cn('text-lg font-bold mt-0.5', negative ? 'text-red-700' : 'text-gray-900')}>
              {tile.value}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <DeltaBadge change={change} changePct={pctChange} direction={dir as 'up' | 'down' | 'flat' | 'na'} />
              {prev && <span className="text-[10px] text-gray-400">vs {prev.label}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── The tab ─────────────────────────────────────────────────────────────────

export default function FinanceUpdateTab({
  companyId, companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const { currentUser, reviewerLevel, isReviewer, isFounder } = useAuth();
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [documents, setDocuments] = useState<CRMDocument[]>([]);
  const [mode, setMode] = useState<ViewMode>('quarterly');
  const [view, setView] = useState<'charts' | 'table'>('charts');
  const [preference, setPreference] = useState<SourcePreference>('best');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState('');

  /**
   * Both sides can supply figures, and what they write is labelled differently:
   * a founder reports on their own company, the Level 1 Reviewer verifies
   * against the documents. Investors read but never write.
   */
  const writeAs: EntrySource | null =
    isFounder ? 'founder'
    : isReviewer && reviewerLevel === 1 ? 'reviewer'
    : null;
  const canEdit = writeAs !== null;

  // `loading` starts true and is only cleared once the fetch resolves, so no
  // state is set synchronously from the effect body below.
  const load = useCallback(async () => {
    try {
      const [fin, docs] = await Promise.all([
        isFounder ? fetchFinancialsAsFounder(companyId) : fetchFinancials(companyId),
        fetchCRMDocuments().catch(() => [] as CRMDocument[]),
      ]);
      // Nothing is set before this first await, so the effect body stays free
      // of synchronous state updates.
      setError('');
      setEntries(fin);
      // Documents the founder uploaded against this company, as the audit source.
      const name = companyName.trim().toLowerCase();
      setDocuments(docs.filter(d => (d.relatedCompany || '').trim().toLowerCase() === name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load financial data.');
    }
    setLoading(false);
  }, [companyId, companyName, isFounder]);

  // `load` only touches state after its first await, so there is no cascading
  // render here; the rule cannot see through the async boundary. This is the
  // same fetch-on-mount pattern the other data pages in this app use.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => buildRows(entries, mode, preference), [entries, mode, preference]);

  const discrepancies = useMemo(() => findDiscrepancies(entries), [entries]);
  const hasReported = entries.some(e => entrySource(e) === 'founder');
  const hasVerified = entries.some(e => entrySource(e) === 'reviewer');
  const unverifiedCount = entries.filter(e => entrySource(e) === 'founder'
    && !entries.some(v => v.year === e.year && v.quarter === e.quarter && entrySource(v) === 'reviewer')).length;

  const linkedDocs = useMemo(() => {
    const ids = new Set(rows.flatMap(r => r.sourceDocumentIds ?? []));
    return documents.filter(d => ids.has(d.id));
  }, [rows, documents]);

  const MODES: { key: ViewMode; label: string }[] = [
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'half', label: 'Half-Yearly' },
    { key: 'yearly', label: 'Yearly' },
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-1/4 mb-3" />
            <div className="h-24 bg-gray-50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showForm && (
        <QuarterForm
          companyId={companyId}
          existing={entries}
          documents={documents}
          reviewerName={currentUser.name}
          reviewerEmail={currentUser.email}
          writeAs={writeAs ?? 'founder'}
          onSaved={setEntries}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                mode === m.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {hasReported && hasVerified && (
          <div className="flex gap-1">
            {([
              { key: 'best', label: 'Latest' },
              { key: 'verified', label: 'Verified only' },
              { key: 'reported', label: 'As reported' },
            ] as { key: SourcePreference; label: string }[]).map(p => (
              <button
                key={p.key}
                onClick={() => setPreference(p.key)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  preference === p.key ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : 'text-gray-500 hover:bg-gray-100',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setView('charts')}
            className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold',
              view === 'charts' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100')}
          >
            <BarChart3 size={12} /> Charts
          </button>
          <button
            onClick={() => setView('table')}
            className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold',
              view === 'table' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100')}
          >
            <Table2 size={12} /> Table
          </button>
        </div>

        {canEdit ? (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gray-900 hover:bg-black"
          >
            <Plus size={13} /> Finance Update
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Lock size={10} /> Reported by the company, verified by the Level 1 Reviewer
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {/* Financial documents — up to 5 files, also saved to the Documents page. */}
      {canEdit && (showUpload || entries.length > 0) && (
        <FinanceDocumentUpload
          companyName={companyName}
          authorName={currentUser.name}
          authorRole={writeAs === 'founder' ? 'founder' : 'investor'}
          onUploaded={() => { void load(); }}
        />
      )}

      {/* Spreadsheet route — download a template, fill it in Excel, upload it
          back. Only offered to whoever may actually record figures. */}
      {canEdit && (
        <FinanceTemplateImport
          companyId={companyId}
          companyName={companyName}
          existing={entries}
          writeAs={writeAs ?? 'founder'}
          reviewerName={currentUser.name}
          reviewerEmail={currentUser.email}
          onImported={setEntries}
        />
      )}

      {/* Empty state */}
      {!entries.length ? (
        canEdit ? (
          /* Two ways in, offered as equal choices rather than one button and a
             hidden alternative: type the quarter in, or send the documents. */
          <div>
            <div className="text-center mb-5">
              <p className="text-sm font-medium text-gray-700">No financial data yet</p>
              <p className="text-xs text-gray-400 mt-1">
                {writeAs === 'founder'
                  ? 'Start with your first quarter, or send the documents and let the reviewer enter them.'
                  : 'Enter the first quarter from the founder’s documents, or attach the documents first.'}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setShowForm(true)}
                className="text-left bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-900 hover:shadow-sm transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center mb-3">
                  <PencilIcon size={17} className="text-white" />
                </div>
                <p className="text-sm font-bold text-gray-900">Add first quarter update</p>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  Type in the figures for one quarter. Margins, EBITDA, profit, burn and
                  runway are calculated for you.
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-900 mt-2.5">
                  <Plus size={11} /> Enter figures
                </span>
              </button>

              <button
                onClick={() => setShowUpload(true)}
                className="text-left bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-400 hover:shadow-sm transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
                  <Paperclip size={17} className="text-indigo-600" />
                </div>
                <p className="text-sm font-bold text-gray-900">Upload documents</p>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                  Attach up to 5 statements or spreadsheets. They are saved to your
                  Documents page too, and a filled-in template can be imported straight
                  into the figures.
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 mt-2.5">
                  <Upload size={11} /> Choose files
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
            <AlertCircle size={26} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 mb-1">No financial data yet</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Neither the company nor the Level 1 Reviewer has entered quarterly figures yet.
            </p>
          </div>
        )
      ) : (
        <>
          {/* Where these numbers came from — an investor should never have to
              guess whether a figure has been checked. */}
          {unverifiedCount > 0 && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
              <UserCircle2 size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-900">
                  {unverifiedCount} quarter{unverifiedCount > 1 ? 's' : ''} self-reported by the company,
                  not yet verified
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  {isReviewer && reviewerLevel === 1
                    ? 'Review the supporting documents and enter the verified figures to replace these.'
                    : 'These figures came from the company and have not been checked against its documents by the Level 1 Reviewer.'}
                </p>
              </div>
            </div>
          )}

          {discrepancies.length > 0 && (
            <div className="bg-white border border-red-100 rounded-2xl p-4">
              <div className="flex items-start gap-2.5 mb-2.5">
                <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-900">
                    {discrepancies.length} figure{discrepancies.length > 1 ? 's' : ''} differ
                    between the company's report and the verified accounts
                  </p>
                  <p className="text-[11px] text-red-700 mt-0.5">
                    Verified values are the ones shown above.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="text-left font-semibold py-1">Period</th>
                      <th className="text-left font-semibold py-1">Metric</th>
                      <th className="text-right font-semibold py-1">Reported</th>
                      <th className="text-right font-semibold py-1">Verified</th>
                      <th className="text-right font-semibold py-1">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discrepancies.map(d => {
                      const def = METRICS.find(m => m.key === d.metric);
                      return (
                        <tr key={`${d.year}-${d.quarter}-${d.metric}`} className="border-t border-gray-50">
                          <td className="py-1.5 text-gray-600">Q{d.quarter} FY{d.year}</td>
                          <td className="py-1.5 text-gray-700">{def?.label ?? d.metric}</td>
                          <td className="py-1.5 text-right text-gray-500">
                            {formatMetric(d.reported, def?.format ?? 'currency')}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-gray-900">
                            {formatMetric(d.verified, def?.format ?? 'currency')}
                          </td>
                          <td className={cn('py-1.5 text-right font-semibold',
                            d.diff < 0 ? 'text-red-700' : 'text-emerald-700')}>
                            {d.diff > 0 ? '+' : ''}{formatMetric(d.diff, def?.format ?? 'currency')}
                            {d.diffPct !== undefined && (
                              <span className="text-gray-400 font-normal ml-1">
                                ({d.diffPct > 0 ? '+' : ''}{d.diffPct.toFixed(1)}%)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Headline rows={rows} />
          {view === 'charts' ? <Charts rows={rows} /> : <MetricTable rows={rows} />}

          {/* Provenance — who verified, and from which documents */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2.5">
              Verification & sources
            </p>
            <div className="space-y-2">
              {entries.slice().reverse().map(e => (
                <div key={`${e.year}-${e.quarter}-${entrySource(e)}`} className="flex items-start gap-2 flex-wrap text-[11px]">
                  <span className="font-semibold text-gray-800 min-w-[70px]">Q{e.quarter} FY{e.year}</span>
                  <span className={cn('inline-flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded',
                    entrySource(e) === 'reviewer'
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-amber-700 bg-amber-50')}>
                    {entrySource(e) === 'reviewer'
                      ? <><ShieldCheck size={9} /> Verified</>
                      : <><UserCircle2 size={9} /> Self-reported</>}
                  </span>
                  <span className="text-gray-500">
                    {e.reviewer || '—'}
                    {e.updatedAt && ` · ${new Date(e.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </span>
                  {e.sourceDocumentIds?.length ? (
                    <span className="inline-flex items-center gap-1 text-indigo-600">
                      <FileText size={10} /> {e.sourceDocumentIds.length} document{e.sourceDocumentIds.length > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-gray-300">no documents linked</span>
                  )}
                  {e.notes && <span className="text-gray-500 w-full pl-[78px] italic">{e.notes}</span>}
                </div>
              ))}
            </div>

            {linkedDocs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Supporting documents
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {linkedDocs.map(d => (
                    <span
                      key={d.id}
                      className="inline-flex items-center gap-1 text-[11px] text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1"
                    >
                      <FileText size={10} className="text-gray-400" />
                      {d.documentName || d.fileName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

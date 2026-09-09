// ─────────────────────────────────────────────────────────────────────────────
//  Finance Update spreadsheet template — download, fill in Excel, upload back.
//
//  The point of generating the template ourselves is that extraction stops
//  being guesswork. We control the layout, so reading it back is an exact
//  lookup rather than an attempt to interpret an arbitrary statement: no column
//  ambiguity, no unit confusion, no label synonyms.
//
//  A hidden `_meta` sheet carries the field keys, the row each one sits on, the
//  financial year and the Portfolio record id. The parser reads THAT, not the
//  English labels — so a founder renaming "Revenue" to "Total revenue" in Excel
//  does not break the import. If the sheet is missing (a hand-made file, or an
//  older template) the parser falls back to label matching and says so.
//
//  exceljs is imported dynamically: it is a large library and nothing here is
//  needed until someone actually clicks download or upload.
// ─────────────────────────────────────────────────────────────────────────────

import {
  INPUT_KEYS, type FinancialInputs, type FinancialEntry, type Quarter,
} from './companyFinancials';

/** Bumped when the layout changes in a way the parser must know about. */
export const TEMPLATE_VERSION = 1;

const META_SHEET = '_meta';
const DATA_SHEET = 'Finance Update';

/** Row labels, in the order they appear in the sheet. */
const ROW_LABELS: Record<keyof FinancialInputs, string> = {
  revenue: 'Revenue',
  cogs: 'COGS (cost of goods sold)',
  salaryExpenses: 'Salary / employee expenses',
  operatingExpenses: 'Operating expenses',
  depreciation: 'Depreciation & amortisation',
  interest: 'Interest',
  tax: 'Tax',
  cashInflow: 'Cash inflow',
  cashOutflow: 'Cash outflow',
  openingCash: 'Opening cash',
  accountsReceivable: 'Accounts receivable',
  accountsPayable: 'Accounts payable',
  totalAssets: 'Total assets',
  totalLiabilities: 'Total liabilities',
};

const SECTIONS: { title: string; keys: (keyof FinancialInputs)[] }[] = [
  { title: 'INCOME & EXPENSES', keys: ['revenue', 'cogs', 'salaryExpenses', 'operatingExpenses'] },
  { title: 'BELOW THE LINE', keys: ['depreciation', 'interest', 'tax'] },
  { title: 'CASH FLOW', keys: ['cashInflow', 'cashOutflow', 'openingCash'] },
  { title: 'BALANCE SHEET', keys: ['accountsReceivable', 'accountsPayable', 'totalAssets', 'totalLiabilities'] },
];

const QUARTER_COLS = ['B', 'C', 'D', 'E'] as const;

// ─── Building the template ───────────────────────────────────────────────────

export interface TemplateOptions {
  portfolioId: string;
  companyName: string;
  year: number;
  /** Existing figures to pre-fill, so an update starts from what is on record. */
  existing?: FinancialEntry[];
  currency?: string;
}

/**
 * Produces the .xlsx template as a Blob, ready to hand to the browser.
 *
 * The calculated block uses real Excel formulas, so the founder sees the same
 * derived numbers the app will compute — a typo shows up as an absurd margin
 * in their own spreadsheet, before they ever upload it.
 */
export async function buildTemplateWorkbook(opts: TemplateOptions): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Zoho VC CRM';
  wb.created = new Date();

  const ws = wb.addWorksheet(DATA_SHEET, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 6 }],
  });
  ws.columns = [
    { width: 34 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
  ];

  const currency = opts.currency || 'INR';

  // ── Header ──
  ws.getCell('A1').value = 'FINANCE UPDATE';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = `Company: ${opts.companyName || '—'}`;
  ws.getCell('A3').value = `Financial year: FY${opts.year}`;
  ws.getCell('A4').value =
    `Enter plain whole numbers in ${currency}. Do NOT abbreviate to lakhs, crores or thousands.`;
  ws.getCell('A4').font = { italic: true, color: { argb: 'FFB45309' }, size: 10 };
  for (const ref of ['A2', 'A3']) ws.getCell(ref).font = { size: 10, color: { argb: 'FF52514E' } };

  // ── Column headings ──
  const headerRow = 6;
  ws.getCell(`A${headerRow}`).value = 'Metric';
  QUARTER_COLS.forEach((col, i) => {
    const cell = ws.getCell(`${col}${headerRow}`);
    cell.value = `Q${i + 1}`;
    cell.alignment = { horizontal: 'right' };
  });
  ws.getRow(headerRow).font = { bold: true };
  ws.getRow(headerRow).border = { bottom: { style: 'thin', color: { argb: 'FFD4D4D4' } } };

  // ── Input rows, grouped by section ──
  const rowOf: Partial<Record<keyof FinancialInputs, number>> = {};
  const byQuarter = new Map<Quarter, FinancialInputs>();
  for (const e of opts.existing ?? []) {
    if (e.year === opts.year) byQuarter.set(e.quarter, e);
  }

  let r = headerRow + 1;
  for (const section of SECTIONS) {
    const sc = ws.getCell(`A${r}`);
    sc.value = section.title;
    sc.font = { bold: true, size: 9, color: { argb: 'FF8A8F98' } };
    r += 1;
    for (const key of section.keys) {
      ws.getCell(`A${r}`).value = ROW_LABELS[key];
      rowOf[key] = r;
      QUARTER_COLS.forEach((col, i) => {
        const cell = ws.getCell(`${col}${r}`);
        const stored = byQuarter.get((i + 1) as Quarter)?.[key];
        if (stored !== undefined) cell.value = stored;
        cell.numFmt = '#,##0';
        // Only the number cells are unlocked, so the labels the parser relies
        // on cannot be edited away by accident.
        cell.protection = { locked: false };
      });
      r += 1;
    }
    r += 1;   // blank line between sections
  }

  // ── Calculated block — Excel formulas mirroring the app's own maths ──
  const calcStart = r;
  ws.getCell(`A${r}`).value = 'CALCULATED — do not edit';
  ws.getCell(`A${r}`).font = { bold: true, size: 9, color: { argb: 'FF2A78D6' } };
  r += 1;

  const cellRef = (key: keyof FinancialInputs, col: string) => `${col}${rowOf[key]}`;
  const calcRows: { label: string; formula: (col: string) => string; pct?: boolean }[] = [
    { label: 'Gross profit', formula: c => `${cellRef('revenue', c)}-${cellRef('cogs', c)}` },
    { label: 'Gross margin %', pct: true,
      formula: c => `IF(${cellRef('revenue', c)}=0,"",(${cellRef('revenue', c)}-${cellRef('cogs', c)})/${cellRef('revenue', c)})` },
    { label: 'Total expenses',
      formula: c => `SUM(${cellRef('cogs', c)},${cellRef('salaryExpenses', c)},${cellRef('operatingExpenses', c)},${cellRef('depreciation', c)},${cellRef('interest', c)})` },
    { label: 'EBITDA',
      formula: c => `${cellRef('revenue', c)}-${cellRef('cogs', c)}-${cellRef('salaryExpenses', c)}-${cellRef('operatingExpenses', c)}` },
    { label: 'Profit before tax',
      formula: c => `${cellRef('revenue', c)}-${cellRef('cogs', c)}-${cellRef('salaryExpenses', c)}-${cellRef('operatingExpenses', c)}-${cellRef('depreciation', c)}-${cellRef('interest', c)}` },
    { label: 'Net profit / (loss)',
      formula: c => `${cellRef('revenue', c)}-${cellRef('cogs', c)}-${cellRef('salaryExpenses', c)}-${cellRef('operatingExpenses', c)}-${cellRef('depreciation', c)}-${cellRef('interest', c)}-${cellRef('tax', c)}` },
    { label: 'Closing cash',
      formula: c => `${cellRef('openingCash', c)}+${cellRef('cashInflow', c)}-${cellRef('cashOutflow', c)}` },
    { label: 'Monthly burn',
      formula: c => `(${cellRef('cashOutflow', c)}-${cellRef('cashInflow', c)})/3` },
    { label: 'Equity',
      formula: c => `${cellRef('totalAssets', c)}-${cellRef('totalLiabilities', c)}` },
  ];

  for (const cr of calcRows) {
    ws.getCell(`A${r}`).value = cr.label;
    ws.getCell(`A${r}`).font = { color: { argb: 'FF52514E' } };
    QUARTER_COLS.forEach(col => {
      const cell = ws.getCell(`${col}${r}`);
      cell.value = { formula: cr.formula(col) };
      cell.numFmt = cr.pct ? '0.0%' : '#,##0';
      cell.font = { color: { argb: 'FF2A78D6' } };
    });
    r += 1;
  }

  // Notes row the reviewer/founder can use
  r += 1;
  ws.getCell(`A${r}`).value = 'Notes (optional)';
  ws.getCell(`A${r}`).font = { bold: true, size: 9, color: { argb: 'FF8A8F98' } };
  const notesRow = r + 1;
  ws.getCell(`A${notesRow}`).value = '';
  ws.getCell(`A${notesRow}`).protection = { locked: false };
  ws.mergeCells(`A${notesRow}:E${notesRow}`);

  // Protect the sheet so only the unlocked number cells accept input. No
  // password — this is a guard rail against accidents, not a security control.
  await ws.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    insertRows: false,
    deleteRows: false,
  });

  // ── Hidden metadata: what the parser actually reads ──
  const meta = wb.addWorksheet(META_SHEET);
  meta.state = 'veryHidden';
  meta.getCell('A1').value = 'templateVersion';
  meta.getCell('B1').value = TEMPLATE_VERSION;
  meta.getCell('A2').value = 'portfolioId';
  meta.getCell('B2').value = opts.portfolioId;
  meta.getCell('A3').value = 'year';
  meta.getCell('B3').value = opts.year;
  meta.getCell('A4').value = 'dataSheet';
  meta.getCell('B4').value = DATA_SHEET;
  meta.getCell('A5').value = 'notesRow';
  meta.getCell('B5').value = notesRow;
  meta.getCell('A6').value = 'calcStart';
  meta.getCell('B6').value = calcStart;
  meta.getCell('A8').value = 'fieldKey';
  meta.getCell('B8').value = 'row';
  let mr = 9;
  for (const key of INPUT_KEYS) {
    meta.getCell(`A${mr}`).value = key;
    meta.getCell(`B${mr}`).value = rowOf[key] ?? '';
    mr += 1;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function templateFileName(companyName: string, year: number): string {
  const safe = (companyName || 'company').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `finance-update-${safe}-FY${year}.xlsx`;
}

/** Hands the workbook to the browser as a download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─── Reading it back ─────────────────────────────────────────────────────────

export interface ParsedQuarter {
  quarter: Quarter;
  inputs: FinancialInputs;
  /** How many of the 14 fields carried a value. */
  filled: number;
}

export interface ParseResult {
  year: number | null;
  portfolioId: string | null;
  templateVersion: number | null;
  quarters: ParsedQuarter[];
  notes: string;
  /** Non-fatal problems worth showing the user before they confirm. */
  warnings: string[];
  /** True when the hidden metadata was found — i.e. this is our template. */
  recognised: boolean;
}

/** Coerces a spreadsheet cell into a number, or undefined when it is blank. */
function toNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  // A formula cell arrives as { formula, result }
  if (typeof raw === 'object') {
    const r = raw as { result?: unknown; richText?: { text: string }[] };
    if (r.result !== undefined) return toNumber(r.result);
    if (Array.isArray(r.richText)) return toNumber(r.richText.map(t => t.text).join(''));
    return undefined;
  }
  const s = String(raw).trim();
  if (!s) return undefined;
  // Accounting convention: (1,234) means negative.
  const negative = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[(),\s₹$€£]/g, '').replace(/[A-Za-z]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return undefined;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return undefined;
  return negative ? -Math.abs(n) : n;
}

function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object') {
    const r = raw as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (Array.isArray(r.richText)) return r.richText.map(t => t.text).join('');
    if (r.text) return String(r.text);
    if (r.result !== undefined) return String(r.result);
    return '';
  }
  return String(raw);
}

/** Normalises a label for the fallback match. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '');
}

const LABEL_LOOKUP: Record<string, keyof FinancialInputs> = (() => {
  const out: Record<string, keyof FinancialInputs> = {};
  for (const key of INPUT_KEYS) {
    out[norm(ROW_LABELS[key])] = key;
    out[norm(key)] = key;
  }
  // A few things founders commonly write instead.
  const extra: Record<string, keyof FinancialInputs> = {
    sales: 'revenue', totalrevenue: 'revenue', turnover: 'revenue',
    costofgoodssold: 'cogs', costofsales: 'cogs', directcosts: 'cogs',
    salaries: 'salaryExpenses', salariesandwages: 'salaryExpenses',
    payroll: 'salaryExpenses', employeecost: 'salaryExpenses',
    personnelexpenses: 'salaryExpenses',
    opex: 'operatingExpenses', operatingexpense: 'operatingExpenses',
    adminexpenses: 'operatingExpenses',
    depreciation: 'depreciation', depreciationamortisation: 'depreciation',
    da: 'depreciation',
    interestexpense: 'interest', financecost: 'interest',
    incometax: 'tax', taxexpense: 'tax',
    receipts: 'cashInflow', cashreceipts: 'cashInflow',
    payments: 'cashOutflow', cashpayments: 'cashOutflow',
    openingbalance: 'openingCash', openingcashbalance: 'openingCash',
    receivables: 'accountsReceivable', debtors: 'accountsReceivable',
    payables: 'accountsPayable', creditors: 'accountsPayable',
    assets: 'totalAssets', liabilities: 'totalLiabilities',
  };
  for (const [k, v] of Object.entries(extra)) out[norm(k)] = v;
  return out;
})();

/**
 * Reads a filled-in template back into quarters.
 *
 * Never throws for content problems — a caller gets warnings and whatever
 * could be read, so the user sees what was understood and confirms it rather
 * than being handed an error.
 */
export async function parseTemplateWorkbook(file: File | ArrayBuffer): Promise<ParseResult> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  await wb.xlsx.load(buffer);

  const warnings: string[] = [];
  const meta = wb.getWorksheet(META_SHEET);

  let year: number | null = null;
  let portfolioId: string | null = null;
  let templateVersion: number | null = null;
  let notesRow: number | null = null;
  let rowOf: Partial<Record<keyof FinancialInputs, number>> = {};
  let dataSheetName = DATA_SHEET;

  if (meta) {
    const read = (label: string): unknown => {
      for (let i = 1; i <= 8; i++) {
        if (cellText(meta.getCell(`A${i}`).value).trim() === label) {
          return meta.getCell(`B${i}`).value;
        }
      }
      return undefined;
    };
    templateVersion = toNumber(read('templateVersion')) ?? null;
    portfolioId = cellText(read('portfolioId')).trim() || null;
    year = toNumber(read('year')) ?? null;
    notesRow = toNumber(read('notesRow')) ?? null;
    const ds = cellText(read('dataSheet')).trim();
    if (ds) dataSheetName = ds;

    for (let i = 9; i <= 40; i++) {
      const key = cellText(meta.getCell(`A${i}`).value).trim() as keyof FinancialInputs;
      const row = toNumber(meta.getCell(`B${i}`).value);
      if (key && row && (INPUT_KEYS as string[]).includes(key)) rowOf[key] = row;
    }
    if (templateVersion !== null && templateVersion > TEMPLATE_VERSION) {
      warnings.push(
        `This file was made by a newer template (v${templateVersion}). Some rows may not be read correctly.`,
      );
    }
  }

  const ws = wb.getWorksheet(dataSheetName)
    ?? wb.worksheets.find(s => s.name !== META_SHEET)
    ?? null;
  if (!ws) {
    return {
      year, portfolioId, templateVersion, quarters: [], notes: '',
      warnings: ['That file has no readable sheet.'], recognised: false,
    };
  }

  const recognised = !!meta && Object.keys(rowOf).length > 0;

  // Fallback: no hidden metadata, so find the rows by their labels instead.
  if (!recognised) {
    warnings.push(
      'This is not a downloaded Finance Update template, so rows were matched by name. Check every figure before saving.',
    );
    const found: Partial<Record<keyof FinancialInputs, number>> = {};
    ws.eachRow((row, rowNumber) => {
      const label = norm(cellText(row.getCell(1).value));
      if (!label) return;
      const key = LABEL_LOOKUP[label];
      if (key && found[key] === undefined) found[key] = rowNumber;
    });
    rowOf = found;
    const missing = INPUT_KEYS.filter(k => rowOf[k] === undefined);
    if (missing.length) {
      warnings.push(`${missing.length} of ${INPUT_KEYS.length} rows could not be matched and were left blank.`);
    }
  }

  // ── Read the quarter columns ──
  const quarters: ParsedQuarter[] = [];
  QUARTER_COLS.forEach((col, i) => {
    const inputs: FinancialInputs = {};
    let filled = 0;
    for (const key of INPUT_KEYS) {
      const row = rowOf[key];
      if (!row) continue;
      const v = toNumber(ws.getCell(`${col}${row}`).value);
      if (v !== undefined) { inputs[key] = v; filled += 1; }
    }
    if (filled > 0) quarters.push({ quarter: (i + 1) as Quarter, inputs, filled });
  });

  if (!quarters.length) {
    warnings.push('No figures were found in the Q1–Q4 columns.');
  }

  const notes = notesRow ? cellText(ws.getCell(`A${notesRow}`).value).trim() : '';

  return { year, portfolioId, templateVersion, quarters, notes, warnings, recognised };
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export interface ReconcileIssue {
  quarter: Quarter;
  message: string;
}

/**
 * Sanity-checks what was read. A spreadsheet cannot be checked against printed
 * subtotals the way a statement can, so these are the internal consistency
 * checks that catch the mistakes that actually happen: a figure entered in the
 * wrong row, or a units slip.
 */
export function reconcile(quarters: ParsedQuarter[]): ReconcileIssue[] {
  const issues: ReconcileIssue[] = [];
  for (const q of quarters) {
    const v = q.inputs;
    if (v.revenue !== undefined && v.cogs !== undefined && v.cogs > v.revenue) {
      issues.push({ quarter: q.quarter, message: 'COGS is higher than revenue — check the rows are not swapped.' });
    }
    if (v.totalAssets !== undefined && v.totalLiabilities !== undefined
        && v.totalLiabilities > v.totalAssets) {
      issues.push({ quarter: q.quarter, message: 'Liabilities exceed assets, so equity is negative. Confirm this is right.' });
    }
    if (v.openingCash !== undefined && v.cashInflow !== undefined && v.cashOutflow !== undefined) {
      const closing = v.openingCash + v.cashInflow - v.cashOutflow;
      if (closing < 0) {
        issues.push({ quarter: q.quarter, message: 'Closing cash works out negative — check the cash figures.' });
      }
    }
    for (const key of INPUT_KEYS) {
      const val = v[key];
      if (val !== undefined && Math.abs(val) > 0 && Math.abs(val) < 100) {
        issues.push({
          quarter: q.quarter,
          message: `${ROW_LABELS[key]} is ${val} — if that is in lakhs or thousands, enter the full amount instead.`,
        });
        break;   // one units warning per quarter is enough
      }
    }
  }
  return issues;
}

/** Pure helpers for the Portfolio Management page: display formatting, allocation grouping, CSV export. */

export function formatMoney(n: number | null): string {
  if (n === null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatPercent(n: number | null, digits = 1): string {
  return n === null ? '—' : `${n.toFixed(digits)}%`;
}

export function formatNumber(n: number | null, digits = 0): string {
  return n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

/** 'YYYY-MM-DD' (or an ISO timestamp) -> 'Nov 12, 2026'. Blank/invalid -> '—'. */
export function formatDate(iso: string, locale = 'en-US'): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface Slice {
  label: string;
  invested: number;
  count: number;
  /** 0–1 share of the total, by amount invested (by company count when nothing has an amount). */
  share: number;
}

/**
 * Groups entries by `keyOf` for the allocation charts. Weighted by amount
 * invested; if no entry has an amount, weighted by number of companies so the
 * chart is never empty for a portfolio that exists. A blank key becomes
 * `unspecifiedLabel` rather than disappearing, so shares always sum to 1.
 */
export function allocate<T extends { totalInvested: number | null }>(
  entries: T[],
  keyOf: (e: T) => string,
  unspecifiedLabel: string,
): Slice[] {
  const groups = new Map<string, { invested: number; count: number }>();
  for (const e of entries) {
    const key = keyOf(e).trim() || unspecifiedLabel;
    const g = groups.get(key) ?? { invested: 0, count: 0 };
    g.invested += e.totalInvested ?? 0;
    g.count += 1;
    groups.set(key, g);
  }
  const totalInvested = [...groups.values()].reduce((s, g) => s + g.invested, 0);
  const totalCount = entries.length;
  const slices = [...groups.entries()].map(([label, g]) => ({
    label,
    invested: g.invested,
    count: g.count,
    share: totalInvested > 0 ? g.invested / totalInvested : totalCount > 0 ? g.count / totalCount : 0,
  }));
  return slices.sort((a, b) => b.share - a.share || b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * One CSV cell. Quotes anything containing a delimiter, quote or newline, and
 * neutralises values a spreadsheet would run as a formula (a leading = + - @)
 * — company names and notes are free text, and an export is opened in Excel.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}

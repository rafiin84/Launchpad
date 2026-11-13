import type { TranslationKeys } from '../../i18n';
import { formatAmount } from '../../lib/investmentCalc';
import type { MetricDef, MetricKey } from '../../lib/financeReports';

export type FinText = TranslationKeys['finance'];

const LABELS: Record<MetricKey, keyof FinText> = {
  revenue: 'metricRevenue', mrr: 'metricMrr', arr: 'metricArr', expenses: 'metricExpenses', netProfit: 'metricNetProfit',
  cash: 'metricCash', burn: 'metricBurn', runway: 'metricRunway', customers: 'metricCustomers', mom: 'metricMom',
  yoy: 'metricYoy', employees: 'metricEmployees',
};
const HINTS: Record<MetricKey, keyof FinText> = {
  revenue: 'hintRevenue', mrr: 'hintMrr', arr: 'hintArr', expenses: 'hintExpenses', netProfit: 'hintNetProfit',
  cash: 'hintCash', burn: 'hintBurn', runway: 'hintRunway', customers: 'hintCustomers', mom: 'hintMom',
  yoy: 'hintYoy', employees: 'hintEmployees',
};

export const metricLabel = (t: FinText, k: MetricKey): string => t[LABELS[k]] as string;
export const metricHint = (t: FinText, k: MetricKey): string => t[HINTS[k]] as string;

/** A metric value in the report's own currency (money), or as a count / percent / months. */
export function formatMetric(t: FinText, def: MetricDef, value: number | null, currency: string, locale: string): string {
  if (value === null) return '—';
  switch (def.kind) {
    case 'money': return formatAmount(value, currency, locale);
    case 'percent': return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
    case 'months': return t.months.replace('{n}', value.toLocaleString(locale, { maximumFractionDigits: 1 }));
    default: return value.toLocaleString(locale);
  }
}

import type { TranslationKeys } from '../../i18n';
import type { HealthStatus } from '../../lib/portfolioHealth';
import { formatMoney, formatNumber, formatPercent } from '../../lib/portfolioFormat';

export type PMText = TranslationKeys['portfolioManagement'];

export function healthLabel(t: PMText, status: HealthStatus): string {
  switch (status) {
    case 'on_track': return t.healthOnTrack;
    case 'needs_attention': return t.healthNeedsAttention;
    case 'at_risk': return t.healthAtRisk;
    default: return t.healthDataUnavailable;
  }
}

/** The rule picklist stores English metric names; show them in the active language. */
export function metricLabel(t: PMText, metric: string): string {
  switch (metric) {
    case 'Runway Months': return t.metricRunway;
    case 'Revenue Growth Percentage': return t.metricRevenueGrowth;
    case 'Monthly Burn Rate': return t.metricBurn;
    case 'Days Since Last Update': return t.metricDaysSinceUpdate;
    case 'Headcount Change': return t.metricHeadcountChange;
    default: return metric;
  }
}

export function metricValueText(t: PMText, metric: string, value: number): string {
  switch (metric) {
    case 'Runway Months': return t.months.replace('{n}', formatNumber(value, 1));
    case 'Revenue Growth Percentage': return formatPercent(value);
    case 'Monthly Burn Rate': return formatMoney(value);
    case 'Days Since Last Update': return t.days.replace('{n}', formatNumber(value));
    default: return formatNumber(value, 2);
  }
}


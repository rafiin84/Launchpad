import type { TranslationKeys } from '../../i18n';
import type { Exclusion, Report } from '../../lib/reportAnalytics';
import { formatAmount, formatAmountFull } from '../../lib/investmentCalc';

export type RepText = TranslationKeys['reports'];

/** One sentence per exclusion, in the active language. */
export function exclusionMessage(t: RepText, e: Exclusion): string {
  const n = String(e.count);
  switch (e.kind) {
    case 'cancelled': return t.exCancelled.replace('{n}', n);
    case 'otherCurrency': return t.exOtherCurrency.replace('{n}', n);
    case 'missingRate': return t.exMissingRate.replace('{currencies}', e.detail ?? '');
    case 'noDate': return t.exNoDate.replace('{n}', n);
    case 'noCurrency': return t.exNoCurrency.replace('{n}', n);
    case 'noLedger': return t.exNoLedger.replace('{n}', n);
    case 'noCommitmentDate': return t.exNoCommitmentDate.replace('{n}', n);
    case 'valuationAfter': return t.exValuationAfter.replace('{n}', n);
    case 'noValuation': return t.exNoValuation.replace('{n}', n);
    case 'noReturnData': return t.exNoReturnData.replace('{n}', n);
    case 'noPerformance': return t.exNoPerformance.replace('{n}', n);
    case 'noValuationHistory': return t.exNoValuationHistory.replace('{n}', n);
    case 'pmUnavailable': return t.exPmUnavailable;
  }
}

/** How a report states its currency conversion — the policy, date and every rate used. */
export function conversionLine(t: RepText, report: Report): string {
  if (report.conversion.policy === 'report_date' && report.conversion.used.length > 0) {
    const rates = report.conversion.used
      .map(u => t.conversionRateItem.replace('{from}', u.currency).replace('{rate}', String(u.rate)).replace('{to}', report.currency))
      .join('; ');
    return t.conversionApplied.replace('{currency}', report.currency).replace('{date}', report.conversion.rateDate).replace('{rates}', rates);
  }
  return t.conversionNone.replace('{currency}', report.currency || '—');
}

export function dataAsOfText(t: RepText, report: Report, locale: string): string {
  const time = new Date(report.asOf).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return t.dataAsOf.replace('{time}', time);
}

export function periodText(t: RepText, report: Report): string {
  return report.periodStart
    ? t.periodRange.replace('{start}', report.periodStart).replace('{end}', report.periodEnd)
    : t.periodThrough.replace('{end}', report.periodEnd);
}

export const moneyOf = (report: Report, locale: string) => (n: number | null) => formatAmount(n, report.currency, locale);
export const moneyFullOf = (report: Report, locale: string) => (n: number | null) => formatAmountFull(n, report.currency, locale);
/** Portfolio Management stores no currency, so its figures get no symbol and no conversion. */
export const plainNumber = (n: number | null, locale: string) =>
  n === null ? '—' : new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }).format(n);

import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { Loader2, RefreshCw } from 'lucide-react';
import { ROUND_ORDER } from '../../lib/investmentCalc';
import type { ConversionPolicy, ReportFilters } from '../../lib/reportAnalytics';
import type { RepText } from './reportText';

export interface FilterOptions {
  funds: string[];
  companies: Array<{ id: string; name: string }>;
  sectors: string[];
  currencies: string[];
}

export default function ReportFiltersPanel({
  draft, onChange, options, reportCurrency, currenciesInScope, generating, onGenerate, t,
}: {
  draft: ReportFilters;
  onChange: (next: ReportFilters) => void;
  options: FilterOptions;
  /** The currency the current report is in — other currencies in scope need a rate. */
  reportCurrency: string;
  currenciesInScope: string[];
  generating: boolean;
  onGenerate: () => void;
  t: RepText;
}) {
  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => onChange({ ...draft, [key]: value });
  const target = draft.currency || reportCurrency;
  const needRates = draft.policy === 'report_date' ? currenciesInScope.filter(c => c !== target) : [];

  return (
    <form onSubmit={e => { e.preventDefault(); onGenerate(); }} aria-label={t.filtersTitle}
      className="bg-white border border-gray-100 rounded-2xl p-4 report-print-hide">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Input label={t.filterPeriodStart} type="date" value={draft.periodStart} onChange={e => set('periodStart', e.target.value)} />
        <Input label={t.filterPeriodEnd} type="date" value={draft.periodEnd} onChange={e => set('periodEnd', e.target.value)} />
        <Select label={t.filterFund} value={draft.fund} onChange={e => set('fund', e.target.value)}
          options={options.funds.map(v => ({ value: v, label: v }))} placeholder={t.filterAll} />
        <Select label={t.filterCompany} value={draft.companyId} onChange={e => set('companyId', e.target.value)}
          options={options.companies.map(c => ({ value: c.id, label: c.name }))} placeholder={t.filterAll} />
        <Select label={t.filterSector} value={draft.sector} onChange={e => set('sector', e.target.value)}
          options={options.sectors.map(v => ({ value: v, label: v }))} placeholder={t.filterAll} />
        <Select label={t.filterStage} value={draft.stage} onChange={e => set('stage', e.target.value)}
          options={ROUND_ORDER.map(v => ({ value: v, label: v }))} placeholder={t.filterAll} />
        <Select label={t.filterCurrency} value={draft.currency} onChange={e => set('currency', e.target.value)}
          options={options.currencies.map(v => ({ value: v, label: v }))} placeholder={t.filterAuto} />
        <Select label={t.filterPolicy} value={draft.policy} onChange={e => set('policy', e.target.value as ConversionPolicy)}
          options={[{ value: 'none', label: t.policyNone }, { value: 'report_date', label: t.policyReportDate }]} />
      </div>

      {draft.policy === 'report_date' && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Input label={`${t.filterRateDate} *`} type="date" value={draft.rateDate} onChange={e => set('rateDate', e.target.value)} />
            </div>
            {needRates.map(c => (
              <Input key={c} label={`${t.rateLabel.replace('{from}', c)} (${target || '—'})`} type="number" step="any" min="0"
                value={draft.rates[c] ?? ''}
                onChange={e => {
                  const rates = { ...draft.rates };
                  const n = Number(e.target.value);
                  if (e.target.value === '' || !Number.isFinite(n) || n <= 0) delete rates[c]; else rates[c] = n;
                  onChange({ ...draft, rates });
                }} />
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            {t.rateHelp}{needRates.length > 0 && !draft.rateDate && ` ${t.ratesNeedDate}`}
          </p>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button type="submit" variant="primary" disabled={generating}>
          {generating ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <RefreshCw size={14} className="mr-1.5" />}
          {generating ? t.generating : t.generate}
        </Button>
      </div>
    </form>
  );
}

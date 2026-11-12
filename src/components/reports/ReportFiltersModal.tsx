import { useState } from 'react';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { ModalFrame } from '../portfolio/portfolioUi';
import { ROUND_ORDER } from '../../lib/investmentCalc';
import { emptyFilters, type ConversionPolicy, type ReportFilters } from '../../lib/reportAnalytics';
import type { RepText } from './reportText';

export interface FilterOptions {
  funds: string[];
  companies: Array<{ id: string; name: string }>;
  sectors: string[];
  currencies: string[];
}

/**
 * The report filters, in a popup. Edits are held locally and only take effect
 * when the user generates the report, so closing the popup discards them.
 */
export default function ReportFiltersModal({
  initial, options, reportCurrency, currenciesInScope, generating, onGenerate, onClose, t,
}: {
  initial: ReportFilters;
  options: FilterOptions;
  /** The currency the current report is in — other currencies in scope need a rate. */
  reportCurrency: string;
  currenciesInScope: string[];
  generating: boolean;
  onGenerate: (filters: ReportFilters) => void;
  onClose: () => void;
  t: RepText;
}) {
  const [draft, setDraft] = useState<ReportFilters>(initial);
  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => setDraft(d => ({ ...d, [key]: value }));
  const target = draft.currency || reportCurrency;
  const needRates = draft.policy === 'report_date' ? currenciesInScope.filter(c => c !== target) : [];

  return (
    <ModalFrame
      title={t.filtersTitle}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setDraft(emptyFilters())} disabled={generating}>{t.filtersReset}</Button>
          <Button type="submit" form="rep-filters-form" variant="primary" disabled={generating}>
            {generating ? t.generating : t.generate}
          </Button>
        </>
      }
    >
      <form id="rep-filters-form" aria-label={t.filtersTitle} onSubmit={e => { e.preventDefault(); onGenerate(draft); }}
        className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={`${t.filterRateDate} *`} type="date" value={draft.rateDate} onChange={e => set('rateDate', e.target.value)} />
              {needRates.map(c => (
                <Input key={c} label={`${t.rateLabel.replace('{from}', c)} (${target || '—'})`} type="number" step="any" min="0"
                  value={draft.rates[c] ?? ''}
                  onChange={e => {
                    const rates = { ...draft.rates };
                    const n = Number(e.target.value);
                    if (e.target.value === '' || !Number.isFinite(n) || n <= 0) delete rates[c]; else rates[c] = n;
                    setDraft(d => ({ ...d, rates }));
                  }} />
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              {t.rateHelp}{needRates.length > 0 && !draft.rateDate && ` ${t.ratesNeedDate}`}
            </p>
          </div>
        )}
      </form>
    </ModalFrame>
  );
}

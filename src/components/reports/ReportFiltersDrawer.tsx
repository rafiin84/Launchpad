import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
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
 * The report filters, in a panel that slides in from the right. Edits are held
 * locally and only take effect when the user generates the report; closing the
 * panel discards them.
 */
export default function ReportFiltersDrawer({
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 report-print-hide">
      <style>{'@keyframes rep-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}'}</style>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label={t.filtersTitle}
        className="absolute inset-y-0 right-0 w-full sm:w-[24rem] bg-white shadow-2xl flex flex-col"
        style={{ animation: 'rep-slide-in 220ms cubic-bezier(0.32, 0.72, 0, 1)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{t.filtersTitle}</h2>
          <button onClick={onClose} aria-label={t.close} className="text-gray-400 hover:text-gray-700 p-1"><X size={18} /></button>
        </div>

        <form id="rep-filters-form" aria-label={t.filtersTitle} onSubmit={e => { e.preventDefault(); onGenerate(draft); }}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label={t.filterPeriodStart} type="date" value={draft.periodStart} onChange={e => set('periodStart', e.target.value)} />
            <Input label={t.filterPeriodEnd} type="date" value={draft.periodEnd} onChange={e => set('periodEnd', e.target.value)} />
          </div>
          <Select label={t.filterFund} value={draft.fund} onChange={e => set('fund', e.target.value)}
            options={options.funds.map(v => ({ value: v, label: v }))} placeholder={t.filterAll} />
          <Select label={t.filterCompany} value={draft.companyId} onChange={e => set('companyId', e.target.value)}
            options={options.companies.map(c => ({ value: c.id, label: c.name }))} placeholder={t.filterAll} />
          <div className="grid grid-cols-2 gap-3">
            <Select label={t.filterSector} value={draft.sector} onChange={e => set('sector', e.target.value)}
              options={options.sectors.map(v => ({ value: v, label: v }))} placeholder={t.filterAll} />
            <Select label={t.filterStage} value={draft.stage} onChange={e => set('stage', e.target.value)}
              options={ROUND_ORDER.map(v => ({ value: v, label: v }))} placeholder={t.filterAll} />
          </div>
          <Select label={t.filterCurrency} value={draft.currency} onChange={e => set('currency', e.target.value)}
            options={options.currencies.map(v => ({ value: v, label: v }))} placeholder={t.filterAuto} />
          <Select label={t.filterPolicy} value={draft.policy} onChange={e => set('policy', e.target.value as ConversionPolicy)}
            options={[{ value: 'none', label: t.policyNone }, { value: 'report_date', label: t.policyReportDate }]} />

          {draft.policy === 'report_date' && (
            <div className="pt-4 border-t border-gray-100 space-y-4">
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
              <p className="text-[11px] text-gray-400">
                {t.rateHelp}{needRates.length > 0 && !draft.rateDate && ` ${t.ratesNeedDate}`}
              </p>
            </div>
          )}
        </form>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setDraft(emptyFilters())} disabled={generating}>{t.filtersReset}</Button>
          <Button type="submit" form="rep-filters-form" variant="primary" className="flex-[2]" disabled={generating}>
            {generating ? t.generating : t.generate}
          </Button>
        </div>
      </aside>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Input, Select, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import { ModalFrame } from '../portfolio/portfolioUi';
import {
  METRICS, emptyMetricInput, groupByPeriod, latestPerPeriod, metricInputFrom, nextVersion, periodBounds,
  periodKey, periodLabel, periodsPerYear, suggestGrowth, suggestNetProfit, toMetrics, validateMetrics, STATUS,
  type FinanceReport, type Frequency, type Metrics, type MetricErrors, type MetricInput, type MetricKey,
} from '../../lib/financeReports';
import { formatMetric, metricHint, metricLabel, type FinText } from './financeText';

export interface SubmitValues {
  frequency: Frequency; year: number; number: number; currency: string; metrics: Metrics; notes: string;
}

export default function FinanceSubmitModal({
  frequencies, currencies, existing, initial, today, locale, saving, error, t, onSave, onClose,
}: {
  frequencies: Frequency[];
  currencies: string[];
  /** Every report this founder has, all versions — used to prefill and to number the new version. */
  existing: FinanceReport[];
  initial: { frequency: Frequency; year: number; number: number };
  today: string;
  locale: string;
  saving: boolean;
  error: string;
  t: FinText;
  onSave: (values: SubmitValues, asDraft: boolean) => void;
  onClose: () => void;
}) {
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency);
  const [year, setYear] = useState(initial.year);
  const [number, setNumber] = useState(initial.number);
  const [currency, setCurrency] = useState(() => existing[0]?.currency || currencies[0] || '');
  const [metrics, setMetrics] = useState<MetricInput>(() => prefill(existing, initial.frequency, initial.year, initial.number));
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<MetricErrors>({});
  const [periodError, setPeriodError] = useState(false);

  const thisYear = Number(today.slice(0, 4));
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => thisYear - i), [thisYear]);
  const versions = useMemo(() => groupByPeriod(existing).get(periodKey({ frequency, year, number })) ?? [], [existing, frequency, year, number]);
  const sent = versions.filter(v => v.status !== STATUS.draft);
  const latest = useMemo(() => latestPerPeriod(existing), [existing]);

  function repick(f: Frequency, y: number, n: number) {
    setFrequency(f); setYear(y); setNumber(n); setPeriodError(false);
    setMetrics(prefill(existing, f, y, n)); setErrors({});
  }
  const set = (key: MetricKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setMetrics(m => ({ ...m, [key]: e.target.value }));
    if (errors[key]) setErrors(er => ({ ...er, [key]: undefined }));
  };

  const parsed = toMetrics(metrics);
  const netSuggestion = suggestNetProfit(parsed.revenue, parsed.expenses);
  const growth = suggestGrowth(latest, frequency, year, number, parsed.revenue);
  const growthFor = (k: MetricKey): number | null => (k === 'mom' ? growth.mom : k === 'yoy' ? growth.yoy : null);

  function submit(asDraft: boolean) {
    if (!asDraft) {
      const next = validateMetrics(metrics);
      setErrors(next);
      if (periodBounds(frequency, year, number).start > today) { setPeriodError(true); return; }
      if (Object.keys(next).length > 0) return;
    } else {
      // A draft may be incomplete, but whatever is entered must still be a number.
      const next = Object.fromEntries(Object.entries(validateMetrics(metrics)).filter(([, v]) => v !== 'required')) as MetricErrors;
      setErrors(next);
      if (Object.keys(next).length > 0) return;
    }
    onSave({ frequency, year, number, currency, metrics: toMetrics(metrics), notes }, asDraft);
  }

  const errText = (e?: string) => (e === 'required' ? t.errRequired : e === 'number' ? t.errNumber : e === 'negative' ? t.errNegative : undefined);
  const periodChoices = Array.from({ length: periodsPerYear(frequency) }, (_, i) => i + 1);

  return (
    <ModalFrame
      title={t.formTitle}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button type="button" variant="outline" onClick={() => submit(true)} disabled={saving}>{t.saveDraft}</Button>
          <Button type="button" variant="primary" onClick={() => submit(false)} disabled={saving}>{saving ? t.saving : t.submit}</Button>
        </>
      }
    >
      <form onSubmit={e => { e.preventDefault(); submit(false); }} noValidate className="space-y-4">
        <p className="text-xs text-gray-400">{t.requiredNote}</p>
        {error && <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select label={`${t.formFrequency} *`} value={frequency} onChange={e => repick(e.target.value as Frequency, year, 1)}
            options={frequencies.map(f => ({ value: f, label: f }))} />
          <Select label={`${t.formYear} *`} value={String(year)} onChange={e => repick(frequency, Number(e.target.value), number)}
            options={years.map(y => ({ value: String(y), label: String(y) }))} />
          {frequency !== 'Yearly' && (
            <Select label={`${t.formPeriod} *`} value={String(number)} onChange={e => repick(frequency, year, Number(e.target.value))}
              options={periodChoices.map(n => ({ value: String(n), label: periodLabel(frequency, year, n, locale) }))} />
          )}
          <Select label={`${t.formCurrency} *`} value={currency} onChange={e => setCurrency(e.target.value)}
            options={currencies.map(c => ({ value: c, label: c }))} />
        </div>
        {periodError && <p className="text-xs text-red-600">{t.errFuturePeriod}</p>}
        {sent.length > 0 && <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{t.willBeVersion.replace('{n}', String(nextVersion(versions)))}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {METRICS.map(def => {
            const label = `${metricLabel(t, def.key)}${def.required ? ' *' : ''}`;
            return (
              <div key={def.key}>
                <Input label={label} type="number" step="any" inputMode="decimal" value={metrics[def.key]} onChange={set(def.key)} error={errText(errors[def.key])} />
                <p className="mt-1 text-[11px] text-gray-400">{metricHint(t, def.key)}</p>
                {def.key === 'netProfit' && netSuggestion !== null && metrics.netProfit.trim() === '' && (
                  <button type="button" className="mt-0.5 text-[11px] text-indigo-500 hover:underline"
                    onClick={() => setMetrics(m => ({ ...m, netProfit: String(netSuggestion) }))}>
                    {t.calcNet.replace('{value}', formatMetric(t, def, netSuggestion, currency, locale))} · {t.useValue}
                  </button>
                )}
                {growthFor(def.key) !== null && metrics[def.key].trim() === '' && (
                  <button type="button" className="mt-0.5 text-[11px] text-indigo-500 hover:underline"
                    onClick={() => setMetrics(m => ({ ...m, [def.key]: String(Math.round((growthFor(def.key) as number) * 100) / 100) }))}>
                    {t.calcGrowth.replace('{value}', formatMetric(t, def, growthFor(def.key), currency, locale))} · {t.useValue}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <Textarea label={t.formNotes} value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </form>
    </ModalFrame>
  );
}

/** Start a correction from the newest version of that period (or a draft), else blank. */
function prefill(existing: FinanceReport[], f: Frequency, year: number, number: number): MetricInput {
  const v = groupByPeriod(existing).get(periodKey({ frequency: f, year, number }))?.[0];
  return v ? metricInputFrom(v) : emptyMetricInput();
}


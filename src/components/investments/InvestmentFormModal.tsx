import { useMemo, useState } from 'react';
import { Input, Select, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  CURRENCIES, INSTRUMENTS, ROUNDS, TX_STATUSES, type InvestmentInput,
} from '../../services/crmInvestments';
import type { CRMPortfolioRecord } from '../../services/crmPortfolio';
import { ModalFrame } from '../portfolio/portfolioUi';
import { statusLabel, type InvText } from './investmentText';

type Errors = Partial<Record<keyof InvestmentInput, string>>;

const NUMBER_FIELDS: Array<keyof InvestmentInput> = [
  'proposedAmount', 'committedAmount', 'preMoney', 'postMoney', 'pricePerShare', 'sharesAcquired',
  'fullyDilutedShares', 'recordedOwnershipPct', 'holdingValue',
];

/**
 * An amount and the date it applies to travel together: the business rule is a
 * currency AND a date on every amount, so entering one without the other is an error.
 */
const AMOUNT_DATE_PAIRS: Array<[keyof InvestmentInput, keyof InvestmentInput]> = [
  ['proposedAmount', 'proposedDate'],
  ['committedAmount', 'commitmentDate'],
  ['holdingValue', 'holdingValueAsOf'],
  ['preMoney', 'valuationDate'],
  ['postMoney', 'valuationDate'],
];

export default function InvestmentFormModal({
  mode, initial, companies, saving, error, t, onSave, onClose,
}: {
  mode: 'add' | 'edit';
  initial: InvestmentInput;
  companies: CRMPortfolioRecord[];
  saving: boolean;
  error: string;
  t: InvText;
  onSave: (input: InvestmentInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<InvestmentInput>(initial);
  const [errors, setErrors] = useState<Errors>({});

  const set = (key: keyof InvestmentInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }));
      if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

  const companyOptions = useMemo(
    () => companies.map(c => ({ value: c.id, label: c.companyName || '—' })),
    [companies],
  );

  function pickCompany(id: string) {
    const c = companies.find(x => x.id === id);
    setErrors(prev => ({ ...prev, companyId: undefined }));
    setForm(prev => ({ ...prev, companyId: c?.id ?? '', companyName: c?.companyName ?? '' }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (mode === 'add' && !form.companyId) next.companyId = t.errCompany;
    for (const k of ['reference', 'status', 'currency'] as const) if (!form[k].trim()) next[k] = t.errRequired;
    for (const k of NUMBER_FIELDS) {
      const v = form[k] as string;
      if (v.trim() !== '' && !Number.isFinite(Number(v))) next[k] = t.errNumber;
    }
    for (const k of ['proposedAmount', 'committedAmount', 'holdingValue', 'preMoney', 'postMoney', 'pricePerShare', 'sharesAcquired'] as const) {
      const v = form[k];
      if (!next[k] && v.trim() !== '' && Number(v) < 0) next[k] = t.errNumber;
    }
    // Every amount needs its date, and every date its amount.
    for (const [amountKey, dateKey] of AMOUNT_DATE_PAIRS) {
      const hasAmount = (form[amountKey] as string).trim() !== '';
      const hasDate = (form[dateKey] as string).trim() !== '';
      if (hasAmount && !hasDate && !next[dateKey]) next[dateKey] = t.errDateNeeded;
    }
    for (const [amountKey, dateKey] of [['proposedAmount', 'proposedDate'], ['committedAmount', 'commitmentDate'], ['holdingValue', 'holdingValueAsOf']] as const) {
      if ((form[dateKey] as string).trim() !== '' && (form[amountKey] as string).trim() === '' && !next[amountKey]) next[amountKey] = t.errAmountNeeded;
    }
    if ((form.status === 'Funded' || form.status === 'Partially Funded') && !form.investmentDate.trim()) next.investmentDate = t.errRequired;
    // Capitalization: approved share data is what ownership is calculated from.
    const fd = form.fullyDilutedShares.trim();
    if (!next.fullyDilutedShares && fd !== '' && Number(fd) <= 0) next.fullyDilutedShares = t.errFullyDiluted;
    const sh = form.sharesAcquired.trim();
    if (!next.sharesAcquired && !next.fullyDilutedShares && sh !== '' && fd !== '' && Number(sh) > Number(fd)) next.sharesAcquired = t.errShares;
    const own = form.recordedOwnershipPct.trim();
    if (!next.recordedOwnershipPct && own !== '' && (Number(own) < 0 || Number(own) > 100)) next.recordedOwnershipPct = t.errPercent;
    const hasCapData = [form.sharesAcquired, form.fullyDilutedShares, form.recordedOwnershipPct].some(v => v.trim() !== '');
    if ((form.capTableApproved || hasCapData) && !form.capTableAsOf.trim()) next.capTableAsOf = t.errDateNeeded;
    setErrors(next);
    if (Object.keys(next).length === 0) onSave(form);
  }

  const title = mode === 'add' ? t.formAddTitle : t.formEditTitle.replace('{name}', initial.reference);
  const section = (label: string) => <h3 className="col-span-full text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">{label}</h3>;
  const cur = form.currency && form.currency !== 'Other' ? ` (${form.currency})` : '';

  return (
    <ModalFrame
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button type="submit" form="inv-form" variant="primary" disabled={saving}>{saving ? t.saving : t.save}</Button>
        </>
      }
    >
      <form id="inv-form" onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <p className="col-span-full text-xs text-gray-400">{t.requiredNote}</p>
        {error && <div role="alert" className="col-span-full bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        {section(t.sectionIdentity)}
        {mode === 'add' ? (
          <div className="col-span-full">
            {companyOptions.length === 0 ? (
              <p className="text-sm text-gray-500">{t.formNoCompanies}</p>
            ) : (
              <>
                <Select label={`${t.formCompany} *`} value={form.companyId} onChange={e => pickCompany(e.target.value)}
                  options={companyOptions} placeholder={t.formCompanyPlaceholder} error={errors.companyId} />
                <p className="mt-1 text-xs text-gray-400">{t.formCompanyHelp}</p>
              </>
            )}
          </div>
        ) : (
          <Input label={t.formCompany} value={form.companyName} disabled className="col-span-full" />
        )}
        <div>
          <Input label={`${t.formReference} *`} value={form.reference} onChange={set('reference')} error={errors.reference} />
          {mode === 'add' && <p className="mt-1 text-xs text-gray-400">{t.formReferenceHelp}</p>}
        </div>
        <Input label={t.formInvestorEntity} value={form.investorEntity} onChange={set('investorEntity')} />
        <Select label={t.formRound} value={form.round} onChange={set('round')}
          options={ROUNDS.map(v => ({ value: v, label: v }))} placeholder="—" />
        <Select label={t.formInstrument} value={form.instrument} onChange={set('instrument')}
          options={INSTRUMENTS.map(v => ({ value: v, label: v }))} placeholder="—" />
        <Input label={t.fTermsReference} value={form.termsReference} onChange={set('termsReference')} />

        {section(t.sectionStatusAmounts)}
        <Select label={`${t.formStatus} *`} value={form.status} onChange={set('status')}
          options={TX_STATUSES.map(v => ({ value: v, label: statusLabel(t, v) }))} error={errors.status} />
        <Select label={`${t.formCurrency} *`} value={form.currency} onChange={set('currency')}
          options={CURRENCIES.map(v => ({ value: v, label: v }))} error={errors.currency} />
        <Input label={`${t.formProposedAmount}${cur}`} type="number" step="any" min="0" value={form.proposedAmount} onChange={set('proposedAmount')} error={errors.proposedAmount} />
        <Input label={t.formProposedDate} type="date" value={form.proposedDate} onChange={set('proposedDate')} error={errors.proposedDate} />
        <Input label={t.formApprovalDate} type="date" value={form.approvalDate} onChange={set('approvalDate')} />
        <span className="hidden sm:block" />
        <Input label={`${t.formCommittedAmount}${cur}`} type="number" step="any" min="0" value={form.committedAmount} onChange={set('committedAmount')} error={errors.committedAmount} />
        <Input label={t.formCommitmentDate} type="date" value={form.commitmentDate} onChange={set('commitmentDate')} error={errors.commitmentDate} />
        <Input label={`${t.formInvestmentDate}${form.status === 'Funded' || form.status === 'Partially Funded' ? ' *' : ''}`} type="date" value={form.investmentDate} onChange={set('investmentDate')} error={errors.investmentDate} />
        <p className="col-span-full text-xs text-gray-400">{t.amountsHelp}</p>

        {section(t.sectionValuation)}
        <Input label={`${t.fPreMoney}${cur}`} type="number" step="any" min="0" value={form.preMoney} onChange={set('preMoney')} error={errors.preMoney} />
        <Input label={`${t.fPostMoney}${cur}`} type="number" step="any" min="0" value={form.postMoney} onChange={set('postMoney')} error={errors.postMoney} />
        <Input label={t.fValuationDate} type="date" value={form.valuationDate} onChange={set('valuationDate')} error={errors.valuationDate} />
        <Input label={`${t.fPricePerShare}${cur}`} type="number" step="any" min="0" value={form.pricePerShare} onChange={set('pricePerShare')} error={errors.pricePerShare} />
        <Input label={`${t.formHoldingValue}${cur}`} type="number" step="any" min="0" value={form.holdingValue} onChange={set('holdingValue')} error={errors.holdingValue} />
        <Input label={t.formHoldingAsOf} type="date" value={form.holdingValueAsOf} onChange={set('holdingValueAsOf')} error={errors.holdingValueAsOf} />

        {section(t.sectionCapTable)}
        <Input label={t.fShares} type="number" step="1" min="0" value={form.sharesAcquired} onChange={set('sharesAcquired')} error={errors.sharesAcquired} />
        <Input label={t.fFullyDiluted} type="number" step="1" min="0" value={form.fullyDilutedShares} onChange={set('fullyDilutedShares')} error={errors.fullyDilutedShares} />
        <Input label={t.formCapTableAsOf} type="date" value={form.capTableAsOf} onChange={set('capTableAsOf')} error={errors.capTableAsOf} />
        <Input label={t.formCapTableReference} value={form.capTableReference} onChange={set('capTableReference')} />
        <Input label={t.formOwnershipRecorded} type="number" step="any" min="0" max="100" value={form.recordedOwnershipPct} onChange={set('recordedOwnershipPct')} error={errors.recordedOwnershipPct} />
        <div className="flex flex-col justify-center">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={form.capTableApproved} className="rounded border-gray-300"
              onChange={e => setForm(prev => ({ ...prev, capTableApproved: e.target.checked }))} />
            {t.formCapTableApproved}
          </label>
          <p className="mt-1 text-xs text-gray-400">{t.formCapTableApprovedHelp}</p>
        </div>

        <Textarea label={t.formNotes} value={form.notes} onChange={set('notes')} rows={3} className="col-span-full" />
      </form>
    </ModalFrame>
  );
}

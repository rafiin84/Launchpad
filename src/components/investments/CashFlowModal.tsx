import { useState } from 'react';
import { Input, Select, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import { FLOW_TYPES } from '../../lib/investmentCalc';
import { ModalFrame } from '../portfolio/portfolioUi';
import { flowLabel, type InvText } from './investmentText';

export interface CashFlowFormValue { type: string; date: string; amount: number; note: string }

export default function CashFlowModal({
  currency, saving, error, t, onSave, onClose,
}: {
  currency: string;
  saving: boolean;
  error: string;
  t: InvText;
  onSave: (value: CashFlowFormValue) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<string>('Funding');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ date?: string; amount?: string }>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: { date?: string; amount?: string } = {};
    if (!date) next.date = t.errRequired;
    if (amount.trim() === '') next.amount = t.errRequired;
    else if (!Number.isFinite(Number(amount))) next.amount = t.errNumber;
    else if (Number(amount) <= 0) next.amount = t.errPositive;
    setErrors(next);
    if (Object.keys(next).length === 0) onSave({ type, date, amount: Number(amount), note });
  }

  return (
    <ModalFrame
      title={t.txTitle}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button type="submit" form="inv-cf-form" variant="primary" disabled={saving}>{saving ? t.saving : t.save}</Button>
        </>
      }
    >
      <form id="inv-cf-form" onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {error && <div role="alert" className="col-span-full bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
        <Select label={`${t.txType} *`} value={type} onChange={e => setType(e.target.value)}
          options={FLOW_TYPES.map(v => ({ value: v, label: flowLabel(t, v) }))} />
        <Input label={`${t.txDate} *`} type="date" value={date} onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: undefined })); }} error={errors.date} />
        <div className="col-span-full">
          <Input label={`${t.txAmount} *`} type="number" step="any" min="0" value={amount}
            onChange={e => { setAmount(e.target.value); setErrors(p => ({ ...p, amount: undefined })); }} error={errors.amount} />
          <p className="mt-1 text-xs text-gray-400">{t.txAmountHelp.replace('{currency}', currency || '—')}</p>
        </div>
        <Textarea label={t.txNote} value={note} onChange={e => setNote(e.target.value)} rows={2} className="col-span-full" />
      </form>
    </ModalFrame>
  );
}

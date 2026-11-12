import { useMemo, useState } from 'react';
import { Input, Select, Textarea } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  MEMBERSHIP_BASES, STAGES, STATUSES,
  type PortfolioEntryInput,
} from '../../services/crmPortfolioManagement';
import type { CRMPortfolioRecord } from '../../services/crmPortfolio';
import { ModalFrame } from './portfolioUi';
import type { PMText } from './portfolioText';


/** Case-insensitive match of a company's free-text stage onto the CRM picklist. */
function matchStage(raw: string): string {
  const n = raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return STAGES.find(s => s.toLowerCase().replace(/[\s_]+/g, '-') === n) ?? '';
}

type Errors = Partial<Record<keyof PortfolioEntryInput, string>>;

const NUMBER_FIELDS: Array<keyof PortfolioEntryInput> = [
  'totalInvested', 'latestValuation', 'ownershipPct', 'latestRevenue', 'revenueGrowthPct',
  'monthlyBurn', 'runwayMonths', 'headcount', 'openRoles',
];

export default function EntryFormModal({
  mode, initial, companies, saving, error, t, onSave, onClose,
}: {
  mode: 'add' | 'edit';
  initial: PortfolioEntryInput;
  /** Companies available to add (already filtered to those not in the portfolio). Add mode only. */
  companies: CRMPortfolioRecord[];
  saving: boolean;
  error: string;
  t: PMText;
  onSave: (input: PortfolioEntryInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PortfolioEntryInput>(initial);
  const [errors, setErrors] = useState<Errors>({});

  const set = (key: keyof PortfolioEntryInput) =>
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
    if (!c) { setForm(prev => ({ ...prev, companyId: '', companyName: '' })); return; }
    // Prefill from the company record so the investor only confirms what's already known.
    setForm(prev => ({
      ...prev,
      companyId: c.id,
      companyName: c.companyName,
      sector: c.industry || prev.sector,
      geography: c.location || prev.geography,
      currentStage: matchStage(c.stage) || prev.currentStage,
      totalInvested: c.investmentAmount || prev.totalInvested,
      initialInvestmentDate: c.investmentDate ? c.investmentDate.slice(0, 10) : prev.initialInvestmentDate,
      ownershipPct: c.ownershipPct || prev.ownershipPct,
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (mode === 'add' && !form.companyId) next.companyId = t.errCompany;
    if (!form.companyName.trim()) next.companyName = t.errName;
    for (const k of NUMBER_FIELDS) {
      const v = form[k];
      if (v.trim() !== '' && !Number.isFinite(Number(v))) next[k] = t.errNumber;
    }
    const own = form.ownershipPct.trim();
    if (own !== '' && Number.isFinite(Number(own)) && (Number(own) < 0 || Number(own) > 100)) next.ownershipPct = t.errPercent;
    setErrors(next);
    if (Object.keys(next).length === 0) onSave(form);
  }

  const title = mode === 'add' ? t.formAddTitle : t.formEditTitle.replace('{name}', initial.companyName);
  const section = (label: string) => <h3 className="col-span-full text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">{label}</h3>;

  return (
    <ModalFrame
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button type="submit" form="pm-entry-form" variant="primary" disabled={saving}>{saving ? t.saving : t.save}</Button>
        </>
      }
    >
      <form id="pm-entry-form" onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {error && <div className="col-span-full bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

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
          <Input label={`${t.formCompany} *`} value={form.companyName} onChange={set('companyName')} error={errors.companyName} className="col-span-full" />
        )}

        {section(t.sectionInvestment)}
        <Select label={t.formMembership} value={form.membershipBasis} onChange={set('membershipBasis')}
          options={MEMBERSHIP_BASES.map(v => ({ value: v, label: v }))} />
        <Input label={t.formConfirmedOn} type="date" value={form.confirmedOn} onChange={set('confirmedOn')} />
        <Input label={t.formInitialDate} type="date" value={form.initialInvestmentDate} onChange={set('initialInvestmentDate')} />
        <Input label={t.formTotalInvested} type="number" step="any" min="0" value={form.totalInvested} onChange={set('totalInvested')} error={errors.totalInvested} />
        <Input label={t.formLatestValuation} type="number" step="any" min="0" value={form.latestValuation} onChange={set('latestValuation')} error={errors.latestValuation} />
        <Input label={t.formValuationAsOf} type="date" value={form.valuationAsOf} onChange={set('valuationAsOf')} />
        <Input label={t.formOwnership} type="number" step="any" min="0" max="100" value={form.ownershipPct} onChange={set('ownershipPct')} error={errors.ownershipPct} />
        <Select label={t.formStatus} value={form.status} onChange={set('status')}
          options={STATUSES.map(v => ({ value: v, label: v }))} />
        {form.status === 'Exited' && <Input label={t.formExitDate} type="date" value={form.exitDate} onChange={set('exitDate')} />}

        {section(t.sectionClassification)}
        <Input label={t.formSector} value={form.sector} onChange={set('sector')} />
        <Input label={t.formGeography} value={form.geography} onChange={set('geography')} />
        <Select label={t.formStage} value={form.currentStage} onChange={set('currentStage')}
          options={STAGES.map(v => ({ value: v, label: v }))} placeholder="—" />

        {section(t.sectionPerformance)}
        <div>
          <Input label={t.formReportingPeriod} value={form.reportingPeriod} onChange={set('reportingPeriod')} />
          <p className="mt-1 text-xs text-gray-400">{t.formReportingPeriodHelp}</p>
        </div>
        <Input label={t.formMetricsAsOf} type="date" value={form.metricsAsOf} onChange={set('metricsAsOf')} />
        <Input label={t.formRevenue} type="number" step="any" value={form.latestRevenue} onChange={set('latestRevenue')} error={errors.latestRevenue} />
        <Input label={t.formGrowth} type="number" step="any" value={form.revenueGrowthPct} onChange={set('revenueGrowthPct')} error={errors.revenueGrowthPct} />
        <Input label={t.formBurn} type="number" step="any" min="0" value={form.monthlyBurn} onChange={set('monthlyBurn')} error={errors.monthlyBurn} />
        <Input label={t.formRunway} type="number" step="any" min="0" value={form.runwayMonths} onChange={set('runwayMonths')} error={errors.runwayMonths} />
        <Input label={t.formHeadcount} type="number" step="1" min="0" value={form.headcount} onChange={set('headcount')} error={errors.headcount} />
        <Input label={t.formOpenRoles} type="number" step="1" min="0" value={form.openRoles} onChange={set('openRoles')} error={errors.openRoles} />
        <Input label={t.formLastUpdate} type="date" value={form.lastCompanyUpdate} onChange={set('lastCompanyUpdate')} />

        {section(t.sectionHealth)}
        <div className="col-span-full -mt-2 text-xs text-gray-400">{t.formHealthManualHelp}</div>
        <Select label={t.formHealthManual} value={form.recordedHealth} onChange={set('recordedHealth')}
          options={['On Track', 'Needs Attention', 'At Risk'].map(v => ({ value: v, label: v }))} placeholder="—" />
        <Input label={t.formHealthReason} value={form.recordedHealthReason} onChange={set('recordedHealthReason')} />

        <Textarea label={t.formNotes} value={form.notes} onChange={set('notes')} rows={3} className="col-span-full" />
      </form>
    </ModalFrame>
  );
}


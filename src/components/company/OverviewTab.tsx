import { useMemo } from 'react';
import { Briefcase, Globe, MapPin, Building2, Calendar, Users, Tag, ExternalLink, Layers } from 'lucide-react';
import FounderProfile from './FounderProfile';
import FounderReportedProfile from './FounderReportedProfile';
import { Kpi, Pill, Table } from '../reports/reportUi';
import type { CRMPortfolioRecord } from '../../services/crmPortfolio';
import type { CompanyData } from '../../services/companyProfile';
import { amountsOf, type InvestmentRecord } from '../../services/crmInvestments';
import { formatAmount, roundRank, sumByCurrency } from '../../lib/investmentCalc';
import { formatDate } from '../../lib/portfolioFormat';
import { optionLabel, type PortfolioOptions } from '../../lib/usePortfolioOptions';
import type { TranslationKeys } from '../../i18n';

type T = TranslationKeys['companyDetail'];

/** One profile section, as the founder wrote it on their Founder Companies record. */
function ProfileBlock({ title, value, t }: { title: string; value: string; t: T }) {
  return (
    <div className="min-w-0">
      {title && <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{title}</h4>}
      {value.trim()
        ? <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line break-words">{value.trim()}</p>
        : <p className="text-sm text-gray-400">{t.notProvided}</p>}
    </div>
  );
}

const card = 'bg-white border border-gray-100 rounded-3xl p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]';

export default function OverviewTab({
  record, founderData, investments, options, founderPhotoUrl, locale, t,
}: {
  record: CRMPortfolioRecord;
  /** The founder's own profile (read from CRM), if they have one. */
  founderData: CompanyData | null;
  /** This company's investment records (already limited to the company). */
  investments: InvestmentRecord[];
  options: PortfolioOptions;
  founderPhotoUrl: string;
  locale: string;
  t: T;
}) {
  const tags = record.tags ? record.tags.split(',').map(x => x.trim()).filter(Boolean) : [];
  const rounds = useMemo(() => [...investments].sort((a, b) => roundRank(a.round) - roundRank(b.round) || a.investmentDate.localeCompare(b.investmentDate)), [investments]);
  const money = (items: Array<{ currency: string; amount: number }>) =>
    items.length === 0 ? '—' : items.map(i => formatAmount(i.amount, i.currency, locale)).join(' · ');
  const funded = sumByCurrency(investments.map(i => ({ ...i, f: amountsOf(i).funded })), i => i.f);
  const committed = sumByCurrency(investments, i => i.committedAmount);
  const latestPost = [...investments].filter(i => i.postMoney !== null).sort((a, b) => b.valuationDate.localeCompare(a.valuationDate))[0];
  // The company record holds one investment, with no currency of its own — shown as recorded.
  const plain = (n: string) => (n && Number(n) ? new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }).format(Number(n)) : '—');

  const infoRow = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-2.5">
      <span className="text-gray-300 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0"><p className="text-[11px] text-gray-400">{label}</p><div className="text-sm text-gray-700 break-words">{value}</div></div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 space-y-5">
        <section className={card}>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.ovAbout}</h3>
          {record.shortDescription && <p className="text-sm font-medium text-gray-800 mb-2">{record.shortDescription}</p>}
          {record.fullDescription
            ? <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{record.fullDescription}</p>
            : !record.shortDescription && <p className="text-sm text-gray-400">{t.notProvided}</p>}
        </section>

        {/* Company details are kept on the founder's Founder Companies record — one place, no copy on the investor record. */}
        <section className={card}>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-gray-900">{t.sectionProfile}</h3>
            {founderData && <Pill tone="indigo">{t.reportedByFounder}</Pill>}
          </div>
          {!founderData ? (
            <p className="text-sm text-gray-500">{t.noFounderProfile}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <ProfileBlock t={t} title={t.ovBusinessModel} value={founderData.revenueModel} />
                <ProfileBlock t={t} title={t.ovProducts} value={founderData.productDescription} />
                <ProfileBlock t={t} title={t.ovProblem} value={founderData.problemStatement} />
                <ProfileBlock t={t} title={t.ovSolution} value={founderData.solution} />
                <ProfileBlock t={t} title={t.ovTargetMarket} value={founderData.targetMarket} />
                <ProfileBlock t={t} title={t.ovCompetitive}
                  value={[founderData.keyCompetitors, founderData.differentiator].filter(Boolean).join('\n')} />
              </div>
              <div className="mt-5 pt-4 border-t border-gray-50">
                <ProfileBlock t={t} title={t.ovTeamInfo}
                  value={[founderData.teamInformation, founderData.founderNames, founderData.openRoles && `${founderData.openRoles} open roles`].filter(Boolean).join('\n')} />
                {(founderData.teamSize || record.teamSize) && (
                  <p className="mt-3 text-xs text-gray-500">{t.ovTeamSize}: <span className="font-semibold text-gray-800">{founderData.teamSize || record.teamSize}</span></p>
                )}
              </div>
            </>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.ovFounderInfo}</h3>
          <FounderProfile founderEmail={record.founderEmail || ''} photoUrl={founderPhotoUrl}
            fallback={{ name: record.founderName || '', email: record.founderEmail || '', phone: record.founderPhone || '', linkedin: record.founderLinkedin || '' }} />
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.ovFunding}</h3>
          {rounds.length > 0 ? (
            <Table head={[t.fhRound, t.fhDate, t.fhInstrument, t.fhAmount, t.fhValuation, t.fhStatus]}>
              {rounds.map(r => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.round || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.investmentDate, locale)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.instrument || '—'}</td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{formatAmount(amountsOf(r).funded, r.currency, locale)}</td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{formatAmount(r.postMoney, r.currency, locale)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.status || '—'}</td>
                </tr>
              ))}
            </Table>
          ) : Number(record.investmentAmount) > 0 ? (
            <Table head={[t.fhRound, t.fhDate, t.fhAmount, t.sumPreMoney]}>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">{record.stage ? optionLabel(options.stage, record.stage) : '—'}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(record.investmentDate, locale)}</td>
                <td className="px-4 py-3 tabular-nums">{plain(record.investmentAmount)}</td>
                <td className="px-4 py-3 tabular-nums">{plain(record.preMoneyValuation)}</td>
              </tr>
              <tr><td colSpan={4} className="px-4 pb-3 text-[11px] text-gray-400">{t.fhRecorded}</td></tr>
            </Table>
          ) : <p className="text-sm text-gray-500 bg-white border border-gray-100 rounded-2xl px-4 py-3">{t.fhEmpty}</p>}
        </section>

        <FounderReportedProfile founderEmail={record.founderEmail || ''} />
      </div>

      <div className="space-y-5">
        <section>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.ovSummary}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Kpi icon={Briefcase} tone="emerald" label={t.sumTotalFunded} value={investments.length ? money(funded) : plain(record.investmentAmount)} />
            <Kpi icon={Briefcase} tone="amber" label={t.sumCommitted} value={money(committed)} />
            <Kpi icon={Layers} tone="indigo" label={t.sumRounds} value={investments.length || (Number(record.investmentAmount) > 0 ? 1 : 0)} />
            <Kpi icon={Building2} tone="violet" label={t.sumOwnership} value={record.ownershipPct ? `${record.ownershipPct}%` : '—'} />
            <Kpi icon={Briefcase} tone="sky" label={t.sumPreMoney} value={plain(record.preMoneyValuation)} />
            <Kpi icon={Briefcase} tone="rose" label={t.sumPostMoney} value={latestPost ? formatAmount(latestPost.postMoney, latestPost.currency, locale) : '—'} />
          </div>
          {record.investmentDate && <p className="mt-2 text-[11px] text-gray-400">{t.sumInvestmentDate}: {formatDate(record.investmentDate, locale)}</p>}
        </section>

        <section className={card}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">{t.ovCompanyInfo}</h3>
          <div className="space-y-3.5">
            {record.website && infoRow(<Globe size={14} />, t.ovWebsite,
              <a href={record.website.startsWith('http') ? record.website : `https://${record.website}`} target="_blank" rel="noopener noreferrer"
                className="text-indigo-500 hover:underline inline-flex items-center gap-1 break-all">{record.website}<ExternalLink size={10} /></a>)}
            {record.location && infoRow(<MapPin size={14} />, t.ovLocation, record.location)}
            {record.industry && infoRow(<Building2 size={14} />, t.ovIndustry, optionLabel(options.industry, record.industry))}
            {record.stage && infoRow(<Layers size={14} />, t.ovStage, optionLabel(options.stage, record.stage))}
            {record.foundedYear && infoRow(<Calendar size={14} />, t.ovFounded, record.foundedYear)}
            {record.teamSize && infoRow(<Users size={14} />, t.ovTeamSize, record.teamSize)}
            {tags.length > 0 && infoRow(<Tag size={14} />, t.ovTags,
              <div className="flex flex-wrap gap-1.5 mt-0.5">{tags.map(x => <span key={x} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">{x}</span>)}</div>)}
          </div>
        </section>
      </div>
    </div>
  );
}

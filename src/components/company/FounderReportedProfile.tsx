import { useEffect, useState } from 'react';
import {
  Loader2, AlertCircle, Building2, Users, Target, TrendingUp,
  DollarSign, Compass,
} from 'lucide-react';
import {
  fetchCompanyProfile, type CompanyData,
} from '../../services/companyProfile';
import { percent, withUnit, withCurrencyPrefix } from '../../lib/units';
import { cn } from '../../lib/cn';

/**
 * The founder's own company profile, shown on the investor's Company page.
 *
 * Two records describe the same company: the Portfolios record the investor
 * maintains, and the Founder_Companies record the founder maintains. This is
 * the second one, read whole and read-only, and labelled as self-reported —
 * an investor reading a market size or a growth rate here should know who put
 * it there, because nobody has checked it.
 */

interface Field { label: string; value: string }

function Section({
  title, icon: Icon, fields, prose,
}: {
  title: string;
  icon: typeof Users;
  fields?: Field[];
  prose?: Field[];
}) {
  const shownFields = (fields ?? []).filter(f => f.value);
  const shownProse = (prose ?? []).filter(f => f.value);
  if (!shownFields.length && !shownProse.length) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3.5">
        <Icon size={14} className="text-gray-400" />
        <h4 className="text-sm font-bold text-gray-900">{title}</h4>
      </div>

      {shownFields.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3.5 mb-3">
          {shownFields.map(f => (
            <div key={f.label} className="min-w-0">
              <p className="text-[11px] text-gray-400 mb-0.5">{f.label}</p>
              <p className="text-sm font-semibold text-gray-900 break-words">{f.value}</p>
            </div>
          ))}
        </div>
      )}

      {shownProse.map(f => (
        <div key={f.label} className="mt-3 first:mt-0">
          <p className="text-[11px] text-gray-400 mb-1">{f.label}</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{f.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function FounderReportedProfile({
  founderEmail, className,
}: {
  founderEmail: string;
  className?: string;
}) {
  const [data, setData] = useState<CompanyData | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!founderEmail);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!founderEmail) return;
    let cancelled = false;
    fetchCompanyProfile(founderEmail)
      .then(res => {
        if (cancelled) return;
        // fetchCompanyProfile falls back to an empty shape rather than null, so
        // "has the founder filled anything in" is a question about the values.
        const any = Object.values(res.data || {}).some(v => String(v ?? '').trim());
        setData(any ? res.data : null);
        setLogo(res.logo);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the founder profile.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [founderEmail]);

  if (!founderEmail) return null;

  if (loading) {
    return (
      <div className={cn('bg-white border border-gray-100 rounded-2xl p-6', className)}>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" /> Loading the founder's profile…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4', className)}>
        <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
          <AlertCircle size={14} /> The founder's profile could not be loaded
        </p>
        <p className="text-xs text-amber-800 mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn('bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4', className)}>
        <p className="text-sm font-semibold text-gray-700">No founder-reported profile yet</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
          {founderEmail} has not filled in their company profile. Everything above
          comes from the portfolio record.
        </p>
      </div>
    );
  }

  const lastRound = [data.lastRoundStage, data.lastRoundSize && withCurrencyPrefix(data.lastRoundSize), data.lastRoundDate]
    .filter(Boolean).join(' · ');

  return (
    <div className={cn('space-y-4', className)}>
      {/* Provenance, stated once and up front */}
      <div className="flex items-start gap-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl px-4 py-3">
        {logo
          ? <img src={logo} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
          : <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Building2 size={15} className="text-indigo-600" />
            </div>}
        <div className="min-w-0">
          <p className="text-sm font-bold text-indigo-900">
            {data.name || 'Founder-reported profile'}
            {data.tagline && <span className="font-medium text-indigo-700"> — {data.tagline}</span>}
          </p>
          <p className="text-[11px] text-indigo-700/80 mt-0.5 leading-relaxed">
            Maintained by the founder ({founderEmail}) on their own Company page.
            Self-reported and unverified — where it disagrees with the portfolio
            record above, the portfolio record is what your fund recorded.
          </p>
        </div>
      </div>

      <Section
        title="Company"
        icon={Building2}
        fields={[
          { label: 'Industry', value: data.industry },
          { label: 'Stage', value: data.stage },
          { label: 'Founded', value: data.foundedYear },
          { label: 'Location', value: data.location },
          { label: 'Website', value: data.website },
          { label: 'Revenue model', value: data.revenueModel },
        ]}
        prose={[{ label: 'Description', value: data.description }]}
      />

      <Section
        title="Team"
        icon={Users}
        fields={[
          { label: 'Founders', value: data.founderNames },
          { label: 'Team size', value: withUnit(data.teamSize, 'people') },
          { label: 'Open roles', value: data.openRoles },
        ]}
      />

      <Section
        title="Product & market"
        icon={Target}
        fields={[
          { label: 'TAM', value: data.tam },
          { label: 'SAM', value: data.sam },
          { label: 'SOM', value: data.som },
        ]}
        prose={[
          { label: 'Product', value: data.productDescription },
          { label: 'Target market', value: data.targetMarket },
          { label: 'Key competitors', value: data.keyCompetitors },
          { label: 'Differentiator', value: data.differentiator },
        ]}
      />

      <Section
        title="Traction"
        icon={TrendingUp}
        fields={[
          { label: 'MRR', value: withCurrencyPrefix(data.mrr) },
          { label: 'ARR', value: withCurrencyPrefix(data.arr) },
          { label: 'Active customers', value: data.activeCustomers },
          { label: 'MoM growth', value: percent(data.momGrowth) },
          { label: 'Monthly churn', value: percent(data.churnRate) },
          { label: 'NPS', value: data.nps },
          { label: data.keyMetricLabel || 'Key metric', value: data.keyMetric },
        ]}
      />

      <Section
        title="Funding"
        icon={DollarSign}
        fields={[
          { label: 'Total raised', value: withCurrencyPrefix(data.totalRaised) },
          { label: 'Last round', value: lastRound },
          { label: 'Pre-money valuation', value: withCurrencyPrefix(data.preMoneyValuation) },
          { label: 'Monthly burn', value: withCurrencyPrefix(data.monthlyBurn) },
          { label: 'Runway', value: withUnit(data.runway, 'mo') },
          { label: 'Current ask', value: withCurrencyPrefix(data.currentAsk) },
        ]}
        prose={[{ label: 'Use of funds', value: data.useOfFunds }]}
      />

      <Section
        title="Outlook"
        icon={Compass}
        prose={[
          { label: 'Next milestones', value: data.nextMilestones },
          { label: 'Key risks', value: data.keyRisks },
        ]}
      />
    </div>
  );
}

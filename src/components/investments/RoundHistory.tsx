import { useMemo } from 'react';
import { formatAmount, roundRank } from '../../lib/investmentCalc';
import { amountsOf, type InvestmentRecord } from '../../services/crmInvestments';
import { StatusBadge } from './investmentUi';
import type { InvText } from './investmentText';

/** Each company's rounds in order, earliest first — a quick read of how a company has been funded. */
export default function RoundHistory({
  investments, language, t, onSelect,
}: {
  investments: InvestmentRecord[];
  language: string;
  t: InvText;
  onSelect: (id: string) => void;
}) {
  const locale = language === 'ja' ? 'ja-JP' : 'en-US';
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; rounds: InvestmentRecord[] }>();
    for (const inv of investments) {
      const key = inv.companyId || inv.companyName || inv.id;
      const g = m.get(key) ?? { name: inv.companyName || '—', rounds: [] };
      g.rounds.push(inv);
      m.set(key, g);
    }
    for (const g of m.values()) {
      g.rounds.sort((a, b) => roundRank(a.round) - roundRank(b.round) || a.investmentDate.localeCompare(b.investmentDate));
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [investments]);

  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="inv-round-history">
      <h2 id="inv-round-history" className="text-sm font-semibold text-gray-900">{t.roundHistoryTitle}</h2>
      <p className="text-xs text-gray-400 mb-3">{t.roundHistoryNote}</p>
      <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
        {groups.map(g => (
          <div key={g.name} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <p className="text-sm font-semibold text-gray-900 md:w-48 flex-shrink-0 truncate">{g.name}</p>
            <ol className="flex flex-wrap gap-2">
              {g.rounds.map(r => {
                const funded = amountsOf(r).funded;
                return (
                  <li key={r.id}>
                    <button onClick={() => onSelect(r.id)}
                      className="flex items-center gap-2 text-left border border-gray-100 hover:border-gray-300 rounded-xl px-3 py-1.5 transition-colors">
                      <span className="text-xs font-medium text-gray-800">{r.round || t.roundNone}</span>
                      <StatusBadge status={r.status} t={t} />
                      {funded !== null && funded > 0 && (
                        <span className="text-xs text-gray-500 tabular-nums">{formatAmount(funded, r.currency, locale)}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

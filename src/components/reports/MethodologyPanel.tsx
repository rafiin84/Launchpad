import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { METHODOLOGY_VERSION } from '../../lib/reportAnalytics';
import type { RepText } from './reportText';

/** The documented formulas and reporting policy — always available, and included when a report is printed. */
export default function MethodologyPanel({ t }: { t: RepText }) {
  const [open, setOpen] = useState(false);
  const items = [t.mAsOf, t.mDeployed, t.mCommitted, t.mPortfolioValue, t.mMoic, t.mIrr, t.mCurrency, t.mCompanies, t.mMissing, t.mPermissions];
  return (
    <section className="bg-white border border-gray-100 rounded-2xl break-inside-avoid">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left report-print-hide">
        <span className="text-sm font-semibold text-gray-900">{t.methodologyTitle}</span>
        <span className="flex items-center gap-2 text-[11px] text-gray-400">
          {t.methodologyVersion.replace('{v}', METHODOLOGY_VERSION)}
          <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </span>
      </button>
      <h3 className="hidden print:block px-4 pt-3 text-sm font-semibold text-gray-900">
        {t.methodologyTitle} · {t.methodologyVersion.replace('{v}', METHODOLOGY_VERSION)}
      </h3>
      <ul className={`px-4 pb-4 space-y-2 text-xs text-gray-600 ${open ? 'block' : 'hidden print:block'}`}>
        {items.map(text => <li key={text}>{text}</li>)}
      </ul>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { fetchPortfolioPicklists } from '../services/crmPortfolio';

export interface Option { value: string; label: string }
export interface PortfolioOptions { industry: Option[]; stage: Option[]; status: Option[]; fromCrm: boolean }

/**
 * Only used when CRM's field metadata can't be read (the user's profile may not
 * be allowed to). They mirror what the Companies picklists contained when this
 * was written; whenever the metadata IS readable, CRM's current options win.
 */
const FALLBACK: PortfolioOptions = {
  fromCrm: false,
  industry: ['fintech', 'healthtech', 'saas', 'edtech', 'cleantech', 'ai-ml', 'ecommerce', 'other'].map(v => ({ value: v, label: v })),
  stage: ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth', 'pre-ipo'].map(v => ({ value: v, label: v })),
  status: ['active', 'exited', 'written-off', 'follow-on'].map(v => ({ value: v, label: v })),
};

/** Industry / stage / status options, read live from the Companies picklists in CRM. */
export function usePortfolioOptions(): PortfolioOptions {
  const [opts, setOpts] = useState<PortfolioOptions>(FALLBACK);
  useEffect(() => {
    let cancelled = false;
    void fetchPortfolioPicklists().then(p => {
      if (cancelled || !p) return;
      const map = (o: Array<{ actual: string; display: string }>): Option[] => o.map(x => ({ value: x.actual, label: x.display }));
      if (p.industry.length || p.stage.length || p.status.length) {
        setOpts({ fromCrm: true, industry: map(p.industry), stage: map(p.stage), status: map(p.status) });
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  return opts;
}

/** The label CRM gives a picklist value, or the value itself. */
export function optionLabel(options: Option[], value: string): string {
  const v = value.trim().toLowerCase();
  return options.find(o => o.value.toLowerCase() === v || o.label.toLowerCase() === v)?.label ?? value;
}

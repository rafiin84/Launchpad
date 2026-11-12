import type { HealthRule } from '../lib/portfolioHealth';

/**
 * The criteria that decide a portfolio company's health (see portfolioHealth.ts).
 *
 * These live in code rather than in a CRM module so that Portfolio Management
 * stays a single module. The business team has not yet defined the thresholds,
 * so this is empty — until it is, a company's health is whatever the team
 * recorded by hand on its Portfolio Management record, or "Data unavailable".
 * It is never guessed.
 *
 * To add a rule, append one here and redeploy. Example:
 *
 *   {
 *     id: 'runway-risk', name: 'Short runway', metric: 'Runway Months',
 *     condition: 'Less Than', threshold: 6, resulting: 'At Risk', active: true,
 *     explanation: 'Less than six months of cash remaining.',
 *   }
 *
 * `metric` must be one of RULE_METRICS (portfolioHealth.ts); `resulting` is
 * 'Needs Attention' or 'At Risk'. `explanation` is shown to the investor beside
 * the company's status, so write it for them.
 */
export const HEALTH_RULES: HealthRule[] = [];

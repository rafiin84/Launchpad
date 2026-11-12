/**
 * Portfolio health, derived from configurable rules (the Portfolio_Health_Rules
 * module in CRM) and explainable: every non-"on track" result carries the exact
 * rules and values that produced it.
 *
 * The business rule this encodes: a company is NEVER marked Needs Attention or
 * At Risk because data is missing. A rule only fires when the metric it tests
 * has actually been reported. If no active rule can be evaluated against what a
 * company has reported, the result is "Data unavailable" (or the status the
 * team recorded by hand in CRM, if any) — not a negative label.
 *
 * Pure functions, no I/O, so the rules can be tested exhaustively.
 */

export type HealthStatus = 'on_track' | 'needs_attention' | 'at_risk' | 'data_unavailable';

/** The metrics a rule may test. Must match the picklist on Portfolio_Health_Rules.Metric. */
export const RULE_METRICS = [
  'Runway Months',
  'Revenue Growth Percentage',
  'Monthly Burn Rate',
  'Days Since Last Update',
  'Headcount Change',
] as const;
export type RuleMetric = (typeof RULE_METRICS)[number];

export type RuleCondition = 'Less Than' | 'Greater Than';

export interface HealthRule {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number | null;
  /** 'Needs Attention' | 'At Risk' as written in CRM. */
  resulting: string;
  active: boolean;
  /** Plain-language reason shown next to the company's status. */
  explanation: string;
}

/** The slice of a portfolio entry that health depends on. */
export interface HealthInputs {
  runwayMonths: number | null;
  revenueGrowthPct: number | null;
  monthlyBurn: number | null;
  /** ISO date (YYYY-MM-DD) the company last reported, or ''. */
  lastCompanyUpdate: string;
  /** Status the team recorded by hand in CRM; used only when no rule can be evaluated. */
  recordedStatus: HealthStatus;
  recordedReason: string;
}

export interface HealthReason {
  ruleName: string;
  metric: string;
  value: number;
  condition: string;
  threshold: number;
  resulting: HealthStatus;
  explanation: string;
}

export interface HealthResult {
  status: HealthStatus;
  reasons: HealthReason[];
  /** How many active rules had data to evaluate. */
  evaluated: number;
  /** Where the status came from. */
  basis: 'rules' | 'recorded' | 'none';
  /** Free-text reason from CRM when basis is 'recorded'. */
  recordedReason: string;
}

const MS_PER_DAY = 86_400_000;

export function parseHealthStatus(raw: string): HealthStatus {
  switch (raw.trim().toLowerCase()) {
    case 'on track': return 'on_track';
    case 'needs attention': return 'needs_attention';
    case 'at risk': return 'at_risk';
    default: return 'data_unavailable';
  }
}

function resultingStatus(raw: string): HealthStatus | null {
  const s = parseHealthStatus(raw);
  return s === 'needs_attention' || s === 'at_risk' ? s : null;
}

export function daysSince(isoDate: string, now: Date): number | null {
  if (!isoDate) return null;
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / MS_PER_DAY);
}

/** The value a rule's metric takes for this company, or null when it hasn't been reported. */
export function metricValue(inputs: HealthInputs, metric: string, now: Date): number | null {
  switch (metric) {
    case 'Runway Months': return inputs.runwayMonths;
    case 'Revenue Growth Percentage': return inputs.revenueGrowthPct;
    case 'Monthly Burn Rate': return inputs.monthlyBurn;
    case 'Days Since Last Update': return daysSince(inputs.lastCompanyUpdate, now);
    // Needs a previous headcount to compare against, which isn't stored — not evaluable yet.
    case 'Headcount Change': return null;
    default: return null;
  }
}

export function evaluateHealth(
  inputs: HealthInputs,
  rules: HealthRule[],
  now: Date = new Date(),
): HealthResult {
  const reasons: HealthReason[] = [];
  let evaluated = 0;

  for (const rule of rules) {
    if (!rule.active || rule.threshold === null) continue;
    if (rule.condition !== 'Less Than' && rule.condition !== 'Greater Than') continue;
    const resulting = resultingStatus(rule.resulting);
    if (!resulting) continue;

    const value = metricValue(inputs, rule.metric, now);
    if (value === null) continue;            // not reported -> the rule cannot fire

    evaluated++;
    const breached = rule.condition === 'Less Than' ? value < rule.threshold : value > rule.threshold;
    if (breached) {
      reasons.push({
        ruleName: rule.name,
        metric: rule.metric,
        value,
        condition: rule.condition,
        threshold: rule.threshold,
        resulting,
        explanation: rule.explanation,
      });
    }
  }

  if (reasons.length > 0) {
    const status: HealthStatus = reasons.some(r => r.resulting === 'at_risk') ? 'at_risk' : 'needs_attention';
    return { status, reasons, evaluated, basis: 'rules', recordedReason: '' };
  }

  if (evaluated > 0) {
    return { status: 'on_track', reasons: [], evaluated, basis: 'rules', recordedReason: '' };
  }

  // Nothing could be evaluated. Fall back to what the team recorded by hand, if
  // they recorded something meaningful — never to a negative label from absence.
  if (inputs.recordedStatus !== 'data_unavailable') {
    return {
      status: inputs.recordedStatus,
      reasons: [],
      evaluated: 0,
      basis: 'recorded',
      recordedReason: inputs.recordedReason,
    };
  }
  return { status: 'data_unavailable', reasons: [], evaluated: 0, basis: 'none', recordedReason: '' };
}

/** Default reporting-staleness window when no "Days Since Last Update" rule is configured. */
export const DEFAULT_STALE_DAYS = 90;

/** The window after which a company's last update counts as out of date. */
export function staleThresholdDays(rules: HealthRule[]): number {
  const r = rules.find(x => x.active && x.metric === 'Days Since Last Update' && x.threshold !== null);
  return r?.threshold ?? DEFAULT_STALE_DAYS;
}

/** True when the company has never reported, or reported longer ago than the window. */
export function hasNotReportedRecently(lastCompanyUpdate: string, thresholdDays: number, now: Date = new Date()): boolean {
  const d = daysSince(lastCompanyUpdate, now);
  return d === null || d > thresholdDays;
}

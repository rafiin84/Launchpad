// ─────────────────────────────────────────────────────────────────────────────
//  AI scoring for an application.
//
//  The model never runs in the browser: /api/ai-score holds the API key and
//  returns a structured assessment. This module is the client half — it sends
//  the application, validates what comes back, and stores the result on the
//  Applications record so every reviewer sees the same assessment instead of
//  each triggering their own (and paying for it).
//
//  The assessment is advisory. It is written to its own field and read nowhere
//  by the pipeline: it cannot advance a level, and it is not part of any
//  decision the app records.
// ─────────────────────────────────────────────────────────────────────────────

import { loadToken } from './oauth';
import { updateApplication, type InvestmentApplication } from './investmentApplications';

export const AI_DIMENSIONS = ['team', 'market', 'product', 'traction'] as const;
export type AiDimensionKey = typeof AI_DIMENSIONS[number];

export type AiVerdict = 'strong' | 'promising' | 'weak' | 'insufficient_data';

export interface AiDimension {
  key: AiDimensionKey;
  score: number;
  reasoning: string;
}

export interface AiAssessment {
  total: number;
  verdict: AiVerdict;
  summary: string;
  dimensions: AiDimension[];
  model: string;
  scoredAt: string;
  /** Who pressed the button. Recorded so a stale score can be chased up. */
  scoredBy?: string;
}

/** Fields sent for assessment — the founder's own submission, nothing else. */
const SENT_FIELDS: Array<keyof InvestmentApplication> = [
  'companyName', 'companyWebsite', 'companyIndustry', 'companyStage',
  'companyLocation', 'foundedYear', 'companyDescription',
  'founderName', 'founderRole', 'coFounders',
  'problemStatement', 'solution', 'targetMarket', 'businessModel',
  'competitiveAdvantage',
  'fundingAsk', 'useOfFunds', 'previousFunding', 'currentValuation',
  'equityOffered',
  'currentRevenue', 'mrr', 'arr', 'monthlyBurn', 'runway',
  'activeUsers', 'momGrowth', 'churnRate', 'nps', 'keyMetric', 'keyMetricLabel',
];

/**
 * True when there is enough in the record to be worth assessing.
 *
 * Checked here as well as server-side so the button can explain itself before
 * a request is spent: a blank application returns a blank assessment, and
 * charging for that helps nobody.
 */
export function hasAssessableContent(app: InvestmentApplication): boolean {
  const substantive: Array<keyof InvestmentApplication> = [
    'companyDescription', 'problemStatement', 'solution', 'targetMarket',
    'businessModel', 'currentRevenue', 'fundingAsk',
  ];
  return substantive.some(k => String(app[k] ?? '').trim().length > 0);
}

export function parseAiAssessment(raw: string): AiAssessment | null {
  if (!raw || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw) as Partial<AiAssessment>;
    if (typeof o.total !== 'number' || !Array.isArray(o.dimensions)) return null;
    return {
      total: o.total,
      verdict: (o.verdict ?? 'weak') as AiVerdict,
      summary: o.summary ?? '',
      dimensions: o.dimensions,
      model: o.model ?? '',
      scoredAt: o.scoredAt ?? '',
      scoredBy: o.scoredBy,
    };
  } catch {
    // A half-written or hand-edited field reads as "not scored yet" rather
    // than breaking the page it sits on.
    return null;
  }
}

export function stringifyAiAssessment(a: AiAssessment): string {
  return JSON.stringify(a);
}

/** Runs the assessment. Does not save — the caller decides whether to keep it. */
export async function requestAiAssessment(
  app: InvestmentApplication,
  scoredBy?: string,
): Promise<AiAssessment> {
  const application: Record<string, string> = {};
  for (const key of SENT_FIELDS) {
    const v = app[key];
    if (v !== undefined && v !== null && String(v).trim()) {
      application[key as string] = String(v);
    }
  }

  const token = loadToken();
  const res = await fetch('/api/ai-score', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Zoho-oauthtoken ${token}` } : {}),
    },
    body: JSON.stringify({ application }),
  });

  const json = await res.json().catch(() => ({})) as {
    assessment?: AiAssessment; error?: string;
  };
  if (!res.ok || !json.assessment) {
    throw new Error(json.error || `AI scoring failed (${res.status})`);
  }
  return { ...json.assessment, scoredBy };
}

/**
 * Saves an assessment onto the application.
 *
 * allowLocked is passed because an approved or rejected application is
 * read-only, and that is right for anything that changes the record's
 * meaning — but an assessment changes nothing about the decision, and being
 * able to score a closed application is how you review how the decisions
 * were made after the fact.
 */
export async function saveAiAssessment(
  id: string,
  assessment: AiAssessment,
  isInvestor: boolean,
): Promise<void> {
  await updateApplication(
    id,
    { aiAssessment: stringifyAiAssessment(assessment) },
    isInvestor,
    { allowLocked: true },
  );
}

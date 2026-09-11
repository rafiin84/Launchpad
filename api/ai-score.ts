import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * /api/ai-score — scores one application against a fixed rubric.
 *
 * POST body: { application: {...whitelisted fields...} }
 * → { assessment: { total, verdict, summary, dimensions: [...], model, scoredAt } }
 *
 * The key lives here, server-side, and never reaches the browser. The client
 * sends only the application text and gets back a structured assessment.
 *
 * Env:
 *   ANTHROPIC_API_KEY  required
 *   ANTHROPIC_MODEL    optional; overrides the default below without a deploy
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-5';
const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';

/** Cap on what we will read from any one field, so a pasted essay cannot blow up the prompt. */
const FIELD_CAP = 4000;

/**
 * Exactly what the model is allowed to see, and the label it sees it under.
 *
 * An allowlist rather than "forward the record": an application record also
 * carries reviewer comments, the decision ledger and investor notes, and none
 * of that belongs in a prompt that is supposed to judge the founder's own
 * submission on its merits. It would also leak one reviewer's opinion into a
 * score the next reviewer reads as independent.
 */
const PROMPT_FIELDS: Array<[string, string]> = [
  ['companyName', 'Company'],
  ['companyIndustry', 'Industry'],
  ['companyStage', 'Stage'],
  ['companyLocation', 'Location'],
  ['foundedYear', 'Founded'],
  ['website', 'Website'],
  ['teamSize', 'Team size'],
  ['founderName', 'Founder'],
  ['founderRole', 'Founder role'],
  ['founderBio', 'Founder background'],
  ['aboutCompany', 'About the company'],
  ['problem', 'Problem'],
  ['solution', 'Solution'],
  ['targetMarket', 'Target market'],
  ['businessModel', 'Business model'],
  ['competition', 'Competition'],
  ['traction', 'Traction'],
  ['revenue', 'Revenue'],
  ['mrr', 'MRR'],
  ['arr', 'ARR'],
  ['activeCustomers', 'Active customers'],
  ['growthRate', 'Growth rate'],
  ['burnRate', 'Monthly burn'],
  ['runway', 'Runway'],
  ['fundingAsk', 'Funding ask'],
  ['currentValuation', 'Valuation'],
  ['equityOffered', 'Equity offered'],
  ['previousFunding', 'Previous funding'],
  ['useOfFunds', 'Use of funds'],
];

const DIMENSIONS = ['team', 'market', 'product', 'traction'] as const;

const SYSTEM = `You are an analyst screening early-stage investment applications for a venture fund.

Score the application on four dimensions, 0-100 each:
- team: founder background, relevant experience, team size against stage
- market: size and reachability of the target market, clarity of the problem
- product: whether the solution actually addresses the stated problem, and how defensible it is
- traction: revenue, customers, growth and runway, judged against the company's stage

Then give a total out of 100 as your overall judgement — a weighted read, not an average — and a verdict of "strong", "promising", "weak" or "insufficient_data".

Rules you must follow:
- Judge only what is provided. Never invent a fact, a number, a competitor or a market size.
- Where something material is missing, say so and let it lower the score. An application with no traction data is not a zero on traction; it is unscored evidence, and you should say that in the reasoning.
- Use "insufficient_data" when there is too little to judge at all, rather than guessing a middling score.
- You cannot check any claim against the outside world. Do not imply that you have. Assess what is stated for plausibility and internal consistency only.
- Be concrete and blunt. "No revenue figure given despite claiming Series A stage" is useful; "the team seems promising" is not.

Reply with JSON only, no prose around it, in exactly this shape:
{"total":<0-100>,"verdict":"strong|promising|weak|insufficient_data","summary":"<2-3 sentences on the overall picture>","dimensions":[{"key":"team","score":<0-100>,"reasoning":"<1-2 sentences citing what in the application drove this>"},{"key":"market",...},{"key":"product",...},{"key":"traction",...}]}`;

function buildUserPrompt(app: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, label] of PROMPT_FIELDS) {
    const raw = app[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (!value) continue;
    lines.push(`${label}: ${value.slice(0, FIELD_CAP)}`);
  }
  if (!lines.length) return '';
  return `Application to assess:\n\n${lines.join('\n')}`;
}

/** Pulls the JSON object out of a reply, tolerating a code fence or a stray sentence. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in the model reply');
  return JSON.parse(body.slice(start, end + 1));
}

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

/**
 * Requires a working Zoho CRM token before spending any AI credit.
 *
 * The other functions in this directory are open, which is a problem I would
 * rather not extend to one that costs money per call: unauthenticated, this
 * endpoint is a way for anyone who finds the URL to run up the fund's API bill.
 * A portal (founder) token does not validate here, which also keeps scoring to
 * reviewers and investors — the people the feature is for.
 */
async function callerIsStaff(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/user/info`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(501).json({
      error: 'AI scoring is not configured. Set ANTHROPIC_API_KEY in the '
        + 'deployment environment and redeploy.',
    });
  }

  const auth = String(req.headers.authorization || '');
  const token = auth.replace(/^Zoho-oauthtoken\s+/i, '').trim();
  if (!token || !(await callerIsStaff(token))) {
    return res.status(401).json({ error: 'Sign in with Zoho CRM to use AI scoring.' });
  }

  const body = (req.body ?? {}) as { application?: Record<string, unknown> };
  const application = body.application;
  if (!application || typeof application !== 'object') {
    return res.status(400).json({ error: 'Body must be { application: {...} }' });
  }

  const userPrompt = buildUserPrompt(application);
  if (!userPrompt) {
    return res.status(422).json({
      error: 'This application has no content to assess yet — no description, '
        + 'market, traction or funding detail has been filled in.',
    });
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0,          // a score that moves on re-run is not a score
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const payload = await upstream.json() as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };

    if (!upstream.ok) {
      // Surfaced verbatim: an unknown model name or an expired key is something
      // the person configuring this needs to read, not a generic failure.
      return res.status(upstream.status).json({
        error: payload.error?.message || `AI request failed (${upstream.status})`,
        model,
      });
    }

    const text = (payload.content ?? [])
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('')
      .trim();

    const parsed = extractJson(text) as {
      total?: unknown; verdict?: unknown; summary?: unknown;
      dimensions?: Array<{ key?: unknown; score?: unknown; reasoning?: unknown }>;
    };

    const byKey = new Map(
      (parsed.dimensions ?? []).map(d => [String(d.key ?? ''), d]),
    );
    const verdicts = ['strong', 'promising', 'weak', 'insufficient_data'];
    const verdict = verdicts.includes(String(parsed.verdict)) ? String(parsed.verdict) : 'weak';

    return res.status(200).json({
      assessment: {
        total: clampScore(parsed.total),
        verdict,
        summary: String(parsed.summary ?? '').slice(0, 2000),
        // Always all four, in a fixed order, so the UI never has to cope with
        // a dimension the model happened to omit.
        dimensions: DIMENSIONS.map(key => {
          const d = byKey.get(key);
          return {
            key,
            score: clampScore(d?.score),
            reasoning: String(d?.reasoning ?? 'Not assessed.').slice(0, 1000),
          };
        }),
        model,
        scoredAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'AI scoring failed',
      model,
    });
  }
}

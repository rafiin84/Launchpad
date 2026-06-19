// ─── AI Engine ───────────────────────────────────────────────────────────────
// Client-side rule-based analytics engine that analyzes CRM data and generates
// intelligent insights, scores, suggestions, and auto-generated activities.
// No external API calls — uses heuristics and pattern matching on local data.

import type { CRMActivity } from './crmActivities';
import type { CRMApplication } from './crmApplications';
import type { CRMDeal } from './crmDeals';
import type { CRMPortfolioRecord } from './crmPortfolio';
import type { CRMFounder } from './crmFounders';

// ─── AI Generated Types ─────────────────────────────────────────────────────

export interface AIInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'action' | 'trend' | 'milestone';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  relatedEntity?: string;
  actionLabel?: string;
  actionPath?: string;
  icon: string;
}

export interface AIActivity {
  id: string;
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  tags: string;
  generatedAt: string;
  source: string;
}

export interface AIDealScore {
  dealId: string;
  dealName: string;
  score: number;
  factors: { label: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[];
  recommendation: string;
  predictedOutcome: string;
}

export interface AIApplicationScore {
  applicationId: string;
  companyName: string;
  score: number;
  strengths: string[];
  concerns: string[];
  recommendation: string;
  suggestedStage: string;
}

export interface AIPortfolioInsight {
  type: 'health' | 'diversification' | 'performance' | 'risk';
  title: string;
  description: string;
  metric?: string;
  trend?: 'up' | 'down' | 'stable';
}

export interface AIFounderSuggestion {
  type: 'connect' | 'followup' | 'mentor-match';
  title: string;
  description: string;
  founders: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a string to a number, returning 0 if invalid. */
function num(value: string | undefined | null): number {
  if (!value) return 0;
  const n = parseFloat(value.replace(/[,$]/g, ''));
  return isNaN(n) ? 0 : n;
}

/** Format a number as a compact dollar string. */
function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n > 0) return `$${n.toFixed(0)}`;
  return '$0';
}

/** Deterministic hash from a string — used for stable IDs and variety without randomness. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Generate a stable ID from a prefix and data string. */
function stableId(prefix: string, data: string): string {
  return `${prefix}-${hashStr(data).toString(36)}`;
}

/** Days between now and a date string (positive = future, negative = past). */
function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return Infinity;
  const now = new Date();
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Get full founder name. */
function founderFullName(f: CRMFounder): string {
  return [f.firstName, f.lastName].filter(Boolean).join(' ') || 'Unknown';
}

/** Get the current ISO timestamp string. */
function nowISO(): string {
  return new Date().toISOString();
}

// ─── generateAIActivities ────────────────────────────────────────────────────

export function generateAIActivities(
  portfolio: CRMPortfolioRecord[],
  deals: CRMDeal[],
  applications: CRMApplication[],
  activities: CRMActivity[],
  founders: CRMFounder[],
  userName: string,
): AIActivity[] {
  const result: AIActivity[] = [];
  const now = nowISO();

  // 1. Closed Won deals
  const closedWon = deals.filter(d => d.stage === 'Closed Won');
  for (const deal of closedWon.slice(0, 2)) {
    const amt = num(deal.amount);
    result.push({
      id: stableId('ai-act', `won-${deal.id}`),
      title: `\u{1F3C6} ${deal.dealName || 'A deal'} closed successfully${amt > 0 ? ` worth ${fmtDollars(amt)}` : ''}`,
      activityType: 'win',
      content: `Deal "${deal.dealName}" has reached Closed Won stage.${deal.accountName ? ` Account: ${deal.accountName}.` : ''}${deal.description ? ` ${deal.description}` : ''}`,
      companyName: deal.accountName || deal.dealName || '',
      tags: 'ai-generated,deal-win',
      generatedAt: now,
      source: 'deal-stage-analysis',
    });
  }

  // 2. Portfolio health summary
  if (portfolio.length > 0) {
    const active = portfolio.filter(p => (p.status || '').toLowerCase() !== 'exited');
    const totalInvested = portfolio.reduce((sum, p) => sum + num(p.investmentAmount), 0);
    result.push({
      id: stableId('ai-act', `portfolio-health-${portfolio.length}`),
      title: `\u{1F4CA} Portfolio health check: ${active.length} active companies, ${fmtDollars(totalInvested)} deployed`,
      activityType: 'insight',
      content: `Your portfolio has ${portfolio.length} total companies (${active.length} active, ${portfolio.length - active.length} exited). Total investment: ${fmtDollars(totalInvested)}.`,
      companyName: '',
      tags: 'ai-generated,portfolio-health',
      generatedAt: now,
      source: 'portfolio-analysis',
    });
  }

  // 3. Recent applications (sorted by id descending as proxy for recency)
  const recentApps = applications.slice(0, 3);
  for (const app of recentApps.slice(0, 2)) {
    const ask = num(app.fundingAsk);
    result.push({
      id: stableId('ai-act', `new-app-${app.id}`),
      title: `⚡ New application from ${app.companyName || 'a startup'}${app.industry ? ` in ${app.industry}` : ''}${ask > 0 ? ` — asking ${fmtDollars(ask)}` : ''}`,
      activityType: 'update',
      content: `${app.companyName || 'A startup'} has applied${app.industry ? ` in the ${app.industry} space` : ''}.${app.companyDescription ? ` ${app.companyDescription.slice(0, 200)}` : ''}${app.founderName ? ` Founded by ${app.founderName}.` : ''}`,
      companyName: app.companyName || '',
      tags: 'ai-generated,new-application',
      generatedAt: now,
      source: 'application-intake',
    });
  }

  // 4. Founder intro matches (same industry or same city)
  if (founders.length >= 2) {
    const byIndustry = new Map<string, CRMFounder[]>();
    for (const f of founders) {
      const key = (f.department || f.title || '').toLowerCase().trim();
      if (!key) continue;
      if (!byIndustry.has(key)) byIndustry.set(key, []);
      byIndustry.get(key)!.push(f);
    }
    for (const [industry, group] of byIndustry) {
      if (group.length >= 2 && result.length < 7) {
        const nameA = founderFullName(group[0]);
        const nameB = founderFullName(group[1]);
        result.push({
          id: stableId('ai-act', `intro-${group[0].id}-${group[1].id}`),
          title: `\u{1F517} Potential intro: ${nameA} and ${nameB} are both in ${industry}`,
          activityType: 'introduction',
          content: `Both ${nameA} (${group[0].company || 'N/A'}) and ${nameB} (${group[1].company || 'N/A'}) work in ${industry}. Consider connecting them for mutual benefit.`,
          companyName: '',
          tags: 'ai-generated,founder-intro',
          generatedAt: now,
          source: 'founder-network-analysis',
        });
        break; // only one intro suggestion
      }
    }
  }

  // 5. Deal deadline alerts
  const upcomingDeals = deals
    .filter(d => d.closingDate && d.stage !== 'Closed Won' && d.stage !== 'Closed Lost')
    .map(d => ({ deal: d, days: daysUntil(d.closingDate) }))
    .filter(d => d.days >= 0 && d.days <= 14)
    .sort((a, b) => a.days - b.days);

  for (const { deal, days } of upcomingDeals.slice(0, 2)) {
    if (result.length >= 8) break;
    result.push({
      id: stableId('ai-act', `deadline-${deal.id}`),
      title: `⏰ Deal "${deal.dealName}" closing date approaching in ${days} day${days !== 1 ? 's' : ''}`,
      activityType: 'advice',
      content: `"${deal.dealName}" is set to close on ${deal.closingDate}.${deal.nextStep ? ` Next step: ${deal.nextStep}.` : ' Consider defining next steps.'}${num(deal.amount) > 0 ? ` Deal value: ${fmtDollars(num(deal.amount))}.` : ''}`,
      companyName: deal.accountName || deal.dealName || '',
      tags: 'ai-generated,deadline-alert',
      generatedAt: now,
      source: 'deal-timeline-analysis',
    });
  }

  // 6. Pipeline momentum
  if (applications.length > 0) {
    const pipelineStages = new Map<string, number>();
    for (const app of applications) {
      const stage = app.pipelineStage || 'Unknown';
      pipelineStages.set(stage, (pipelineStages.get(stage) || 0) + 1);
    }
    const stageBreakdown = [...pipelineStages.entries()]
      .map(([stage, count]) => `${stage}: ${count}`)
      .join(', ');
    if (result.length < 8) {
      result.push({
        id: stableId('ai-act', `pipeline-${applications.length}`),
        title: `\u{1F4C8} Pipeline momentum: ${applications.length} application${applications.length !== 1 ? 's' : ''} in pipeline`,
        activityType: 'insight',
        content: `Current pipeline breakdown — ${stageBreakdown}. ${userName ? `Keep the momentum going, ${userName}!` : 'Keep the momentum going!'}`,
        companyName: '',
        tags: 'ai-generated,pipeline-momentum',
        generatedAt: now,
        source: 'pipeline-trend-analysis',
      });
    }
  }

  // 7. Activity engagement summary
  if (activities.length > 0 && result.length < 8) {
    const typeCount = new Map<string, number>();
    for (const a of activities) {
      const t = a.activityType || 'other';
      typeCount.set(t, (typeCount.get(t) || 0) + 1);
    }
    const topType = [...typeCount.entries()].sort((a, b) => b[1] - a[1])[0];
    result.push({
      id: stableId('ai-act', `engagement-${activities.length}`),
      title: `\u{1F4AC} ${activities.length} activities logged${topType ? ` — most common: ${topType[0]}` : ''}`,
      activityType: 'insight',
      content: `You have ${activities.length} activities tracked. ${topType ? `"${topType[0]}" is your most frequent type with ${topType[1]} entries.` : ''}`,
      companyName: '',
      tags: 'ai-generated,engagement',
      generatedAt: now,
      source: 'activity-analysis',
    });
  }

  return result.slice(0, 8);
}

// ─── generateInvestorInsights ────────────────────────────────────────────────

export function generateInvestorInsights(
  portfolio: CRMPortfolioRecord[],
  deals: CRMDeal[],
  applications: CRMApplication[],
): AIInsight[] {
  const insights: AIInsight[] = [];

  // 1. Portfolio concentration risk
  if (portfolio.length > 0) {
    const industries = new Map<string, number>();
    for (const p of portfolio) {
      const ind = p.industry || 'Unknown';
      industries.set(ind, (industries.get(ind) || 0) + 1);
    }
    const topIndustry = [...industries.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topIndustry && topIndustry[1] / portfolio.length > 0.5) {
      insights.push({
        id: stableId('inv-ins', `concentration-${topIndustry[0]}`),
        type: 'risk',
        title: 'Portfolio concentration risk',
        description: `${Math.round((topIndustry[1] / portfolio.length) * 100)}% of your portfolio is in ${topIndustry[0]}. Consider diversifying to reduce sector-specific risk.`,
        priority: 'high',
        category: 'portfolio',
        icon: 'AlertTriangle',
      });
    } else if (topIndustry) {
      insights.push({
        id: stableId('inv-ins', `diversified-${portfolio.length}`),
        type: 'trend',
        title: 'Well-diversified portfolio',
        description: `Your portfolio spans ${industries.size} industries. Top sector: ${topIndustry[0]} (${topIndustry[1]} companies).`,
        priority: 'low',
        category: 'portfolio',
        icon: 'PieChart',
      });
    }
  }

  // 2. Deal pipeline health
  if (deals.length > 0) {
    const openDeals = deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost');
    const totalPipelineValue = openDeals.reduce((sum, d) => sum + num(d.amount), 0);
    const closedWon = deals.filter(d => d.stage === 'Closed Won');
    const winRate = deals.length > 0 ? Math.round((closedWon.length / deals.length) * 100) : 0;

    if (openDeals.length > 0) {
      insights.push({
        id: stableId('inv-ins', `pipeline-${openDeals.length}`),
        type: 'opportunity',
        title: `${openDeals.length} active deal${openDeals.length !== 1 ? 's' : ''} in pipeline`,
        description: `Pipeline value: ${fmtDollars(totalPipelineValue)}. Win rate: ${winRate}%.${winRate < 30 && deals.length >= 5 ? ' Consider improving qualification criteria.' : ''}`,
        priority: totalPipelineValue > 1_000_000 ? 'high' : 'medium',
        category: 'deals',
        actionLabel: 'View Deals',
        actionPath: '/deals',
        icon: 'TrendingUp',
      });
    }

    // Deals without next steps
    const noNextStep = openDeals.filter(d => !d.nextStep);
    if (noNextStep.length > 0) {
      insights.push({
        id: stableId('inv-ins', `no-nextstep-${noNextStep.length}`),
        type: 'action',
        title: `${noNextStep.length} deal${noNextStep.length !== 1 ? 's' : ''} missing next steps`,
        description: `Deals without defined next steps are at risk of stalling. ${noNextStep.slice(0, 3).map(d => `"${d.dealName}"`).join(', ')}${noNextStep.length > 3 ? ` and ${noNextStep.length - 3} more` : ''}.`,
        priority: 'medium',
        category: 'deals',
        actionLabel: 'Review Deals',
        actionPath: '/deals',
        icon: 'ListChecks',
      });
    }
  }

  // 3. Application pipeline
  if (applications.length > 0) {
    const stages = new Map<string, number>();
    for (const app of applications) {
      const s = app.pipelineStage || 'Unknown';
      stages.set(s, (stages.get(s) || 0) + 1);
    }
    const newApps = stages.get('New') || stages.get('Submitted') || 0;
    if (newApps > 0) {
      insights.push({
        id: stableId('inv-ins', `new-apps-${newApps}`),
        type: 'action',
        title: `${newApps} new application${newApps !== 1 ? 's' : ''} awaiting review`,
        description: `You have ${newApps} unreviewed applications. Quick triage helps maintain deal flow momentum.`,
        priority: 'high',
        category: 'applications',
        actionLabel: 'Review Applications',
        actionPath: '/applications',
        icon: 'Inbox',
      });
    }

    // High-value applications
    const highValue = applications.filter(a => num(a.fundingAsk) >= 1_000_000);
    if (highValue.length > 0) {
      insights.push({
        id: stableId('inv-ins', `highval-apps-${highValue.length}`),
        type: 'opportunity',
        title: `${highValue.length} high-value application${highValue.length !== 1 ? 's' : ''} (${fmtDollars(1_000_000)}+)`,
        description: `Notable: ${highValue.slice(0, 3).map(a => `${a.companyName} (${fmtDollars(num(a.fundingAsk))})`).join(', ')}.`,
        priority: 'medium',
        category: 'applications',
        actionLabel: 'View Applications',
        actionPath: '/applications',
        icon: 'Star',
      });
    }
  }

  // 4. Milestone: portfolio size
  if (portfolio.length >= 10) {
    insights.push({
      id: stableId('inv-ins', `milestone-${portfolio.length}`),
      type: 'milestone',
      title: `Portfolio milestone: ${portfolio.length} companies`,
      description: `You've built a portfolio of ${portfolio.length} companies. Well done!`,
      priority: 'low',
      category: 'portfolio',
      icon: 'Trophy',
    });
  }

  // Return at most 6 insights, prioritized
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return insights
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 6);
}

// ─── generateFounderInsights ─────────────────────────────────────────────────

export function generateFounderInsights(
  kpis: { key: string; label: string; value: string }[],
  milestones: { text: string; done: boolean; dueDate: string }[],
): AIInsight[] {
  const insights: AIInsight[] = [];

  // Analyze KPIs
  for (const kpi of kpis) {
    const key = kpi.key.toLowerCase();
    const val = num(kpi.value);

    // Runway warning
    if (key.includes('runway') && val > 0 && val <= 6) {
      insights.push({
        id: stableId('fdr-ins', `runway-${val}`),
        type: 'risk',
        title: 'Runway running low',
        description: `Your runway is ${val} months. Start fundraising conversations now — most rounds take 3–6 months to close.`,
        priority: 'high',
        category: 'finance',
        actionLabel: 'Plan Fundraise',
        icon: 'Clock',
      });
    } else if (key.includes('runway') && val > 6 && val <= 12) {
      insights.push({
        id: stableId('fdr-ins', `runway-ok-${val}`),
        type: 'action',
        title: 'Runway is moderate',
        description: `${val} months of runway remaining. Consider starting to prepare fundraising materials.`,
        priority: 'medium',
        category: 'finance',
        icon: 'Clock',
      });
    }

    // Burn rate concerns
    if (key.includes('burn') && val > 0) {
      insights.push({
        id: stableId('fdr-ins', `burn-${val}`),
        type: 'trend',
        title: `Monthly burn: ${fmtDollars(val)}`,
        description: `You're burning ${fmtDollars(val)}/month. Track this closely and look for efficiency gains where possible.`,
        priority: val > 100_000 ? 'medium' : 'low',
        category: 'finance',
        icon: 'Flame',
      });
    }

    // Revenue growth
    if ((key.includes('mrr') || key.includes('revenue') || key.includes('arr')) && val > 0) {
      insights.push({
        id: stableId('fdr-ins', `revenue-${val}`),
        type: 'milestone',
        title: `${kpi.label}: ${kpi.value}`,
        description: `Keep tracking ${kpi.label}. Consistent growth is the strongest signal for investors.`,
        priority: 'low',
        category: 'growth',
        icon: 'TrendingUp',
      });
    }

    // Users / customers
    if ((key.includes('user') || key.includes('customer') || key.includes('dau') || key.includes('mau')) && val > 0) {
      insights.push({
        id: stableId('fdr-ins', `users-${val}`),
        type: 'trend',
        title: `${kpi.label}: ${kpi.value}`,
        description: `Track engagement and retention alongside user count to build a compelling growth story.`,
        priority: 'low',
        category: 'growth',
        icon: 'Users',
      });
    }
  }

  // Analyze milestones
  const overdue = milestones.filter(m => !m.done && daysUntil(m.dueDate) < 0);
  if (overdue.length > 0) {
    insights.push({
      id: stableId('fdr-ins', `overdue-${overdue.length}`),
      type: 'risk',
      title: `${overdue.length} overdue milestone${overdue.length !== 1 ? 's' : ''}`,
      description: `"${overdue[0].text}"${overdue.length > 1 ? ` and ${overdue.length - 1} more` : ''} ${overdue.length === 1 ? 'is' : 'are'} past due. Update your progress or adjust timelines.`,
      priority: 'high',
      category: 'milestones',
      icon: 'AlertCircle',
    });
  }

  const upcoming = milestones.filter(m => !m.done && daysUntil(m.dueDate) >= 0 && daysUntil(m.dueDate) <= 7);
  if (upcoming.length > 0) {
    insights.push({
      id: stableId('fdr-ins', `upcoming-${upcoming.length}`),
      type: 'action',
      title: `${upcoming.length} milestone${upcoming.length !== 1 ? 's' : ''} due this week`,
      description: `"${upcoming[0].text}"${upcoming.length > 1 ? ` and ${upcoming.length - 1} more` : ''} due soon. Stay on track!`,
      priority: 'medium',
      category: 'milestones',
      icon: 'Calendar',
    });
  }

  const completedCount = milestones.filter(m => m.done).length;
  if (milestones.length > 0 && completedCount > 0) {
    const pct = Math.round((completedCount / milestones.length) * 100);
    insights.push({
      id: stableId('fdr-ins', `progress-${pct}`),
      type: 'milestone',
      title: `${pct}% milestones completed`,
      description: `${completedCount} of ${milestones.length} milestones done. ${pct >= 75 ? 'Great progress!' : 'Keep pushing forward!'}`,
      priority: 'low',
      category: 'milestones',
      icon: 'CheckCircle',
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return insights
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 6);
}

// ─── scoreDeal ───────────────────────────────────────────────────────────────

const DEAL_STAGE_ORDER = [
  'Qualification',
  'Value Proposition',
  'Id. Decision Makers',
  'Perception Analysis',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost',
];

export function scoreDeal(deal: CRMDeal): AIDealScore {
  const factors: AIDealScore['factors'] = [];
  let score = 0;

  // Has amount (10pts)
  if (num(deal.amount) > 0) {
    score += 10;
    factors.push({ label: 'Deal value defined', impact: 'positive', detail: fmtDollars(num(deal.amount)) });
  } else {
    factors.push({ label: 'No deal value set', impact: 'negative', detail: 'Add an amount to track pipeline value' });
  }

  // Has description (10pts)
  if (deal.description && deal.description.trim().length > 10) {
    score += 10;
    factors.push({ label: 'Description provided', impact: 'positive', detail: 'Deal context is documented' });
  } else {
    factors.push({ label: 'Missing description', impact: 'negative', detail: 'Add a description for better tracking' });
  }

  // Has next step (15pts)
  if (deal.nextStep && deal.nextStep.trim()) {
    score += 15;
    factors.push({ label: 'Next step defined', impact: 'positive', detail: deal.nextStep });
  } else {
    factors.push({ label: 'No next step', impact: 'negative', detail: 'Deals without next steps tend to stall' });
  }

  // Probability filled (10pts)
  const prob = num(deal.probability);
  if (prob > 0) {
    score += 10;
    factors.push({ label: 'Probability set', impact: 'positive', detail: `${prob}%` });
  } else {
    factors.push({ label: 'Probability not set', impact: 'neutral', detail: 'Set probability for better forecasting' });
  }

  // Stage progression (20pts) — higher stages = more points
  const stageIdx = DEAL_STAGE_ORDER.indexOf(deal.stage);
  if (stageIdx >= 0 && deal.stage !== 'Closed Lost') {
    const stageScore = Math.round((stageIdx / (DEAL_STAGE_ORDER.length - 2)) * 20);
    score += stageScore;
    factors.push({
      label: 'Stage progression',
      impact: stageScore >= 10 ? 'positive' : 'neutral',
      detail: `${deal.stage} (stage ${stageIdx + 1} of ${DEAL_STAGE_ORDER.length - 1})`,
    });
  } else if (deal.stage === 'Closed Lost') {
    factors.push({ label: 'Deal lost', impact: 'negative', detail: 'This deal was closed as lost' });
  } else {
    factors.push({ label: 'Unknown stage', impact: 'neutral', detail: deal.stage || 'No stage set' });
  }

  // Has account (10pts)
  if (deal.accountName && deal.accountName.trim()) {
    score += 10;
    factors.push({ label: 'Account linked', impact: 'positive', detail: deal.accountName });
  } else {
    factors.push({ label: 'No account linked', impact: 'negative', detail: 'Link an account for better context' });
  }

  // Closing date set (10pts)
  if (deal.closingDate) {
    score += 10;
    factors.push({ label: 'Closing date set', impact: 'positive', detail: deal.closingDate });
  } else {
    factors.push({ label: 'No closing date', impact: 'negative', detail: 'Set a target close date' });
  }

  // Closing date is in the future (15pts)
  if (deal.closingDate) {
    const days = daysUntil(deal.closingDate);
    if (days >= 0) {
      score += 15;
      factors.push({ label: 'Closing date is upcoming', impact: 'positive', detail: `${days} days away` });
    } else {
      factors.push({ label: 'Closing date has passed', impact: 'negative', detail: `${Math.abs(days)} days overdue` });
    }
  }

  // Cap at 100
  score = Math.min(100, score);

  // Generate recommendation
  let recommendation: string;
  let predictedOutcome: string;

  if (deal.stage === 'Closed Won') {
    recommendation = 'Deal successfully closed. Document learnings and transition to portfolio management.';
    predictedOutcome = 'Closed Won';
    score = 100;
  } else if (deal.stage === 'Closed Lost') {
    recommendation = 'Conduct a post-mortem to identify improvement areas for future deals.';
    predictedOutcome = 'Closed Lost';
    score = Math.min(score, 15);
  } else if (score >= 75) {
    recommendation = 'Strong deal with good fundamentals. Focus on advancing to the next stage.';
    predictedOutcome = 'High likelihood of closing';
  } else if (score >= 50) {
    recommendation = 'Decent deal but missing some key elements. Fill in the gaps to improve chances.';
    predictedOutcome = 'Moderate likelihood — needs attention';
  } else if (score >= 25) {
    recommendation = 'This deal needs work. Prioritize adding next steps, description, and closing date.';
    predictedOutcome = 'At risk — significant gaps';
  } else {
    recommendation = 'Incomplete deal record. Add basic information to enable proper tracking.';
    predictedOutcome = 'Too early to assess';
  }

  return {
    dealId: deal.id,
    dealName: deal.dealName || 'Untitled Deal',
    score,
    factors,
    recommendation,
    predictedOutcome,
  };
}

// ─── scoreApplication ────────────────────────────────────────────────────────

export function scoreApplication(app: CRMApplication): AIApplicationScore {
  let score = 0;
  const strengths: string[] = [];
  const concerns: string[] = [];

  // Has description (15pts)
  if (app.companyDescription && app.companyDescription.trim().length > 20) {
    score += 15;
    strengths.push('Detailed company description provided');
  } else {
    concerns.push('Missing or very brief company description');
  }

  // Funding ask is reasonable (10pts) — between $10K and $50M
  const ask = num(app.fundingAsk);
  if (ask >= 10_000 && ask <= 50_000_000) {
    score += 10;
    strengths.push(`Funding ask of ${fmtDollars(ask)} is within reasonable range`);
  } else if (ask > 0) {
    concerns.push(`Funding ask of ${fmtDollars(ask)} may need review`);
  } else {
    concerns.push('No funding ask specified');
  }

  // Has website (10pts)
  if (app.website && app.website.trim()) {
    score += 10;
    strengths.push('Website provided for due diligence');
  } else {
    concerns.push('No website — harder to evaluate online presence');
  }

  // Has video (10pts)
  if (app.pitchVideoUrl && app.pitchVideoUrl.trim()) {
    score += 10;
    strengths.push('Pitch video included');
  } else {
    concerns.push('No pitch video submitted');
  }

  // Has founder contact (10pts)
  if (app.founderEmail || app.founderPhone) {
    score += 10;
    strengths.push('Founder contact information available');
  } else {
    concerns.push('No founder contact details');
  }

  // Team size > 1 (10pts)
  const teamSize = num(app.teamSize);
  if (teamSize > 1) {
    score += 10;
    strengths.push(`Team of ${teamSize} people`);
  } else if (teamSize === 1) {
    score += 5;
    concerns.push('Solo founder — team risk is higher');
  } else {
    concerns.push('Team size not specified');
  }

  // Has use of funds (15pts)
  if (app.useOfFunds && app.useOfFunds.trim().length > 10) {
    score += 15;
    strengths.push('Clear use of funds described');
  } else {
    concerns.push('No use of funds breakdown');
  }

  // Has industry (10pts)
  if (app.industry && app.industry.trim()) {
    score += 10;
    strengths.push(`Operating in ${app.industry}`);
  } else {
    concerns.push('Industry not specified');
  }

  // Has location (10pts)
  if (app.location && app.location.trim()) {
    score += 10;
    strengths.push(`Based in ${app.location}`);
  } else {
    concerns.push('Location not specified');
  }

  score = Math.min(100, score);

  // Generate recommendation
  let recommendation: string;
  let suggestedStage: string;

  if (score >= 80) {
    recommendation = 'Strong application with comprehensive information. Recommend advancing to interview stage.';
    suggestedStage = 'Interview';
  } else if (score >= 60) {
    recommendation = 'Promising application but some details are missing. Request additional information before advancing.';
    suggestedStage = 'Under Review';
  } else if (score >= 40) {
    recommendation = 'Application has gaps. Consider requesting more details or a follow-up call.';
    suggestedStage = 'Needs More Info';
  } else {
    recommendation = 'Incomplete application. Major information is missing for proper evaluation.';
    suggestedStage = 'Incomplete';
  }

  return {
    applicationId: app.id,
    companyName: app.companyName || 'Unknown Company',
    score,
    strengths,
    concerns,
    recommendation,
    suggestedStage,
  };
}

// ─── analyzePortfolio ────────────────────────────────────────────────────────

export function analyzePortfolio(portfolio: CRMPortfolioRecord[]): AIPortfolioInsight[] {
  if (portfolio.length === 0) {
    return [{
      type: 'health',
      title: 'No portfolio companies yet',
      description: 'Start building your portfolio by adding companies from deals or directly.',
    }];
  }

  const insights: AIPortfolioInsight[] = [];

  // 1. Industry diversification
  const industries = new Map<string, number>();
  for (const p of portfolio) {
    const ind = p.industry || 'Unknown';
    industries.set(ind, (industries.get(ind) || 0) + 1);
  }

  if (industries.size === 1) {
    insights.push({
      type: 'diversification',
      title: 'Single-industry portfolio',
      description: `All ${portfolio.length} companies are in ${[...industries.keys()][0]}. High sector concentration increases risk.`,
      trend: 'down',
    });
  } else {
    const topIndustry = [...industries.entries()].sort((a, b) => b[1] - a[1])[0];
    const pct = Math.round((topIndustry[1] / portfolio.length) * 100);
    insights.push({
      type: 'diversification',
      title: `Portfolio spans ${industries.size} industries`,
      description: `Top sector: ${topIndustry[0]} (${pct}% of portfolio, ${topIndustry[1]} companies).${pct > 60 ? ' Consider diversifying further.' : ''}`,
      metric: `${industries.size} industries`,
      trend: pct > 60 ? 'down' : 'stable',
    });
  }

  // 2. Stage distribution
  const stages = new Map<string, number>();
  for (const p of portfolio) {
    const s = p.stage || 'Unknown';
    stages.set(s, (stages.get(s) || 0) + 1);
  }
  const stageList = [...stages.entries()].sort((a, b) => b[1] - a[1]);
  insights.push({
    type: 'performance',
    title: 'Stage distribution',
    description: stageList.map(([s, c]) => `${s}: ${c}`).join(', '),
    metric: `${stageList.length} stages`,
  });

  // 3. Active vs exited ratio
  const active = portfolio.filter(p => (p.status || '').toLowerCase() !== 'exited');
  const exited = portfolio.length - active.length;
  insights.push({
    type: 'health',
    title: `${active.length} active, ${exited} exited`,
    description: `${Math.round((active.length / portfolio.length) * 100)}% of your portfolio is actively managed.${exited > 0 ? ` ${exited} exit${exited !== 1 ? 's' : ''} recorded.` : ''}`,
    metric: `${active.length}/${portfolio.length}`,
    trend: active.length > exited ? 'up' : 'stable',
  });

  // 4. Total deployed capital
  const totalInvested = portfolio.reduce((sum, p) => sum + num(p.investmentAmount), 0);
  const avgInvestment = portfolio.length > 0 ? totalInvested / portfolio.length : 0;
  if (totalInvested > 0) {
    insights.push({
      type: 'performance',
      title: `${fmtDollars(totalInvested)} total deployed`,
      description: `Average investment: ${fmtDollars(avgInvestment)} across ${portfolio.length} companies.`,
      metric: fmtDollars(totalInvested),
      trend: 'stable',
    });
  }

  // 5. Concentration risk by single company
  if (totalInvested > 0) {
    const largest = portfolio.reduce((max, p) => {
      const amt = num(p.investmentAmount);
      return amt > max.amount ? { name: p.companyName, amount: amt } : max;
    }, { name: '', amount: 0 });
    const largestPct = Math.round((largest.amount / totalInvested) * 100);
    if (largestPct > 40 && portfolio.length > 1) {
      insights.push({
        type: 'risk',
        title: `${largest.name} represents ${largestPct}% of deployed capital`,
        description: `Single-company concentration above 40% increases portfolio risk. Consider rebalancing.`,
        metric: `${largestPct}%`,
        trend: 'down',
      });
    }
  }

  // 6. Companies without investment amounts
  const noAmount = portfolio.filter(p => num(p.investmentAmount) === 0);
  if (noAmount.length > 0) {
    insights.push({
      type: 'risk',
      title: `${noAmount.length} companies without investment amounts`,
      description: `${noAmount.slice(0, 3).map(p => p.companyName).join(', ')}${noAmount.length > 3 ? ` and ${noAmount.length - 3} more` : ''} have no investment amount recorded.`,
    });
  }

  return insights;
}

// ─── suggestFounderConnections ───────────────────────────────────────────────

export function suggestFounderConnections(founders: CRMFounder[]): AIFounderSuggestion[] {
  if (founders.length < 2) return [];

  const suggestions: AIFounderSuggestion[] = [];

  // 1. Match by industry (department field)
  const byDepartment = new Map<string, CRMFounder[]>();
  for (const f of founders) {
    const dept = (f.department || '').toLowerCase().trim();
    if (!dept) continue;
    if (!byDepartment.has(dept)) byDepartment.set(dept, []);
    byDepartment.get(dept)!.push(f);
  }
  for (const [dept, group] of byDepartment) {
    if (group.length >= 2) {
      suggestions.push({
        type: 'connect',
        title: `Connect founders in ${dept}`,
        description: `${group.length} founders work in ${dept}. They could benefit from sharing industry insights and experiences.`,
        founders: group.slice(0, 4).map(founderFullName),
      });
    }
  }

  // 2. Match by company (co-founders or same org)
  const byCompany = new Map<string, CRMFounder[]>();
  for (const f of founders) {
    const co = (f.company || '').toLowerCase().trim();
    if (!co) continue;
    if (!byCompany.has(co)) byCompany.set(co, []);
    byCompany.get(co)!.push(f);
  }
  for (const [company, group] of byCompany) {
    if (group.length >= 2) {
      suggestions.push({
        type: 'connect',
        title: `${group.length} contacts at ${group[0].company || company}`,
        description: `Multiple founders/contacts at the same company. Verify if they're co-founders or distinct contacts.`,
        founders: group.slice(0, 4).map(founderFullName),
      });
    }
  }

  // 3. Match by location (city)
  const byCity = new Map<string, CRMFounder[]>();
  for (const f of founders) {
    const city = (f.mailingCity || '').toLowerCase().trim();
    if (!city) continue;
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city)!.push(f);
  }
  for (const [city, group] of byCity) {
    if (group.length >= 2) {
      suggestions.push({
        type: 'connect',
        title: `${group.length} founders in ${group[0].mailingCity || city}`,
        description: `Multiple founders based in ${group[0].mailingCity || city}. Consider a local meetup or introduction.`,
        founders: group.slice(0, 4).map(founderFullName),
      });
    }
  }

  // 4. Follow-up suggestions for founders without recent contact
  const foundersWithEmail = founders.filter(f => f.email);
  const foundersWithoutDesc = foundersWithEmail.filter(f => !f.description || f.description.trim().length < 10);
  if (foundersWithoutDesc.length > 0) {
    suggestions.push({
      type: 'followup',
      title: `${foundersWithoutDesc.length} founder${foundersWithoutDesc.length !== 1 ? 's' : ''} need profile enrichment`,
      description: `These founders have limited notes/descriptions. Schedule follow-ups to learn more about their ventures.`,
      founders: foundersWithoutDesc.slice(0, 5).map(founderFullName),
    });
  }

  // 5. Mentor matching — pair experienced (have title) with newer founders
  const withTitle = founders.filter(f => f.title && f.title.toLowerCase().includes('ceo'));
  const nonCeo = founders.filter(f => f.title && !f.title.toLowerCase().includes('ceo'));
  if (withTitle.length > 0 && nonCeo.length > 0) {
    suggestions.push({
      type: 'mentor-match',
      title: 'Potential mentor pairing opportunity',
      description: `Match experienced CEOs with other founders for mentorship and knowledge sharing.`,
      founders: [...withTitle.slice(0, 2).map(founderFullName), ...nonCeo.slice(0, 2).map(founderFullName)],
    });
  }

  return suggestions;
}

// ─── generateWeeklySummary ───────────────────────────────────────────────────

export function generateWeeklySummary(
  portfolio: CRMPortfolioRecord[],
  deals: CRMDeal[],
  applications: CRMApplication[],
  activities: CRMActivity[],
): {
  title: string;
  highlights: string[];
  actionItems: string[];
  metrics: { label: string; value: string; change?: string }[];
} {
  const highlights: string[] = [];
  const actionItems: string[] = [];

  // Metrics
  const activePortfolio = portfolio.filter(p => (p.status || '').toLowerCase() !== 'exited');
  const totalInvested = portfolio.reduce((sum, p) => sum + num(p.investmentAmount), 0);
  const openDeals = deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost');
  const pipelineValue = openDeals.reduce((sum, d) => sum + num(d.amount), 0);
  const closedWon = deals.filter(d => d.stage === 'Closed Won');
  const closedLost = deals.filter(d => d.stage === 'Closed Lost');

  const metrics: { label: string; value: string; change?: string }[] = [
    { label: 'Portfolio Companies', value: `${activePortfolio.length}` },
    { label: 'Total Deployed', value: fmtDollars(totalInvested) },
    { label: 'Active Deals', value: `${openDeals.length}` },
    { label: 'Pipeline Value', value: fmtDollars(pipelineValue) },
    { label: 'Applications', value: `${applications.length}` },
    { label: 'Activities Logged', value: `${activities.length}` },
  ];

  // Highlights
  if (closedWon.length > 0) {
    highlights.push(`${closedWon.length} deal${closedWon.length !== 1 ? 's' : ''} closed won — ${closedWon.map(d => d.dealName).join(', ')}`);
  }
  if (activePortfolio.length > 0) {
    highlights.push(`${activePortfolio.length} active portfolio companies being managed`);
  }
  if (applications.length > 0) {
    highlights.push(`${applications.length} application${applications.length !== 1 ? 's' : ''} in the pipeline`);
  }
  if (activities.length > 0) {
    highlights.push(`${activities.length} activities logged across the platform`);
  }
  if (highlights.length === 0) {
    highlights.push('Getting started — add deals, applications, or portfolio companies to see insights');
  }

  // Action items
  const dealsNoNextStep = openDeals.filter(d => !d.nextStep);
  if (dealsNoNextStep.length > 0) {
    actionItems.push(`Define next steps for ${dealsNoNextStep.length} deal${dealsNoNextStep.length !== 1 ? 's' : ''}`);
  }

  const approachingDeals = openDeals.filter(d => {
    const days = daysUntil(d.closingDate);
    return days >= 0 && days <= 7;
  });
  if (approachingDeals.length > 0) {
    actionItems.push(`${approachingDeals.length} deal${approachingDeals.length !== 1 ? 's' : ''} closing within 7 days — review and prepare`);
  }

  const overdueDeals = openDeals.filter(d => d.closingDate && daysUntil(d.closingDate) < 0);
  if (overdueDeals.length > 0) {
    actionItems.push(`${overdueDeals.length} deal${overdueDeals.length !== 1 ? 's' : ''} past closing date — update or close`);
  }

  if (closedLost.length > 0) {
    actionItems.push(`Review ${closedLost.length} lost deal${closedLost.length !== 1 ? 's' : ''} for learnings`);
  }

  if (actionItems.length === 0) {
    actionItems.push('All clear — keep building your pipeline and portfolio');
  }

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const title = `Weekly Summary — Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return { title, highlights, actionItems, metrics };
}

/**
 * A company's milestones — achievements and upcoming targets — kept as a JSON
 * array in one large-text field (`Milestones`) on its Companies record, the same
 * pattern as Timeline_Events and Cash_Flows. Pure functions, no I/O.
 *
 * Completion status is never stored: it is worked out from the dates so it can
 * never disagree with them. A milestone with a completed date is Completed;
 * otherwise it is Overdue if its target date has passed, else Upcoming.
 */
export interface Milestone {
  id: string;
  title: string;
  description: string;
  /** YYYY-MM-DD, or '' when no target was set. */
  targetDate: string;
  /** YYYY-MM-DD when it was achieved, else ''. */
  completedDate: string;
  createdAt: string;
}

export type MilestoneStatus = 'completed' | 'upcoming' | 'overdue';

export const MAX_MILESTONE_CHARS = 30_000;
export class MilestonesFullError extends Error {
  constructor() { super('MILESTONES_FULL'); this.name = 'MilestonesFullError'; }
}

const asString = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const asDate = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}/.test(asString(v)) ? asString(v).slice(0, 10) : '');

/** Tolerant: malformed entries are dropped, never thrown. */
export function parseMilestones(json: string): Milestone[] {
  if (!json || !json.trim()) return [];
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: Milestone[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const title = asString(m.title).trim();
    if (!title) continue;
    out.push({
      id: asString(m.id) || `ms_${out.length}`, title, description: asString(m.description),
      targetDate: asDate(m.targetDate), completedDate: asDate(m.completedDate), createdAt: asString(m.createdAt),
    });
  }
  return out;
}

export function milestoneStatus(m: Milestone, today: string): MilestoneStatus {
  if (m.completedDate) return 'completed';
  if (m.targetDate && m.targetDate < today) return 'overdue';
  return 'upcoming';
}

/**
 * Open milestones first (soonest target first, undated last), then achievements
 * newest first.
 */
export function sortMilestones(list: Milestone[], today: string): Milestone[] {
  const open = list.filter(m => milestoneStatus(m, today) !== 'completed')
    .sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999'));
  const done = list.filter(m => milestoneStatus(m, today) === 'completed')
    .sort((a, b) => b.completedDate.localeCompare(a.completedDate));
  return [...open, ...done];
}

export function stringifyMilestones(list: Milestone[]): string {
  const json = JSON.stringify(list);
  if (json.length > MAX_MILESTONE_CHARS) throw new MilestonesFullError();
  return json;
}

export const newMilestoneId = () => `ms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export interface MilestoneInput { title: string; description: string; targetDate: string; completedDate: string }

export function buildMilestone(input: MilestoneInput, now: Date = new Date()): Milestone {
  return {
    id: newMilestoneId(), title: input.title.trim(), description: input.description.trim(),
    targetDate: asDate(input.targetDate), completedDate: asDate(input.completedDate), createdAt: now.toISOString(),
  };
}

/** completed / total, as a whole percentage; null with no milestones. */
export function completionPct(list: Milestone[]): number | null {
  return list.length === 0 ? null : Math.round((list.filter(m => m.completedDate).length / list.length) * 100);
}

/**
 * A company's timeline — investments, valuation updates, finance reports,
 * milestones, meetings, notes and follow-ups — kept as a JSON array in one
 * large-text field (`Timeline_Events`) on the Portfolio_Management record. The
 * same pattern the app uses for Requested_Documents and Financial_Data: it keeps
 * Portfolio Management a single module instead of needing a child module.
 *
 * Pure functions, no I/O.
 */
export const EVENT_TYPES = [
  'Initial Investment', 'Follow-on Investment', 'Valuation Update', 'Finance Report',
  'Milestone', 'Call', 'Meeting', 'Exit', 'Note', 'Follow-up', 'Other',
] as const;
/** The event types a person logs by hand as an interaction with the company. */
export const INTERACTION_TYPES = ['Call', 'Meeting', 'Note', 'Follow-up', 'Other'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  /** YYYY-MM-DD. For a Follow-up this is the due date. */
  date: string;
  amount: number | null;
  details: string;
  link: string;
  /** ISO timestamp the event was recorded (as opposed to when it happened). */
  createdAt: string;
}

/**
 * A large-text field holds 32,000 characters. Stay clear of the limit so a save
 * never fails halfway: refuse to add an event rather than silently drop history.
 */
export const MAX_TIMELINE_CHARS = 30_000;

export class TimelineFullError extends Error {
  constructor() {
    super('TIMELINE_FULL');
    this.name = 'TimelineFullError';
  }
}

const asString = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Tolerant: anything malformed in the stored JSON is dropped, never thrown. */
export function parseTimeline(json: string): TimelineEvent[] {
  if (!json || !json.trim()) return [];
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const events: TimelineEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const title = asString(e.title).trim();
    if (!title) continue;
    const amount = e.amount === null || e.amount === undefined || e.amount === '' ? null : Number(e.amount);
    events.push({
      id: asString(e.id) || `ev_${events.length}`,
      type: asString(e.type) || 'Other',
      title,
      date: asString(e.date),
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      details: asString(e.details),
      link: asString(e.link),
      createdAt: asString(e.createdAt),
    });
  }
  return sortTimeline(events);
}

/** Newest first; events with no date sink to the bottom. */
export function sortTimeline(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
  });
}

export function stringifyTimeline(events: TimelineEvent[]): string {
  const json = JSON.stringify(events);
  if (json.length > MAX_TIMELINE_CHARS) throw new TimelineFullError();
  return json;
}

export function newEventId(): string {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface NewEventInput {
  type: string;
  title: string;
  date: string;
  details?: string;
  amount?: number | null;
  link?: string;
}

export function buildEvent(input: NewEventInput, now: Date = new Date()): TimelineEvent {
  return {
    id: newEventId(),
    type: input.type,
    title: input.title.trim(),
    date: input.date,
    amount: input.amount ?? null,
    details: (input.details ?? '').trim(),
    link: (input.link ?? '').trim(),
    createdAt: now.toISOString(),
  };
}

/** Existing events + one new one, as the JSON to store. Throws TimelineFullError if it won't fit. */
export function appendEvent(existingJson: string, input: NewEventInput, now: Date = new Date()): string {
  return stringifyTimeline([...parseTimeline(existingJson), buildEvent(input, now)]);
}

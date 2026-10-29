/**
 * Rename registry: "this person used to be called X, they are now called Y".
 *
 * People's names are saved as plain text on activities, documents, notifications,
 * review history and in message text, so renaming someone in CRM leaves the old
 * name on everything. CRM does keep a live reference to the user who created each
 * record (`Created_By`); wherever a record's saved author name differs from that
 * creator's CURRENT name, that pair is a rename. Collecting those pairs lets the
 * app swap old for new wherever it shows a name — including inside text that was
 * written once and never re-rendered (notification messages, message notes).
 *
 * Two sources feed it:
 *  - every record the app loads that carries both a saved name and `Created_By`
 *    (`learnRename`, called from liveAuthorName) — works for every viewer;
 *  - for investor-side sessions, a scan of recent records with the investor's own
 *    token (`ensureRenamesLoaded`) so the registry is complete before first render.
 * Founders can't read other users' records or the CRM user list, so for them the
 * registry holds only what the feed they can see teaches it.
 */
import { zohoList } from './zohoApi';
import { loadRole } from './oauth';

const PLACEHOLDERS = new Set(['user', 'investor', 'founder', 'admin', 'unknown', 'general', 'reviewer']);
const SCAN_PAGES = 3;               // × 200 records per module
const RESCAN_MS = 5 * 60 * 1000;

const renames = new Map<string, string>();   // old name → current name
const ambiguous = new Set<string>();         // old names that map to >1 person: never rewrite
const liveNames = new Set<string>();         // names someone holds right now: never rewrite
const listeners = new Set<() => void>();
let version = 0;

const norm = (s: string) => s.trim().toLowerCase();
const notify = () => { version++; listeners.forEach(l => l()); };

export function subscribeRenames(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export const renamesVersion = () => version;

export function learnRename(from: string, to: string): void {
  const f = from.trim();
  const t = to.trim();
  if (!f || !t || norm(f) === norm(t)) return;
  const addedLive = !liveNames.has(norm(t));
  liveNames.add(norm(t));
  if (f.length < 4 || PLACEHOLDERS.has(norm(f)) || ambiguous.has(f)) { if (addedLive) notify(); return; }
  const existing = renames.get(f);
  if (existing && existing !== t) {          // same old name, two different people
    renames.delete(f);
    ambiguous.add(f);
    notify();
    return;
  }
  if (!existing) { renames.set(f, t); notify(); } else if (addedLive) notify();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Swap every known old name in `text` for the person's current name. */
export function applyRenames(text: string | undefined | null): string {
  if (!text) return text ?? '';
  let out = text;
  // Longest first so "Kumar Vembu Jr" is handled before "Kumar Vembu".
  const entries = [...renames.entries()]
    .filter(([from]) => !liveNames.has(norm(from)))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    if (!out.includes(from)) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(from)}(?![\\p{L}\\p{N}])`, 'gu'), to);
  }
  return out;
}

interface ScanRow { Author_Name?: string | null; Author_Role?: string | null; Created_By?: { name?: string | null } | null }

let scan: { at: number; promise: Promise<void> } | null = null;

async function scanModule(module: string, keep: (r: ScanRow) => boolean): Promise<void> {
  const pages = await Promise.all(Array.from({ length: SCAN_PAGES }, (_, i) =>
    zohoList(module, {
      fields: 'Author_Name,Author_Role,Created_By',
      per_page: '200', page: String(i + 1), sort_by: 'Created_Time', sort_order: 'desc',
    }).catch(() => [] as unknown[]),
  ));
  for (const r of (pages.flat() as ScanRow[])) {
    if (!keep(r)) continue;
    learnRename(String(r.Author_Name ?? ''), String(r.Created_By?.name ?? ''));
  }
}

/**
 * Investor-side: scan recent records once (re-scans after a few minutes) so the
 * registry is complete before names are rendered. A no-op for founders, who
 * can't read these modules — and it never throws, a failed scan only means
 * fewer renames are known.
 */
export function ensureRenamesLoaded(): Promise<void> {
  if (loadRole() !== 'investor') return Promise.resolve();
  if (scan && Date.now() - scan.at < RESCAN_MS) return scan.promise;
  const promise = (async () => {
    const role = (r: ScanRow) => norm(String(r.Author_Role ?? ''));
    await Promise.all([
      // Founder posts are relayed by a workflow, so Created_By on the My_Activities
      // copy is not the author — trust investor-side rows only.
      scanModule('My_Activities', r => role(r) === 'investor'),
      // The relay's input records are created by the founder's own portal session.
      scanModule('Feed_Submissions', r => role(r) === 'founder'),
      // Documents are created directly by whoever uploaded them.
      scanModule('My_Documents', () => true),
    ]);
  })().catch(() => { /* fewer renames known, nothing breaks */ });
  scan = { at: Date.now(), promise };
  return promise;
}

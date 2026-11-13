/**
 * A company's milestones live on its Founder_Companies record (`Milestones`, a
 * JSON array — see lib/milestones.ts), so the company's details stay in one
 * place and BOTH sides edit the same field: the founder with their portal token
 * on their own record, the investor with their own token on the founder's record.
 * The profile save in companyProfile.ts deliberately never touches this field, so
 * editing a profile can't overwrite milestones.
 */
import { zohoGetById, zohoUpdate, portalGetById, portalUpdate } from './zohoApi';
import { loadRole } from './oauth';

const MODULE = 'Founder_Companies';
const FIELD = 'Milestones';
const isFounder = () => loadRole() === 'founder';

/** Zoho accepted the write but the field did not change — a portal field permission is missing. */
export class FieldNotSavedError extends Error {
  constructor() { super('FIELD_NOT_SAVED'); this.name = 'FieldNotSavedError'; }
}

/** The stored JSON ('' when none). Always a fresh read — the caller changes it and writes it back. */
export async function fetchMilestonesJson(founderCompanyId: string): Promise<string> {
  const r = isFounder() ? await portalGetById(MODULE, founderCompanyId, FIELD) : await zohoGetById(MODULE, founderCompanyId, FIELD);
  const v = r?.[FIELD];
  return v === null || v === undefined ? '' : String(v);
}

/**
 * Write the list. For a founder, read it straight back: Zoho silently drops a
 * field the portal profile has no write permission on, and a "saved" milestone
 * that never reached CRM is worse than an error.
 */
export async function saveMilestonesJson(founderCompanyId: string, json: string): Promise<void> {
  if (!isFounder()) { await zohoUpdate(MODULE, founderCompanyId, { [FIELD]: json }); return; }
  await portalUpdate(MODULE, founderCompanyId, { [FIELD]: json });
  if ((await fetchMilestonesJson(founderCompanyId)) !== json) throw new FieldNotSavedError();
}

/**
 * A company's milestones live on its Founder_Companies record (`Milestones`, a
 * JSON array — see lib/milestones.ts), so the company's details stay in one
 * place. The investor reads and writes them with their own token; the profile
 * save in companyProfile.ts deliberately never touches this field, so editing a
 * profile can't overwrite milestones.
 */
import { zohoGetById, zohoUpdate } from './zohoApi';

const MODULE = 'Founder_Companies';
const FIELD = 'Milestones';

/** The stored JSON ('' when none). Always a fresh read — the caller changes it and writes it back. */
export async function fetchMilestonesJson(founderCompanyId: string): Promise<string> {
  const r = await zohoGetById(MODULE, founderCompanyId, FIELD);
  const v = r?.[FIELD];
  return v === null || v === undefined ? '' : String(v);
}

export function saveMilestonesJson(founderCompanyId: string, json: string): Promise<void> {
  return zohoUpdate(MODULE, founderCompanyId, { [FIELD]: json });
}

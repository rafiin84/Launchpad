/**
 * The name to show for whoever wrote a CRM record.
 *
 * Activities, documents and notifications all store `Author_Name` as plain text
 * at the moment the record is written, so renaming a person in CRM leaves their
 * old name on everything they ever posted. CRM, however, keeps a live reference
 * to the user who created each record (`Created_By`) — and that always carries
 * the user's current name. For records written by an investor-side user (who is
 * a real CRM user) that is the authoritative name, so prefer it and fall back
 * to the saved text only when the reference is missing.
 *
 * Founders are not CRM users — records they post are created through a portal
 * relay, so `Created_By` there is not the founder — so their saved name is kept.
 *
 * `Created_By` arrives in two shapes depending on how the record was fetched:
 *  - list/get: an object whose `name` is the full name;
 *  - COQL: the object's `name` is only the last name, so the query selects
 *    `Created_By.first_name` / `Created_By.last_name` as flat keys instead.
 */
export const CREATED_BY_COQL_FIELDS = 'Created_By.first_name, Created_By.last_name';

export function liveAuthorName(
  record: Record<string, unknown>,
  savedName: string,
  savedRole: string,
): string {
  if (String(savedRole || '').trim().toLowerCase() !== 'investor') return savedName;

  const first = String(record['Created_By.first_name'] ?? '').trim();
  const last = String(record['Created_By.last_name'] ?? '').trim();
  const joined = `${first} ${last}`.trim();
  if (joined) return joined;

  const createdBy = record['Created_By'];
  if (createdBy && typeof createdBy === 'object') {
    const name = String((createdBy as Record<string, unknown>)['name'] ?? '').trim();
    if (name) return name;
  }
  return savedName;
}

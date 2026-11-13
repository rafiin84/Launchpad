import { zohoSearch, portalList, portalSearch } from './zohoApi';
import { loadRole } from './oauth';

const MODULE = 'Founder_Companies';
const isPortalUser = () => loadRole() === 'founder';
const ID_CACHE = new Map<string, string>();

/**
 * Finds the Founder_Companies record that holds a company's financials.
 *
 * Both sides resolve through this one function, from the same email, so they
 * land on the SAME record: the founder passes their own login address, and the
 * investor's Company page passes the portfolio's Founder_Email. That shared
 * key is what makes a founder's update appear on the investor's page — there
 * is no second copy to reconcile.
 */
export async function findCompanyRecordIdForEmail(email: string): Promise<string | null> {
  const key = email.trim();
  if (!key) return null;
  const cached = ID_CACHE.get(key.toLowerCase());
  if (cached) return cached;
  try {
    let id: string | null = null;
    if (isPortalUser()) {
      // A portal user can only see their own Founder_Companies record, so the
      // plain list is the cheapest way to find it. Search is the fallback for
      // a portal whose sharing rules return more than one.
      const own = await portalList(MODULE, { per_page: '1', fields: 'Email' })
        .catch(() => [] as { id?: string }[]);
      id = (own[0]?.id as string | undefined) ?? null;
      if (!id) {
        const found = await portalSearch(MODULE, `(Email:equals:${key})`);
        id = (found[0]?.id as string | undefined) ?? null;
      }
    } else {
      const found = await zohoSearch(MODULE, `(Email:equals:${key})`);
      id = (found[0]?.id as string | undefined) ?? null;
    }
    // Only a hit is cached. A miss must stay uncached, or a founder who
    // creates their company profile mid-session would keep reading as absent.
    if (id) ID_CACHE.set(key.toLowerCase(), id);
    return id;
  } catch (err) {
    // A null renders as "no company record yet", which is a real state — so a
    // lookup that failed for another reason (no portal access, CRM error)
    // would be invisible. Log it so it is at least diagnosable.
    console.warn('[founder-company lookup] company record lookup failed for', key, err);
    return null;
  }
}

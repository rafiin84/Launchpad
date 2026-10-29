import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCrmUserDirectory } from '../services/zohoApi';

/**
 * Resolves a stored person-name to that person's CURRENT name in CRM, by email.
 *
 * Review history (the review ledger, finance entries) saves the reviewer's name
 * as text next to their email when they act, so a later rename in CRM would
 * leave the old name behind. The email never changes, so look the name up from
 * the live CRM user list instead and fall back to the saved text when there is
 * no match (founders can't read the user list, and old entries may have no email).
 */
export function useLiveNames(): (email: string | undefined, savedName: string) => string {
  const { isInvestor } = useAuth();
  const [byEmail, setByEmail] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isInvestor) return;
    let cancelled = false;
    fetchCrmUserDirectory()
      .then(users => { if (!cancelled) setByEmail(new Map(users.map(u => [u.email.toLowerCase(), u.full_name]))); })
      .catch(() => { /* keep the saved names */ });
    return () => { cancelled = true; };
  }, [isInvestor]);

  return useCallback(
    (email, savedName) => (email && byEmail.get(email.trim().toLowerCase())) || savedName,
    [byEmail],
  );
}

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { applyRenames, ensureRenamesLoaded, renamesVersion, subscribeRenames } from '../services/nameRenames';

/**
 * `fix(text)` swaps any known old person-name in `text` for that person's
 * current name, and re-renders the caller when new renames are learned.
 * Use it on any saved name or saved message text before showing it.
 */
export function useNameFix(): (text: string | undefined | null) => string {
  const version = useSyncExternalStore(subscribeRenames, renamesVersion);
  useEffect(() => { void ensureRenamesLoaded(); }, []);
  // `version` is a dependency so the returned function's identity changes
  // (and memoised consumers recompute) whenever the registry grows.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((text: string | undefined | null) => applyRenames(text), [version]);
}

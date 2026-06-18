import { useState, useEffect } from 'react';

/**
 * Returns true when the given image src is ready to display.
 * - data: and blob: URLs → true immediately (local, no network)
 * - Remote URLs → preloads via new Image(), true on success
 * - Empty/undefined → false (show initials)
 */
export function useImageLoaded(src: string | undefined, timeoutMs = 5000): boolean {
  const isLocal = !!src && (src.startsWith('data:') || src.startsWith('blob:'));
  const [loaded, setLoaded] = useState(isLocal);

  useEffect(() => {
    if (!src) { setLoaded(false); return; }
    if (src.startsWith('data:') || src.startsWith('blob:')) { setLoaded(true); return; }

    // Remote URL — preload
    setLoaded(false);
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled && img.naturalWidth > 1) setLoaded(true); };
    img.onerror = () => { if (!cancelled) setLoaded(false); };
    img.src = src;

    const timer = setTimeout(() => { cancelled = true; }, timeoutMs);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [src, timeoutMs]);

  return loaded;
}

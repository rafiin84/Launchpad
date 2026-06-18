import { useState, useEffect } from 'react';

/**
 * Preloads an image URL in JS and returns whether it loaded successfully.
 * - data: and blob: URLs are trusted immediately (already local).
 * - Remote URLs (like Zoho profile.zoho.in) are preloaded via new Image().
 * - Falls back to false after a timeout so initials show on mobile.
 */
export function useImageLoaded(src: string | undefined, timeoutMs = 5000): boolean {
  const [loaded, setLoaded] = useState(() => {
    // data: and blob: URLs are always ready
    if (src && (src.startsWith('data:') || src.startsWith('blob:'))) return true;
    return false;
  });

  useEffect(() => {
    if (!src) { setLoaded(false); return; }

    // data: and blob: URLs don't need preloading
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setLoaded(true);
      return;
    }

    // Remote URL — preload to verify it actually works
    setLoaded(false);
    let cancelled = false;
    const img = new Image();

    img.onload = () => {
      if (!cancelled && img.naturalWidth > 1 && img.naturalHeight > 1) {
        setLoaded(true);
      }
    };

    img.onerror = () => {
      if (!cancelled) setLoaded(false);
    };

    img.src = src;

    // Safety timeout
    const timer = setTimeout(() => {
      if (!cancelled) setLoaded(false);
      cancelled = true;
    }, timeoutMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [src, timeoutMs]);

  return loaded;
}

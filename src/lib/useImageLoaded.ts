import { useState, useEffect } from 'react';

/**
 * Preloads an image URL in JS and returns whether it loaded successfully.
 * On mobile where Zoho profile photos silently fail (no CORS headers,
 * no onerror, just a blank element), this ensures we only render the
 * <img> if the browser can actually display it.
 *
 * Falls back to `false` after a timeout so initials always show.
 */
export function useImageLoaded(src: string | undefined, timeoutMs = 4000): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    if (!src) return;

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

    // Safety timeout — if image hasn't loaded by now, it won't
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

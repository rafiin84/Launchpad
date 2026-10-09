/**
 * Base URL for the app's own serverless endpoints (`api/*.ts`: portal-users,
 * profile, company, send-invite, ai-score).
 *
 * Those functions only exist on the Vercel deployment. The same static build
 * is also served from Zoho Slate (`*.onslate.in`), which hosts static files
 * only — there, a relative `/api/portal-users` silently answers with the SPA's
 * index.html, and callers that swallow a failed fetch (fetchAllPortalUserStatuses)
 * show an empty "No portal users yet" list instead of an error. Local dev works
 * either way because vite.config.ts proxies `/api` to the same backend.
 *
 * So: same-origin (relative) on Vercel and in local dev, absolute to the Vercel
 * backend everywhere else. Every function sends `Access-Control-Allow-Origin: *`,
 * so the cross-origin call is permitted. Override with VITE_API_BASE_URL.
 */
const DEFAULT_API_BASE = 'https://launchpad-iota-ten.vercel.app';

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configured !== undefined) return configured.replace(/\/+$/, '');
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  const sameOriginHost =
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app');
  return sameOriginHost ? '' : DEFAULT_API_BASE;
}

const API_BASE = resolveApiBase();

/** Prefix an `/api/...` path with the right backend origin for this deployment. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

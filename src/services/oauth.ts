// oauth.ts
// Generic Zoho OAuth (Implicit Flow)
// Supports both Admin/Investor (Zoho CRM) and Founder (Portal) login flows.

export interface PendingToken {
  token: string;
  expiresAt: number;
  apiDomain?: string;
  location?: string;
}

const DEFAULT_TTL_SECONDS = 3600;
const API_DOMAIN_KEY = 'zoho_api_domain';

let pendingToken: PendingToken | null = null;

// -----------------------------------------------------------------------------
// Configuration — Admin / Investor (Zoho CRM OAuth)
// -----------------------------------------------------------------------------

export const OAuthConfig = {
  clientId: "1000.W21LK1JSFRB4E6QED3ZRY9PQ21VWJY",
  authEndpoint: "https://accounts.zoho.in/oauth/v2/auth",
  accountsApi: "https://accounts.zoho.in",

  scopes: [
    "AaaServer.profile.READ",
    "ZohoCRM.modules.ALL",
    "ZohoCRM.users.ALL",
    "ZohoCRM.org.ALL",
    "ZohoCRM.settings.ALL",
    "ZohoCRM.bulk.ALL",
    "ZohoCRM.notifications.ALL",
    "ZohoCRM.coql.READ",
    "ZohoCRM.Files.CREATE",
    "ZohoCRM.Files.READ",
  ],

  callbackPath: "/callback",
  responseType: "token",
  accessType: "online",
  prompt: "consent",

  storage: {
    tokenKey: "zoho_access_token",
    expiryKey: "zoho_token_expiry",
  },
};

// -----------------------------------------------------------------------------
// Configuration — Founder (Zoho CRM Client Portal OAuth)
// -----------------------------------------------------------------------------

export const PortalOAuthConfig = {
  clientId: "50043237302.OS46TUFOUQ59JFF2P9JNPZF7VJTCRY",
  portalId: "50043237302",
  // authEndpoint: "https://accounts.zohoportal.in/clientoauth/v2",
  authEndpoint: "https://launchpad.zcrmportals.in",

  scopes: [
    "ZohoCRM.modules.ALL",
    "ZohoCRM.settings.ALL",
    "ZohoCRM.coql.READ",
    "ZohoCRM.users.ALL",
    "ZohoCRM.org.ALL",
    "ZohoCRM.Files.CREATE",
    "ZohoCRM.Files.READ",
  ],

  callbackPath: "/portal/callback",
  responseType: "token",
  accessType: "offline",
  prompt: "consent",
};

// -----------------------------------------------------------------------------
// Capture access token from callback URL
// -----------------------------------------------------------------------------

if (typeof window !== "undefined") {
  const hash = window.location.hash.substring(1);

  if (hash) {
    try {
      const params = new URLSearchParams(hash);

      const token = params.get("access_token");

      // Log ALL hash parameters for debugging OAuth callback
      const allParams: Record<string, string> = {};
      params.forEach((v, k) => { if (k !== 'access_token') allParams[k] = v; });
      console.log('[OAuth] Hash callback params:', JSON.stringify(allParams));

      if (token) {
        const expiresIn = parseInt(params.get("expires_in") ?? "", 10);

        const ttl =
          Number.isFinite(expiresIn) && expiresIn > 0
            ? expiresIn
            : DEFAULT_TTL_SECONDS;

        const apiDomain = params.get("api_domain") || undefined;
        const location = params.get("location") || undefined;

        console.log('[OAuth] Captured token. api_domain:', apiDomain, 'location:', location);

        pendingToken = {
          token,
          expiresAt: Date.now() + ttl * 1000,
          apiDomain,
          location,
        };

        // Remove OAuth parameters from the URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {
      // Ignore invalid hash
    }
  }
}

// -----------------------------------------------------------------------------
// Pending Token
// -----------------------------------------------------------------------------

export function consumePendingToken(): PendingToken | null {
  const token = pendingToken;
  pendingToken = null;
  return token;
}



// -----------------------------------------------------------------------------
// OAuth Helpers
// -----------------------------------------------------------------------------

export function getRedirectUri(): string {
  if (typeof window === "undefined") {
    throw new Error("getRedirectUri() can only be called in the browser.");
  }

  return `${window.location.origin}${OAuthConfig.callbackPath}`;
}

export function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: OAuthConfig.clientId,
    redirect_uri: getRedirectUri(),
    response_type: OAuthConfig.responseType,
    scope: OAuthConfig.scopes.join(","),
    access_type: OAuthConfig.accessType,
    prompt: OAuthConfig.prompt,
  });

  return `${OAuthConfig.authEndpoint}?${params.toString()}`;
}

export function redirectToZoho(): void {
  if (typeof window !== "undefined") {
    window.location.href = buildAuthUrl();
  }
}

// -----------------------------------------------------------------------------
// Portal OAuth Helpers
// -----------------------------------------------------------------------------

export function getPortalRedirectUri(): string {
  if (typeof window === "undefined") {
    throw new Error("getPortalRedirectUri() can only be called in the browser.");
  }
  return `${window.location.origin}${PortalOAuthConfig.callbackPath}`;
}

export function buildPortalAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: PortalOAuthConfig.clientId,
    redirect_uri: getPortalRedirectUri(),
    response_type: PortalOAuthConfig.responseType,
    scope: PortalOAuthConfig.scopes.join(","),
    access_type: PortalOAuthConfig.accessType,
    prompt: PortalOAuthConfig.prompt,
    state: `portal-${Date.now()}`,
  });

  return `${PortalOAuthConfig.authEndpoint}/accounts/op/${PortalOAuthConfig.portalId}/oauth/v2/auth?${params.toString()}`;
}

export function redirectToPortal(): void {
  if (typeof window !== "undefined") {
    const url = buildPortalAuthUrl();
    console.log('[Portal OAuth] Redirecting to:', url);
    window.location.href = url;
  }
}

// -----------------------------------------------------------------------------
// Token Storage
// -----------------------------------------------------------------------------

export function saveToken(token: string, expiresAt: number): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(OAuthConfig.storage.tokenKey, token);
  localStorage.setItem(
    OAuthConfig.storage.expiryKey,
    expiresAt.toString()
  );
}

export function loadExpiry(): number | null {
  if (typeof window === "undefined") return null;

  const value = localStorage.getItem(OAuthConfig.storage.expiryKey);

  if (!value) return null;

  const expiry = parseInt(value, 10);

  return Number.isFinite(expiry) ? expiry : null;
}

export function loadToken(): string | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem(OAuthConfig.storage.tokenKey);

  if (!token) return null;

  const expiry = loadExpiry();

  if (expiry !== null && Date.now() >= expiry) {
    clearToken();
    return null;
  }

  return token;
}

export function clearToken(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(OAuthConfig.storage.tokenKey);
  localStorage.removeItem(OAuthConfig.storage.expiryKey);
  localStorage.removeItem(API_DOMAIN_KEY);
}

export function saveApiDomain(domain: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_DOMAIN_KEY, domain);
}

export function loadApiDomain(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(API_DOMAIN_KEY);
}

// -----------------------------------------------------------------------------
// Role Persistence
// -----------------------------------------------------------------------------

const ROLE_KEY = 'lp_user_role';
const PENDING_ROLE_KEY = 'lp_pending_role';

export function saveRole(role: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLE_KEY, role);
}

export function loadRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ROLE_KEY);
}

export function clearRole(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROLE_KEY);
}

export function savePendingRole(role: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_ROLE_KEY, role);
}

export function consumePendingRole(): string | null {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem(PENDING_ROLE_KEY);
  localStorage.removeItem(PENDING_ROLE_KEY);
  return role;
}

// -----------------------------------------------------------------------------
// User Name Persistence
// -----------------------------------------------------------------------------

const USER_NAME_KEY = 'lp_user_name';

export function saveUserName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_NAME_KEY, name);
}

export function loadUserName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_NAME_KEY);
}

export function clearUserName(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_NAME_KEY);
}

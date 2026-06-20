// oauth.ts
// Generic Zoho OAuth (Implicit Flow)
// Reusable template for any Next.js / React application.

export interface PendingToken {
  token: string;
  expiresAt: number;
}

const DEFAULT_TTL_SECONDS = 3600;

let pendingToken: PendingToken | null = null;

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

export const OAuthConfig = {
  // Zoho OAuth Client ID
  clientId: "1000.W21LK1JSFRB4E6QED3ZRY9PQ21VWJY",

  // OAuth Scopes
  scopes: [
    "AaaServer.profile.READ",
    "ZohoCRM.modules.ALL",
    "ZohoCRM.users.ALL",
    "ZohoCRM.org.ALL",
    "ZohoCRM.settings.ALL",
    "ZohoCRM.settings.clientportal.ALL",
    "ZohoCRM.bulk.ALL",
    "ZohoCRM.notifications.ALL",
    "ZohoCRM.coql.READ",
    "ZohoCRM.Files.CREATE",
    "ZohoCRM.Files.READ",
  ],

  // Change this if using another Zoho DC (.com, .eu, .com.au, etc.)
  authEndpoint: "https://accounts.zoho.in/oauth/v2/auth",

  // Callback route in your application
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
// Capture access token from callback URL
// -----------------------------------------------------------------------------

if (typeof window !== "undefined") {
  const hash = window.location.hash.substring(1);

  if (hash) {
    try {
      const params = new URLSearchParams(hash);

      const token = params.get("access_token");

      if (token) {
        const expiresIn = parseInt(params.get("expires_in") ?? "", 10);

        const ttl =
          Number.isFinite(expiresIn) && expiresIn > 0
            ? expiresIn
            : DEFAULT_TTL_SECONDS;

        pendingToken = {
          token,
          expiresAt: Date.now() + ttl * 1000,
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

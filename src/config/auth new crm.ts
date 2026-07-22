// ─── Auth & API Configuration ────────────────────────────────────────────────
// Single source of truth for all Zoho OAuth and API settings.
// Update values here; they propagate everywhere in the app.

// ─── Investor / Admin OAuth (Zoho CRM Implicit Flow) ─────────────────────────

export const INVESTOR_AUTH = {
  clientId:     '1000.W21LK1JSFRB4E6QED3ZRY9PQ21VWJY',
  authEndpoint: 'https://accounts.zoho.in/oauth/v2/auth',
  callbackPath: '/callback',
  responseType: 'token',
  accessType:   'online',
  prompt:       'consent',
  scopes: [
    'AaaServer.profile.READ',
    'Solution.modules.ALL',
    'Solution.users.ALL',
    'Solution.org.ALL',
    'Solution.settings.ALL',
    'Solution.bulk.ALL',
    'Solution.notifications.ALL',
    'Solution.coql.READ',
    'Solution.Files.CREATE',
    'Solution.Files.READ',
  ],
  storage: {
    tokenKey:  'zoho_access_token',
    expiryKey: 'zoho_token_expiry',
  },
} as const;

// ─── Founder OAuth (Zoho CRM Client Portal) ───────────────────────────────────

export const FOUNDER_AUTH = {
  clientId:     '50043237302.OS46TUFOUQ59JFF2P9JNPZF7VJTCRY',
  portalId:     '50043237302',
  authEndpoint: 'https://launchpad.zohovertical.in',
  callbackPath: '/portal/callback',
  responseType: 'token',
  accessType:   'offline',
  prompt:       'consent',
  scopes: [
    'Solution.modules.ALL',
    'Solution.settings.ALL',
    'Solution.coql.READ',
    'Solution.users.ALL',
    'Solution.org.ALL',
    'Solution.Files.CREATE',
    'Solution.Files.READ',
  ],
} as const;

// ─── Zoho API Hosts ───────────────────────────────────────────────────────────

export const ZOHO_HOSTS = {
  // Standard CRM REST API (investor tokens)
  crmApi:    'https://launchpad-devsandbox.zohovertical.in',

  // Accounts API — user info, profile photos
  accounts:  'https://accounts.zoho.in',

  // Profile photo CDN
  profileCdn: 'https://profile.zoho.in',

  // Portal domain — CRM calls using founder/portal tokens
  portalCrm: 'https://launchpad-devsandbox.zohovertical.in',

  // CRM portal identifier sent in the x-crmportal header
  portalName: 'launchpad',
} as const;

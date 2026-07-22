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
    'ZohoCRM.modules.ALL',
    'ZohoCRM.users.ALL',
    'ZohoCRM.org.ALL',
    'ZohoCRM.settings.ALL',
    'ZohoCRM.bulk.ALL',
    'ZohoCRM.notifications.ALL',
    'ZohoCRM.coql.READ',
    'ZohoCRM.Files.CREATE',
    'ZohoCRM.Files.READ',
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
  authEndpoint: 'https://launchpad.zcrmportals.in',
  callbackPath: '/portal/callback',
  responseType: 'token',
  accessType:   'offline',
  prompt:       'consent',
  scopes: [
    'ZohoCRM.modules.ALL',
    'ZohoCRM.settings.ALL',
    'ZohoCRM.coql.READ',
    'ZohoCRM.users.ALL',
    'ZohoCRM.org.ALL',
    'ZohoCRM.Files.CREATE',
    'ZohoCRM.Files.READ',
  ],
} as const;

// ─── Zoho API Hosts ───────────────────────────────────────────────────────────

export const ZOHO_HOSTS = {
  // Standard CRM REST API (investor tokens)
  crmApi:    'https://www.zohoapis.in',

  // Accounts API — user info, profile photos
  accounts:  'https://accounts.zoho.in',

  // Profile photo CDN
  profileCdn: 'https://profile.zoho.in',

  // Portal domain — CRM calls using founder/portal tokens
  portalCrm: 'https://launchpad.zcrmportals.in',

  // CRM portal identifier sent in the x-crmportal header
  portalName: 'launchpad',
} as const;

// Cloudinary unsigned upload — lets portal (founder) users upload files directly
// from the browser (Zoho blocks the CRM Attachments API for portal users).
// This is a pure client-side upload: the unsigned preset is public by design,
// so NO API secret is exposed. Create a free account at cloudinary.com, then:
//   Settings → Upload → Add upload preset → Signing mode: Unsigned → Save
// and paste the cloud name + preset name below (or set the VITE_ env vars).
export const CLOUDINARY = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
};

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUDINARY.cloudName && CLOUDINARY.uploadPreset);
}

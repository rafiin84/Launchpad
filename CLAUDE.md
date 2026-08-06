# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server (http://localhost:5173)
npm run build       # tsc -b (project references) + vite build
npm run lint         # ESLint over the whole repo
npm run preview      # Serve the production build locally
npx tsc --noEmit     # Type-check only, no build output (fastest correctness check)
```

There is no test runner configured in this repo (no `test` script, no Jest/Vitest config). Don't assume one exists.

## Architecture

Launchpad is a **pure client-side React app** (Vite + React 19 + TypeScript + Tailwind v4) that talks **directly to Zoho CRM's REST API from the browser** — there is no backend database. Zoho CRM is the only datastore. A `vercel.json` + `api/` directory exist for deployment (Vercel) but most `api/*.ts` serverless functions are legacy/mostly unused — see "Two token models" below.

### Two user roles, two OAuth flows, two token models

The app has exactly two roles, `'investor' | 'founder'`, set at login and persisted via `src/services/oauth.ts` (`saveRole`/`loadRole`). Everything downstream branches on this role.

- **Investor** = Zoho CRM admin/internal user. Logs in via the standard Zoho CRM OAuth **implicit flow** (`INVESTOR_AUTH` in `src/config/auth.ts`, handled by `src/pages/Callback.tsx`). Gets a normal CRM access token with broad scopes (`ZohoCRM.modules.ALL`, etc.) and can read/write everything.
- **Founder** = Zoho CRM **Client Portal** user (a portal-scoped identity, not a CRM user). Logs in via the portal OAuth flow against `launchpad.zcrmportals.in` (`FOUNDER_AUTH` in `src/config/auth.ts`, handled by `src/pages/PortalCallback.tsx`). Gets a portal-scoped access token that Zoho heavily restricts (see "Portal restrictions" below).

`src/services/zohoApi.ts` is the single low-level HTTP client and exposes **two parallel families of functions** for every operation — always pick the one matching the current role:

| Investor (admin token) | Founder (portal token) | Notes |
|---|---|---|
| `zohoList`, `zohoListUnscoped` | `portalList`, `portalListUnscoped` | Portal calls add `x-crmportal: launchpad` header |
| `zohoCreate` / `zohoUpdate` / `zohoDelete` | `portalCreate` / `portalUpdate` | Founders generally cannot delete |
| `zohoGetById` | `portalGetById` | |
| `zohoSearch` | `portalSearch` | |
| `zohoCoql` | `portalCoql` | COQL against `launchpad.zcrmportals.in` |
| `zohoUploadAttachment` / `zohoDownloadAttachment` | `portalUploadAttachment*` (rarely works, see below) | |

`src/config/auth.ts` (`ZOHO_HOSTS`) is the single source of truth for API hosts — `zohoapis.in` (CRM) vs `zcrmportals.in` (portal), plus the portal name used in `x-crmportal`. There are stray unused files `src/config/auth old crm.ts` and `src/config/auth new crm.ts` left over from earlier iterations — they are not imported anywhere; only `src/config/auth.ts` is live.

### No dev/prod proxy for Zoho — CORS is handled by whitelisting, not proxying

`vite.config.ts` deliberately has **no proxy for Zoho domains**. Every Zoho call goes straight from the browser to `zohoapis.in` / `zcrmportals.in` using the user's own OAuth token. This is intentional (see git history — proxies were added and then explicitly removed, commit "Remove all /api/* server proxy calls — route everything through zohoApi.ts directly"). For this to work, the app's origin (localhost during dev, the Vercel URL in prod) must be added to Zoho's trusted/CORS domains for both the CRM app and the Client Portal. If you see `TypeError: Failed to fetch` in the console for a Zoho call, treat it as **either a CORS-whitelist gap or an expired/invalid token** — not a code bug — before touching the fetch logic.

Do not reintroduce a `/portal-api` or `/zoho-crm-proxy` dev proxy, and never route calls through an admin/client-secret token on behalf of a portal (founder) user — this breaks the "founder only ever uses their own portal OAuth token" invariant the app relies on for data ownership and visibility rules.

A handful of legacy `api/*.ts` Vercel serverless functions (`api/portal-users.ts`, `api/company.ts`, `api/send-invite.ts`, `api/profile.ts`, plus the shared admin-token helper `api/_zohoAdmin.ts`) still exist and are still called from a few spots (`crmFounders.ts`, `AuthContext.tsx`'s profile-photo fallback) for investor-only/admin-only features that need elevated access founders never get (e.g. listing all portal users, sending invites). These are the one deliberate exception to "no proxy" — they use `ZOHO_CLIENT_ID`/`ZOHO_CLIENT_SECRET`/`ZOHO_REFRESH_TOKEN` env vars server-side and are only ever called for investor-facing admin actions, never on a founder's behalf.

### Portal (founder) restrictions — the recurring source of bugs

Zoho's Client Portal locks founders down in ways that aren't visible from the CRM admin side and have caused most of the historical bugs in this app:

- **Field-level permissions are separate from module permissions.** A field can be `visible: true` in CRM metadata yet still be silently stripped from every portal API response. This must be configured per-field in **Zoho Setup → Portals → \<portal\> → \<module\> → Field Permissions**, not via the CRM API (there's no API to inspect or change this). If a founder-side fetch returns records but a specific field always comes back empty/null while the admin-side query proves the data exists, suspect this before suspecting the code.
- **The CRM Attachments API is hard-blocked for portal users** (`API_NOT_SUPPORTED`). Founders cannot upload file attachments to CRM records the way investors can.
- **`My_Activities` is not portal-writable.** Founders post to the portal-writable `Feed_Submissions` module instead (same field API names), and a **Zoho workflow function** (configured in CRM, not in this repo) relays each `Feed_Submissions` record into `My_Activities` so it appears in the shared feed. See `src/services/crmActivities.ts` (`FOUNDER_POST_MODULE`).
- **File storage differs by feature**, worked around differently in different places:
  - Standalone Documents module (`My_Documents`, `src/pages/AddDocument.tsx` / `src/services/crmDocuments.ts`) stores the file directly in Zoho via the record's **File Upload field** (`File_Upload_1`) using the `/crm/v2/files` endpoint (`uploadFieldFile`/`downloadFieldFile` in `zohoApi.ts`) — works for both investor and founder tokens, no third party involved.
  - Application document requests (`FounderApplicationTracker.tsx`) and activity images (`AddActivity.tsx`, `Activities.tsx`) still use `src/services/fileUpload.ts`, an **unsigned Cloudinary upload** (`VITE_CLOUDINARY_CLOUD_NAME` / `VITE_CLOUDINARY_UPLOAD_PRESET` in `.env`) as a portal-safe file host, falling back to a plain share-link text field when Cloudinary isn't configured (`isCloudinaryConfigured()`).
- **Founders authenticate/identify by email**, and that email must be captured consistently. `savePortalLoginEmail`/`loadPortalLoginEmail` (`oauth.ts`) persist it at login; several past bugs came from this not being called, or from a founder's Zoho-account email differing from the email a CRM record was created/owned under. When founder-scoped data looks empty, check this before the query logic.

### CRM module map

These are the Zoho CRM module API names the app reads/writes (defined as `MODULE` constants near the top of each service file):

| Module | Service file | Purpose |
|---|---|---|
| `Applications` | `crmApplications.ts`, `investmentApplications.ts` | Founder investment applications, status pipeline, requested documents |
| `My_Documents` | `crmDocuments.ts` | Standalone document library (shared between founders/investors) |
| `My_Activities` | `crmActivities.ts`, `notifications.ts` | Shared activity feed + in-app notifications (same module, `Activity_Type` distinguishes them) |
| `Feed_Submissions` | `crmActivities.ts` | Portal-writable relay target for founder posts → workflow copies into `My_Activities` |
| `Contacts` | `crmFounders.ts` | Founder directory |
| `Deals` | `crmDeals.ts` | Investor deal flow |
| `Founder_Companies` | `companyProfile.ts` | Founder company profile data |

Application/activity payloads are hand-mapped between camelCase app fields and CRM field API names via `FIELD_MAP`-style objects in each service — when adding a field, it must be added in the service's field map, not just the CRM schema.

### Two generations of "services"

`src/services/` contains two unrelated generations of code with overlapping names — know which one you're in before editing:

- **Real, Zoho-backed services** (what the app actually runs on): `zohoApi.ts`, `oauth.ts`, `crm*.ts`, `investmentApplications.ts`, `notifications.ts`, `sharedActivities.ts`, `companyProfile.ts`, `fileUpload.ts`, `crmAppUsers.ts`, `portalUsers.ts`. Pages import these directly by filename.
- **Legacy in-memory mock services** re-exported from `src/services/index.ts` (`postsService.ts`, `companiesService.ts`, `dealsService.ts`, `conversationsService.ts`, `knowledgeService.ts`, `introductionsService.ts`, `investmentsService.ts`, `aiEngine.ts`): these hold data in a module-level array/`let` variable that is never populated from Zoho and resets on reload. A few pages still import them for features that were never migrated to CRM. Don't assume any file under `services/` is Zoho-backed just because of naming — check whether it imports `zohoApi`/`oauth` or just holds a local array.

### Notifications piggyback on the activity feed

`src/services/notifications.ts` stores notifications as `My_Activities` records with `Activity_Type: 'notification'` and a JSON-encoded `Content` field (`{type, message, link, read, requestedDocs?}`). It fetches via `portalList`/`zohoList` depending on role — historically a source of bugs when the wrong list function (or the `x-crmportal` header) was used for the current role, since the two accept different permissions. `Activity_Tags` (`'founder'` / `'investor'`) marks the intended audience.

### Visibility rules for the shared feed

`src/services/sharedActivities.ts` (`filterByVisibility`) enforces: investor posts are visible to everyone; founder posts are visible to investors and to the posting founder only, never to other founders. This is a **client-side filter only** — the underlying `My_Activities` records are not access-restricted at the CRM level, so don't rely on this for anything security-sensitive.

### i18n

All user-facing strings live in `src/i18n` (see `en.ts`) and are consumed via `useLanguage()` from `src/context/LanguageContext.tsx` (`t.<namespace>.<key>`). Don't hardcode UI copy inline — add it to the language file.

### Auth/session state

`src/context/AuthContext.tsx` is the top-level source of `currentUser`, `isInvestor`, `isFounder`, and `founderCompanyName`. Role-gated routes are declared in `src/App.tsx`.

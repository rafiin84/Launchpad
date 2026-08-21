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
- **File storage** for anything the app itself needs to read back (Documents module, application document requests) goes through Zoho's **File Upload field** mechanism, not the Attachments API:
  - Standalone Documents (`My_Documents`, `src/pages/AddDocument.tsx` / `src/services/crmDocuments.ts`) store the file in a **File Upload field** (`File_Upload_1` on `My_Documents`) using the `/crm/v2/files` upload endpoint — works for both investor and founder tokens, no third party involved.
  - **Application document-request uploads live on the Application's own record, never on `My_Documents`** — `Requested_Document_Files`, a File Upload field on `Applications` (see "Requested-document file uploads" below). Older records still point at a `My_Documents` record instead (`RequestedDocument.documentId`/`attachmentId`); that's a legacy shape kept only for backward-compat viewing, not something new uploads create.
  - **Company logos are the one File-storage exception** — they use Zoho's **Record Image** API (`uploadCompanyLogo`/`resolveCompanyLogo` in `companyProfile.ts`), not a File Upload field. This was tried as a File Upload field for a while, but a File Upload field's value never populates the record's own top-left thumbnail inside Zoho CRM itself — only Record Image does — so Record Image is the only mechanism on `Founder_Companies` now.
  - `AddActivity.tsx` (the standalone `/activities/new` page, not the main inline composer on `Activities.tsx` — see "Activity post types" below) still uses `src/services/fileUpload.ts`, an **unsigned Cloudinary upload** (`VITE_CLOUDINARY_CLOUD_NAME` / `VITE_CLOUDINARY_UPLOAD_PRESET` in `.env`) for photos.
  - **Reading a File Upload field back is not one obvious API call** — two non-obvious gotchas cost real debugging time:
    1. The array item's key names for the file id/name **differ between the admin and portal APIs**: admin returns `File_Id__s`/`File_Name__s`; portal returns `attachment_Id`/`file_Name` (no `__s`, different casing). See `parseFileUpload` in `crmDocuments.ts`.
    2. Downloading the file is `GET /crm/v2/{module}/{recordId}/actions/download_fields_attachment?fields_attachment_id={id}` — the param is `fields_attachment_id` (**not** `fields_data`), and its value is the **attachment record's own id** (the plain `id` on the admin API / `attachment_Id` on the portal API), **not** the encrypted `File_Id__s`/`file_Id` value, which looks correct but gets rejected. A wrong combination here returns an HTTP 400 with no CORS header, which Chrome reports as a misleading "blocked by CORS policy" error — don't chase CORS config for this endpoint before checking the request shape (`curl` with the token bypasses the CORS masking and shows the real error body). See `downloadFieldFile` in `zohoApi.ts`.
- **Founders authenticate/identify by email**, and that email must be captured consistently. `savePortalLoginEmail`/`loadPortalLoginEmail` (`oauth.ts`) persist it at login; several past bugs came from this not being called, or from a founder's Zoho-account email differing from the email a CRM record was created/owned under. When founder-scoped data looks empty, check this before the query logic.
- **Matching `Email` on a record is not sufficient for a founder's portal session to see it — the record also needs its `Contact` lookup field pointing at that founder's own Contact record.** Confirmed directly: a `Founder_Companies` record created/edited by an admin (e.g. via Zoho's own CRM app, not through this app's founder-facing UI) had the correct `Email` value but `Contact: null`, and `portalList`/`portalSearch` for `Founder_Companies` (`companyProfile.ts`'s `searchFounders`) returned nothing for that founder's own portal session — Zoho's Client Portal scopes "my records" by the Contact association, not by field-value matching, even for an exact email match. Fixing it required manually setting `Contact` to that founder's Contact record id. Suspect this whenever a founder insists their data is in CRM (and it genuinely is, on inspection) but the app shows it empty — check `Contact` on the record before assuming an app bug.

### CRM module map

These are the Zoho CRM module API names the app reads/writes (defined as `MODULE` constants near the top of each service file):

| Module | Service file | Purpose |
|---|---|---|
| `Applications` | `crmApplications.ts`, `investmentApplications.ts` | Founder investment applications, status pipeline, requested documents |
| `My_Documents` | `crmDocuments.ts` | Standalone document library (shared between founders/investors) |
| `My_Activities` | `crmActivities.ts`, `notifications.ts` | Shared activity feed + in-app notifications (same module, `Activity_Type` distinguishes them) |
| `Feed_Submissions` | `crmActivities.ts` | Portal-writable relay target for founder posts → workflow copies into `My_Activities` |
| `Contacts` | `crmFounders.ts` | Founder directory (investor-side, admin token) **and** a founder's own editable profile (portal token, self-service — see below) |
| `Deals` | `crmDeals.ts` | Investor deal flow |
| `Founder_Companies` | `companyProfile.ts` | Founder company profile data |

Application/activity payloads are hand-mapped between camelCase app fields and CRM field API names via `FIELD_MAP`-style objects in each service — when adding a field, it must be added in the service's field map, not just the CRM schema.

### Founder's own profile — Contacts, not `appusers`

`src/services/crmAppUsers.ts` (the `appusers` module) is **admin-only**: every function starts with an `isPortalUser()` check and no-ops for founders, because a founder's portal token is never valid on the admin `zohoapis.in` domain. This means a founder's self-edited profile (bio, location, LinkedIn, etc.) never actually reached CRM through that path — it only ever wrote to `localStorage`, invisible to the investor and to other devices/browsers.

The founder-editable Profile page (`Profile.tsx` / `EditProfile.tsx`, both split into an `Investor*`/`Founder*` component per role) instead reads/writes the founder's own **Contacts** record via the portal API (`fetchMyContactId`/`fetchMyFounderProfile`/`updateMyFounderProfile`/`uploadMyFounderPhoto` in `crmFounders.ts`), since a founder's portal identity maps 1:1 to a Contact and Contacts *is* portal-accessible. `fetchPortalUserContact()` (`zohoApi.ts`) resolves that Contact id from the portal token via several fallback strategies.

Custom fields `Bio`, `Location`, `LinkedIn`, `Skills_Expertise`, and `Company` were added to `Contacts` for this (none existed before — `Company` in particular did **not** exist despite `crmFounders.ts` having written to it for a while, which means investor-created founders' company names were silently dropped until this field was added). `Twitter` already existed as a standard-ish field and is reused as-is. The profile photo uses Zoho's standard `Record_Image` (Record Image API — `portalUploadRecordPhoto`/`portalGetRecordPhoto`/`portalDeleteRecordPhoto` in `zohoApi.ts`), scoped to the Profile pages only — it is deliberately not wired into the sitewide sidebar avatar, which has its own separate (already-complex) fallback chain in `AuthContext.tsx`.

**A portal user can never update their own `Email` field, on any module** — Zoho rejects the *entire* update (`NOT_ALLOWED`, "portal users cannot edit invited field value") if `Email` is present in the payload at all, since it's the field tied to their portal invite/login identity. `updateMyFounderProfile` strips it defensively before every call. The founder's Email is shown read-only in `EditProfile.tsx`; same treatment was given to the investor's Email in the `appusers` form, though for a different reason (it's the `zohoUpsert` duplicate-check key there, so an edit could orphan the record on next login sync rather than being API-rejected outright).

As with every other portal field, **these new fields need Read & Write granted to the Founder profile under Zoho Setup → Portals → \<portal\> → Contacts → Field Permissions** before a founder can actually see/save them through the API — creating the field via the CRM API only makes it exist, not portal-visible (see "Portal restrictions" above).

### Two generations of "services"

`src/services/` contains two unrelated generations of code with overlapping names — know which one you're in before editing:

- **Real, Zoho-backed services** (what the app actually runs on): `zohoApi.ts`, `oauth.ts`, `crm*.ts`, `investmentApplications.ts`, `notifications.ts`, `sharedActivities.ts`, `companyProfile.ts`, `fileUpload.ts`, `crmAppUsers.ts`, `portalUsers.ts`. Pages import these directly by filename.
- **Legacy in-memory mock services** re-exported from `src/services/index.ts` (`postsService.ts`, `companiesService.ts`, `dealsService.ts`, `conversationsService.ts`, `knowledgeService.ts`, `introductionsService.ts`, `investmentsService.ts`, `aiEngine.ts`): these hold data in a module-level array/`let` variable that is never populated from Zoho and resets on reload. A few pages still import them for features that were never migrated to CRM. Don't assume any file under `services/` is Zoho-backed just because of naming — check whether it imports `zohoApi`/`oauth` or just holds a local array.

### Notifications piggyback on the activity feed

`src/services/notifications.ts` stores notifications as `My_Activities` records with `Activity_Type: 'notification'` and a JSON-encoded `Content` field (`{type, message, link, read, targetEmail?, requestedDocs?}`). It fetches via `portalList`/`zohoList` depending on role — historically a source of bugs when the wrong list function (or the `x-crmportal` header) was used for the current role, since the two accept different permissions. `Activity_Tags` (`'founder'` / `'investor'`) marks the intended **role**, but a role alone doesn't identify which specific founder/company a notification is about — there are many founders sharing the `'founder'` tag.

**Founder notifications are additionally scoped to one founder's email via `Content.targetEmail`, filtered client-side in `fetchFromServer`/`getNotifications`.** This exists because `Activity_Tags` used to be the *only* filter, so every investor action on one company's application created a `'founder'`-tagged record that every founder in the system could see (a real cross-company data leak, not hypothetical). The filter fails closed: a `'founder'`-targeted notification with no `targetEmail` is dropped for everyone rather than shown broadcast-style, so any future `addNotification` call that forgets to pass `targetEmail` silently disappears instead of leaking. There's only one investor audience in this app (no per-investor targeting need), so investor-targeted notifications don't set `targetEmail`.

When adding a new `addNotification({ targetRole: 'founder', ... })` call, always pass `targetEmail` (the specific founder's login email — e.g. `app.founderEmail` on an `InvestmentApplication`, or `founder.email` on a `CRMFounder`). Investor-targeted calls don't need it. Deliberately NOT wired to fire notifications: activity/feed posts (`Activities.tsx`'s composer) and company-profile saves (`FounderCompany.tsx`) and generic profile edits (`EditProfile.tsx`) — these were removed as pure noise, since they broadcast to every user of the opposite role with no company-specific targeting and aren't tied to an application/document action.

"Notifications" here is in-app only (an `My_Activities`-backed bell/list, polled every 15s) — there is no browser/OS push (no service worker, no `Notification.requestPermission`, no FCM/web-push) anywhere in this repo.

### Visibility rules for the shared feed

`src/services/sharedActivities.ts` (`filterByVisibility`) enforces: investor posts are visible to everyone; founder posts are visible to investors and to the posting founder only, never to other founders. This is a **client-side filter only** — the underlying `My_Activities` records are not access-restricted at the CRM level, so don't rely on this for anything security-sensitive.

### Activity post types (photo/video/YouTube/document/location/poll/link)

`My_Activities` and `Feed_Submissions` both carry the same 9 extra fields for these: `Post_Type`, `Video_URL`, `Link_URL`, `Location_Name`, `Location_Coords`, `Poll_Data`, `Document_Ref`, `Activity_File_Upload`, `Activity_File_Name` (see `FIELD_MAP`/`ALL_FIELDS` in `crmActivities.ts`). `Post_Type` picks the renderer in `ActivityCard`/`ActivityDetail.tsx`; records saved before it existed fall back to the old imageUrl/imageData inference. Polls store only `{question, options}` in `Poll_Data` — **never vote tallies**.

**Activity files (Photo upload / Video / Document) are stored on the activity's own record — never in `My_Documents` — via a dedicated File Upload field, `Activity_File_Upload`.** This is deliberately separate from the Documents page's storage (`File_Upload_1` on `My_Documents`, used by `crmDocuments.ts`): an activity attachment is scoped to its post and must never appear on the Documents page, and the Documents page must never show activity attachments. Uploading (`uploadActivityFile` in `crmActivities.ts`) sends the raw file straight to Zoho (`zohoUploadFile`/`portalUploadFile`) and returns a `file_id`; the plain filename is stored separately in `Activity_File_Name` (`activityFileName` field). Photo also keeps a "paste a URL" mode (`imageUrl`, no upload involved) as an alternative to uploading.

The `file_id` is attached to `Activity_File_Upload` **at create time** (`createCRMActivity(fields, pendingFileId)` — `payload[Activity_File_Upload] = [{ file_id: pendingFileId }]`), not via a follow-up update, because a follow-up update is unsafe on the founder path (see relay race note below). `Document_Ref` (`fileRef` field) is repurposed to hold a small `{module: 'My_Activities' | 'Feed_Submissions', recordId}` JSON pointer — not the old `{documentId, fileUploadId, fileName}` shape from the Documents-page era — so a viewer always knows which record's `Activity_File_Upload` to re-fetch. Since the record's own `id` is known as soon as `createCRMActivity`'s create call returns (for both roles — a founder's file lives on the Feed_Submissions record it just created, same `id`), `createCRMActivity` computes this pointer synchronously and returns it as `{id, fileRef}` — `postSharedActivity` folds `fileRef` into the activity object it hands back to the UI, so the freshly-posted activity (including its attachment) renders immediately without a page refresh. For an **investor** post (no relay involved), the client additionally persists it with a follow-up update (`zohoUpdate(MODULE, id, { Document_Ref: fileRef })`, best-effort). For a **founder** post, no client-side follow-up update is possible or safe (Feed_Submissions isn't updatable this way and the relay's timing is uncontrollable) — instead the Deluge relay function itself must construct the same `Document_Ref` value using the `recordId` parameter it already has when copying the record into `My_Activities` (see the relay requirement below); the client-computed value is only used for the immediate local render, never persisted by the client on the founder path.

Rendering an uploaded Photo/Video/Document always does a **fresh fetch** (`resolveActivityFileUrl(ref)` in `crmActivities.ts` — re-fetches the target record's `Activity_File_Upload` field, extracts the attachment's own id, then calls `downloadFieldFile`) rather than trusting any pre-stored attachment id, eliminating staleness/race risk entirely. `MediaAttachment`/`DocumentAttachmentCard` (`PostAttachments.tsx`) take a `fileRef: string` (the `Document_Ref` JSON) — `MediaAttachment` also takes `kind: 'photo' | 'video'`, `DocumentAttachmentCard` also takes a separate `fileName: string` prop (since the filename lives in `Activity_File_Name`, not inside the ref). Unlike a plain `imageUrl`, this requires an async fetch, so both components manage their own loading/error state. **`AddActivity.tsx` (the separate `/activities/new` full-page composer) was NOT updated** and still uploads photos via Cloudinary (`src/services/fileUpload.ts`) — it's the one remaining consumer of that service. Don't assume the two composers behave the same.

**Two things a Zoho admin must do that can't be done via the CRM API, or this silently breaks for founders:**
1. **Update the `Feed_Submissions → My_Activities` relay workflow function** to also copy `Activity_File_Name` as a plain field, AND to conditionally construct `Document_Ref = {"module":"Feed_Submissions","recordId":recordId}` (as a JSON string) whenever `feed.get("Activity_File_Upload")` is non-empty, using the `recordId` the relay function already receives as a parameter. It's hardcoded to a fixed field list and won't forward the new fields until edited. Without this, a founder's photo/video/document post creates fine in `Feed_Submissions` but arrives in `My_Activities` — and therefore the feed everyone reads — with the attachment silently missing.
2. **Grant the Founder profile Read & Write on `Activity_File_Upload` and `Activity_File_Name`**, on **both** `My_Activities` and `Feed_Submissions`, under Setup → Portals → Field Permissions (same recurring gate as every other portal field in this app — see "Portal restrictions" above). Founders need it on `Feed_Submissions` to create these post types, and on `My_Activities` to read back anyone's post (including their own, once relayed). (The other 7 post-type fields — `Post_Type`, `Video_URL`, `Link_URL`, `Location_Name`, `Location_Coords`, `Poll_Data`, `Document_Ref` — need the same grant from the earlier post-types rollout.)

**Poll voting** doesn't mutate the poll's own record — `Poll_Data` never changes after the poll is created. Each vote is instead a separate small activity record (`Activity_Type: 'poll_vote'`, JSON `{activityId, optionIndex, voterEmail, voterName}` in `Content`) created via the exact same path as a normal post (`castPollVote` in `crmActivities.ts`: `zohoCreate` for investors, `portalCreate` into `Feed_Submissions` for founders). This sidesteps two hard limits at once: founders have no update path to `My_Activities` at all (a vote-tally mutation would be impossible for them), and a shared mutable tally field would race if two people voted at once. Tallying (`parsePollVotes`) just filters whatever activities are already loaded — `poll_vote` records are excluded from the rendered feed (`POLL_VOTE_TYPE` check in `Activities.tsx`/`ActivityDetail.tsx`) but kept in the underlying list so tallies stay accurate. One consequence of reusing the existing visibility rules: a founder voting on an *investor's* poll produces a vote record that's only visible to that founder + the investor (standard founder-post visibility), so **other founders undercount votes contributed by founders they can't see** — only the investor's own view of any poll is guaranteed fully accurate. `AddActivity.tsx`/`EditActivity.tsx` (the standalone `/activities/new` and edit pages) were not extended with UI for these post types — `EditActivity.tsx` preserves whatever attachment an existing post already has by passing its fields through unchanged, since `updateCRMActivity` overwrites every field on every save.

### Requested-document file uploads

When an investor requests documents on an `Applications` record (`Requested_Documents`, a JSON array — see `RequestedDocument`/`DOCUMENT_TYPES` in `investmentApplications.ts`) and the founder uploads a file for one, that file lives on **the Application's own record** via `Requested_Document_Files` — a File Upload field on `Applications` — never on `My_Documents`. This is deliberate: a requested document is scoped to its application and must never appear on the Documents page, and the Documents page must never show requested documents.

Unlike `Activity_File_Upload` (one file per activity), `Requested_Document_Files` holds **multiple files on one record** — every requested document across the whole application shares this single field, since Zoho doesn't support one File Upload field per dynamic label. Zoho's write API for a File Upload field **replaces the field's whole contents**, it doesn't append — so adding a new file without losing previously uploaded ones requires a **read-modify-write**: `attachApplicationDocumentFile` (`investmentApplications.ts`) first reads the field's current entries, re-submits each one's own upload-time `file_id` (**not** its attachment id — a third id, only good for this "keep this file" purpose, distinct from both the attachment's own id and the entry's encrypted `File_Id__s`/`file_Id` used for downloads), then appends the new file's `file_id`, and writes the combined list back. It diffs attachment ids before/after the write to figure out which entry is the newly-added one, and returns that specific attachment id to store on `RequestedDocument.fileAttachmentId`. This has a known small race risk if two uploads to the same application land concurrently (last write wins) — acceptable for how infrequently document uploads happen, same tradeoff made elsewhere in this codebase.

`resolveApplicationDocumentUrl(applicationId, fileAttachmentId)` always does a fresh fetch of the field, confirms the given `fileAttachmentId` is still present among the entries, then calls `downloadFieldFile` — same "never trust a pre-stored attachment id" pattern as `resolveActivityFileUrl`.

Since this field holds one entry per requested document rather than one file total, `Requested_Document_Files` needs **"Allow users to upload multiple files" enabled manually in Zoho Setup** (Setup → Customization → Modules → Applications → this field's settings) — the Fields Metadata API creates the field but rejects attempts to change this via `length` or any other documented property, so it can only be toggled through the Setup UI. Without it, uploading a second requested document will silently replace the first.

**Older records** (submitted before this architecture) still carry `RequestedDocument.documentId`/`attachmentId` pointing at a `My_Documents` record — `FounderApplicationTracker.tsx`'s `GenericDocUpload` and `ApplicationDetail.tsx`'s `handleViewRequestedFile` both check `fileAttachmentId` first and fall back to the legacy `documentId`/`attachmentId` → `resolveDocumentUrl` (`crmDocuments.ts`) path for those, so already-submitted founder documents keep working without needing to be re-uploaded.

**The separate mobile app (not part of this repo) writes this same legacy shape under a different key: `recordId` instead of `documentId`, for the identical `My_Documents` record reference.** It also puts a raw, authentication-required Zoho API download URL (`.../actions/download_fields_attachment?fields_attachment_id=...`) directly in `RequestedDocument.link`, unlike this app's own use of `link` for a genuine public share link (Google Drive/Dropbox) that needs no auth. Rendering that URL as a plain `<a href>` — which is exactly what happens to any real share link — produces a browser-side `AUTHENTICATION_FAILURE` on click, since a plain navigation carries no `Authorization` header. `requestedDocumentFileId(doc)` (`investmentApplications.ts`) reads through both `documentId` and `recordId`; both `ApplicationDetail.tsx` and `FounderApplicationTracker.tsx` use it instead of `doc.documentId` directly, and both make sure a resolvable `documentId`/`recordId`+`attachmentId` pair takes priority over rendering `doc.link` as a raw hyperlink. Suspect this shape whenever a requested-document link works in the mobile app but throws `AUTHENTICATION_FAILURE` in the web app.

**Manual Zoho Setup steps for this to work end-to-end (same recurring pattern as every other portal field in this app):**
1. Enable multiple-file upload on `Requested_Document_Files` (see above — Setup UI only, not exposed via API).
2. Grant the Founder profile Read & Write on `Requested_Document_Files` under Setup → Portals → Field Permissions on `Applications` — founders need it to upload and to view what they've already submitted. Investors read/write via the admin token, so no portal grant is needed on that side.

### i18n

All user-facing strings live in `src/i18n` (see `en.ts`) and are consumed via `useLanguage()` from `src/context/LanguageContext.tsx` (`t.<namespace>.<key>`). Don't hardcode UI copy inline — add it to the language file.

### Auth/session state

`src/context/AuthContext.tsx` is the top-level source of `currentUser`, `isInvestor`, `isFounder`, and `founderCompanyName`. Role-gated routes are declared in `src/App.tsx`.

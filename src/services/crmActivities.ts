import {
  zohoList, zohoListUnscoped, zohoCoql, portalCoql, zohoGetById, portalList, portalListUnscoped, portalGetById,
  zohoCreate, portalCreate, zohoUpdate, zohoDelete, zohoUploadFile, portalUploadFile, downloadFieldFile,
  type ZohoRecord,
} from './zohoApi';
import { loadRole } from './oauth';

const MODULE = 'My_Activities';

const FIELD_MAP: Record<string, string> = {
  title:           'Name',
  activityType:    'Activity_Type',
  content:         'Content',
  companyName:     'Company_Name',
  authorName:      'Author_Name',
  authorRole:      'Author_Role',
  tags:            'Activity_Tags',
  imageUrl:        'Image_URL',
  imageData:       'Activity_Image_Data',
  visibility:      'Visibility',
  // Post type ('photo' | 'video' | 'youtube' | 'document' | 'location' | 'poll' | 'link')
  // and per-type payload fields. Missing on older records — renderers fall back
  // to inferring from imageUrl/imageData like before postType existed.
  postType:        'Post_Type',
  videoUrl:        'Video_URL',       // a pasted youtube URL only (uploaded video uses fileRef now)
  linkUrl:         'Link_URL',
  locationName:    'Location_Name',
  locationCoords:  'Location_Coords', // "lat,lng", optional
  pollData:        'Poll_Data',       // JSON: { question: string, options: string[] }
  activityFileName: 'Activity_File_Name', // display name of an uploaded Photo/Video/Document
  fileRef:         'Document_Ref',    // JSON ActivityFileRef — see "Uploaded activity files" below
};

export interface CRMActivity {
  id: string;
  title: string;
  activityType: string;
  content: string;
  companyName: string;
  authorName: string;
  authorRole: string;
  tags: string;
  imageUrl: string;
  imageData: string;
  visibility: string;
  postType: string;
  videoUrl: string;
  linkUrl: string;
  locationName: string;
  locationCoords: string;
  pollData: string;
  activityFileName: string;
  fileRef: string;
  createdTime: string;
}

export type CRMActivityFields = Omit<CRMActivity, 'id' | 'createdTime'>;

function fromRecord(r: ZohoRecord): CRMActivity {
  const str = (key: string): string => {
    const v = r[key];
    if (v === null || v === undefined) return '';
    return String(v);
  };
  return {
    id:               r.id,
    title:            str(FIELD_MAP.title),
    activityType:     str(FIELD_MAP.activityType),
    content:          str(FIELD_MAP.content),
    companyName:      str(FIELD_MAP.companyName),
    authorName:       str(FIELD_MAP.authorName),
    authorRole:       str(FIELD_MAP.authorRole),
    tags:             str(FIELD_MAP.tags),
    imageUrl:         str(FIELD_MAP.imageUrl),
    imageData:        str(FIELD_MAP.imageData),
    visibility:       str(FIELD_MAP.visibility),
    postType:         str(FIELD_MAP.postType),
    videoUrl:         str(FIELD_MAP.videoUrl),
    linkUrl:          str(FIELD_MAP.linkUrl),
    locationName:     str(FIELD_MAP.locationName),
    locationCoords:   str(FIELD_MAP.locationCoords),
    pollData:         str(FIELD_MAP.pollData),
    activityFileName: str(FIELD_MAP.activityFileName),
    fileRef:          str(FIELD_MAP.fileRef),
    createdTime:      str('Created_Time') || str('Modified_Time'),
  };
}

// Explicitly list all fields — Zoho omits large textarea fields from default list responses.
// Activity_File_Upload itself is deliberately NOT listed here (a file-upload-type
// field is only fetched on demand when actually resolving/downloading a file —
// see resolveActivityFileUrl).
const ALL_FIELDS = 'Name,Activity_Type,Content,Company_Name,Author_Name,Author_Role,Activity_Tags,Image_URL,Activity_Image_Data,Visibility,Post_Type,Video_URL,Link_URL,Location_Name,Location_Coords,Poll_Data,Activity_File_Name,Document_Ref,Created_Time,Modified_Time';

export async function getCRMActivity(id: string): Promise<CRMActivity> {
  const record = await zohoGetById(MODULE, id, ALL_FIELDS);
  if (!record) throw new Error('Activity not found');
  return fromRecord(record);
}

const COQL_FIELDS = 'id, Name, Activity_Type, Content, Company_Name, Author_Name, Author_Role, Activity_Tags, Image_URL, Activity_Image_Data, Visibility, Post_Type, Video_URL, Link_URL, Location_Name, Location_Coords, Poll_Data, Activity_File_Name, Document_Ref, Created_Time, Modified_Time';

async function fetchViaCoql(): Promise<CRMActivity[]> {
  const records = await zohoCoql(
    `SELECT ${COQL_FIELDS} FROM ${MODULE} ORDER BY Created_Time DESC LIMIT 200`
  );
  return records.map(fromRecord);
}

async function fetchViaPortalCoql(): Promise<CRMActivity[]> {
  const records = await portalCoql(
    `SELECT ${COQL_FIELDS} FROM ${MODULE} ORDER BY Created_Time DESC LIMIT 200`
  );
  return records.map(fromRecord);
}

export async function fetchCRMActivities(): Promise<CRMActivity[]> {
  const isFounder = loadRole() === 'founder';

  // For founders: try portal COQL first — returns ALL records including investor posts.
  // Falls back to portalListUnscoped, then portalList.
  if (isFounder) {
    try {
      const activities = await fetchViaPortalCoql();
      if (activities.length > 0) return activities;
    } catch (err) {
      console.warn('[Activities] Portal COQL failed, falling back to list:', err);
    }
  }

  // For investors: use standard COQL (includes textarea fields, all records).
  if (!isFounder) {
    try {
      const activities = await fetchViaCoql();
      if (activities.length > 0) return activities;
    } catch (err) {
      console.warn('[Activities] COQL failed, falling back to list:', err);
    }
  }

  // Fallback: list endpoint + individual GETs for missing textarea fields.
  // Founders use zcrmportals.in (portal domain) so the portal field config applies.
  // Investors use www.zohoapis.in (standard CRM domain).
  const listParams = {
    per_page: '200',
    sort_by: 'Created_Time',
    sort_order: 'desc',
    fields: ALL_FIELDS,
  };

  // portalListUnscoped omits x-crmportal header so the response includes ALL
  // records (investor posts included), not just the portal user's own records.
  // Fall back to portalList if unscoped returns nothing or errors.
  let raw: ZohoRecord[] = [];
  if (isFounder) {
    try {
      raw = await portalListUnscoped(MODULE, listParams);
    } catch {
      raw = await portalList(MODULE, listParams);
    }
    if (raw.length === 0) raw = await portalList(MODULE, listParams);
  } else {
    raw = await zohoList(MODULE, listParams);
  }
  const activities = raw.map(fromRecord);

  const missing = activities.filter(a => !a.content && !a.id.startsWith('local_'));
  if (missing.length === 0) return activities;

  const fetched = await Promise.allSettled(
    missing.slice(0, 50).map(a =>
      zohoGetById(MODULE, a.id, ALL_FIELDS)
    )
  );
  const byId = new Map<string, CRMActivity>();
  fetched.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) byId.set(missing[i].id, fromRecord(r.value));
  });
  return activities.map(a => byId.get(a.id) ?? a);
}

// Founders (portal users) cannot write to My_Activities, so they post to the
// portal-writable Feed_Submissions module. A Zoho workflow function then relays
// each submission into My_Activities (Public), where the shared feed reads from.
// Feed_Submissions has the same field API names, so the payload is identical.
const FOUNDER_POST_MODULE = 'Feed_Submissions';

export interface CreateActivityResult {
  id: string;
  /** The Document_Ref pointer, already resolved — same value the server ends
   *  up persisting — so the caller can render the attachment immediately
   *  without waiting for a refetch. Empty if the post had no file. */
  fileRef: string;
}

export async function createCRMActivity(fields: CRMActivityFields, pendingFileId?: string): Promise<CreateActivityResult> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
    const raw = (fields as Record<string, string>)[formKey] ?? '';
    if (raw !== '') payload[crmKey] = raw;
  }
  const isFounder = loadRole() === 'founder';
  if (pendingFileId) payload[ACTIVITY_FILE_FIELD] = [{ file_id: pendingFileId }];

  const id = isFounder ? await portalCreate(FOUNDER_POST_MODULE, payload) : await zohoCreate(MODULE, payload);

  if (!pendingFileId) return { id, fileRef: '' };

  // The record's own id — and therefore the {module, recordId} pointer — is
  // only known now that creation has returned. For a founder, the pointer
  // targets Feed_Submissions (where the file was actually uploaded); the
  // relay workflow function independently sets the same value on the
  // My_Activities copy it creates, using the same recordId as a parameter.
  const fileRef = JSON.stringify({ module: isFounder ? FOUNDER_POST_MODULE : MODULE, recordId: id });

  if (!isFounder) {
    // Investor: persist it with a follow-up update — best-effort, the
    // activity itself already saved even if this fails.
    try {
      await zohoUpdate(MODULE, id, { [FIELD_MAP.fileRef]: fileRef });
    } catch (err) {
      console.warn('[Activities] Failed to attach file reference:', err);
    }
  }
  // Founder: no follow-up update is possible or safe here (Feed_Submissions
  // isn't updatable this way and the relay's timing is uncontrollable) — the
  // relay must construct Document_Ref itself. Returning the same value here
  // just lets the client render immediately without waiting for the relay.

  return { id, fileRef };
}

export async function updateCRMActivity(id: string, fields: CRMActivityFields): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const [formKey, crmKey] of Object.entries(FIELD_MAP)) {
    const raw = (fields as Record<string, string>)[formKey] ?? '';
    payload[crmKey] = raw; // allow empty to clear fields
  }
  return zohoUpdate(MODULE, id, payload);
}

export async function deleteCRMActivity(id: string): Promise<void> {
  return zohoDelete(MODULE, id);
}

// ─── Uploaded activity files (Photo/Video/Document attachments) ─────────────
// These live directly on the activity's own record (My_Activities for an
// investor's post, or Feed_Submissions for a founder's — never My_Documents,
// so they never show up on the Documents page) via the Activity_File_Upload
// File Upload field. `fileRef` (the Document_Ref CRM field, repurposed) is a
// small JSON pointer — {module, recordId} — to whichever record actually
// holds the file, since a founder's relayed My_Activities copy is a
// DIFFERENT record than the Feed_Submissions one the file was uploaded to.
// The pointer is deliberately minimal (no pre-resolved attachment id) —
// resolveActivityFileUrl always re-fetches the field fresh, so there's no
// staleness/race risk with the relay's timing.
const ACTIVITY_FILE_FIELD = 'Activity_File_Upload';

export interface ActivityFileRef {
  module: 'My_Activities' | 'Feed_Submissions';
  recordId: string;
}

export function parseActivityFileRef(raw: string): ActivityFileRef | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<ActivityFileRef>;
    if (d && (d.module === 'My_Activities' || d.module === 'Feed_Submissions') && d.recordId) {
      return { module: d.module, recordId: d.recordId };
    }
  } catch { /* malformed */ }
  return null;
}

/** Uploads a file and returns its raw file_id, for use with createCRMActivity's pendingFileId. */
export async function uploadActivityFile(file: File): Promise<string> {
  return loadRole() === 'founder' ? portalUploadFile(file, file.name) : zohoUploadFile(file, file.name);
}

// A File Upload field reads back as an array of objects, but the admin CRM API
// and the portal API return DIFFERENT key names for the attachment's own id —
// see the identical gotcha documented in crmDocuments.ts's parseFileUpload.
function parseFileUploadAttachmentId(v: unknown): string {
  const arr = Array.isArray(v) ? v : [];
  const f = arr[0] as Record<string, unknown> | undefined;
  if (!f) return '';
  return String(f['id'] ?? f['attachment_Id'] ?? f['attachment_Id__s'] ?? '');
}

export async function resolveActivityFileUrl(ref: ActivityFileRef): Promise<{ url: string; revoke: boolean }> {
  const isFounder = loadRole() === 'founder';
  const record = isFounder
    ? await portalGetById(ref.module, ref.recordId, ACTIVITY_FILE_FIELD).catch(() => portalGetById(ref.module, ref.recordId))
    : await zohoGetById(ref.module, ref.recordId, ACTIVITY_FILE_FIELD);
  if (!record) throw new Error('The record holding this file could not be found.');
  const attachmentId = parseFileUploadAttachmentId(record[ACTIVITY_FILE_FIELD]);
  if (!attachmentId) throw new Error('No file attached to this post.');
  const blob = await downloadFieldFile(ref.module, ref.recordId, attachmentId, isFounder);
  return { url: URL.createObjectURL(blob), revoke: true };
}

// ─── Poll voting ────────────────────────────────────────────────────────────
// A poll's own record only ever stores {question, options} in Poll_Data — never
// vote tallies. Casting a vote creates a small separate activity record (same
// create path/module-routing as a normal post — Feed_Submissions relay for
// founders, direct create for investors) marked Activity_Type=POLL_VOTE_TYPE,
// with the vote itself JSON-encoded in Content. This sidesteps two hard
// platform limits: founders have no update path to My_Activities at all (see
// "Portal restrictions" in CLAUDE.md), and mutating a shared vote-tally field
// directly would race if two people vote at the same moment. Tallying reads
// back whatever vote records are visible to the viewer (see parsePollVotes) —
// already-fetched activities are reused, no extra network call.
export const POLL_VOTE_TYPE = 'poll_vote';

export interface PollVote {
  activityId: string;
  optionIndex: number;
  voterEmail: string;
  voterName: string;
}

export async function castPollVote(vote: PollVote, authorRole: 'investor' | 'founder'): Promise<void> {
  const payload: Record<string, unknown> = {
    [FIELD_MAP.title]: 'Poll vote',
    [FIELD_MAP.activityType]: POLL_VOTE_TYPE,
    [FIELD_MAP.content]: JSON.stringify({ ...vote, voterEmail: vote.voterEmail.toLowerCase() }),
    [FIELD_MAP.authorName]: vote.voterName,
    [FIELD_MAP.authorRole]: authorRole,
    [FIELD_MAP.visibility]: 'public',
  };
  if (authorRole === 'founder') {
    await portalCreate(FOUNDER_POST_MODULE, payload);
  } else {
    await zohoCreate(MODULE, payload);
  }
}

/** Extracts votes for one poll out of an already-fetched activities list. */
export function parsePollVotes(activities: CRMActivity[], activityId: string): PollVote[] {
  const votes: PollVote[] = [];
  for (const a of activities) {
    if (a.activityType !== POLL_VOTE_TYPE || !a.content) continue;
    try {
      const parsed = JSON.parse(a.content) as PollVote;
      if (parsed.activityId === activityId) votes.push(parsed);
    } catch { /* skip malformed vote record */ }
  }
  return votes;
}

// ─── Poll payload shape (Poll_Data JSON) ─────────────────────────────────────

export interface PollData {
  question: string;
  options: string[];
}

export function parsePollData(raw: string): PollData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<PollData>;
    if (d && typeof d.question === 'string' && Array.isArray(d.options) && d.options.length > 0) {
      return { question: d.question, options: d.options as string[] };
    }
  } catch { /* malformed */ }
  return null;
}


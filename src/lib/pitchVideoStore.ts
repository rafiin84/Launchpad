/**
 * IndexedDB store for pitch video blobs.
 * localStorage has a ~5 MB quota; IndexedDB supports hundreds of MB.
 *
 * ⚠️  IndexedDB (and localStorage) are per-origin and per-browser.
 *     A blob saved on localhost will NOT be found on vercel.app.
 *     We also keep a tiny localStorage flag (`lp_hasvideo_<id>`) so the
 *     UI can tell when a video was uploaded in a different session/origin.
 */

const DB_NAME    = 'launchpad_files';
const DB_VERSION = 1;
const STORE      = 'pitch_videos';
const LS_KEY     = (id: string) => `lp_hasvideo_${id}`;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Save a video Blob keyed by application ID. Also sets a localStorage flag. */
export async function savePitchVideo(appId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, appId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
  try { localStorage.setItem(LS_KEY(appId), '1'); } catch { /* quota */ }
}

/**
 * Load the stored Blob and return a temporary object URL for it.
 * Returns null if nothing is stored for that ID.
 * ⚠️  The caller should revoke the URL with URL.revokeObjectURL() when done.
 */
export async function loadPitchVideoUrl(appId: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(appId);
    req.onsuccess = () =>
      resolve(req.result ? URL.createObjectURL(req.result as Blob) : null);
    req.onerror   = () => reject(req.error);
  });
}

/** Remove a stored video (e.g. when user clears it or switches to URL mode). */
export async function deletePitchVideo(appId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(appId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
  try { localStorage.removeItem(LS_KEY(appId)); } catch { /* ignore */ }
}

/** Returns true if a blob is stored for this ID in IndexedDB. */
export async function hasPitchVideo(appId: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count(appId);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Returns true if a video was EVER uploaded for this ID
 * (even if the blob is no longer in IndexedDB — e.g. different origin/session).
 * Uses the localStorage flag set by savePitchVideo().
 */
export function videoWasUploaded(appId: string): boolean {
  try { return localStorage.getItem(LS_KEY(appId)) === '1'; } catch { return false; }
}

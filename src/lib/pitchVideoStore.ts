/**
 * IndexedDB store for pitch video blobs.
 * localStorage has a ~5 MB quota; IndexedDB supports hundreds of MB.
 */

const DB_NAME    = 'launchpad_files';
const DB_VERSION = 1;
const STORE      = 'pitch_videos';

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

/** Save a video Blob keyed by application ID. */
export async function savePitchVideo(appId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, appId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(appId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/** Returns true if a blob is stored for this ID. */
export async function hasPitchVideo(appId: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count(appId);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror   = () => reject(req.error);
  });
}

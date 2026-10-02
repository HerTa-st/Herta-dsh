                                                                 

/**
 * The drawn glyph sheet, kept between launches (M-opening-5, 2026-09-25).
 *
 * The opening waits for its sheet (M-opening-4), and drawing it — ~2.6k
 * glyphs, most of the time the worker's own font and canvas start-up — put
 * the first frame ~0.1 s later on every launch. The drawing only changes with
 * what goes into it, and the window's size is restored between launches, so
 * the sheet is stored once as a PNG in IndexedDB and decoded on the launches
 * after. One entry only: a new key replaces the old one.
 */

/** Bump when the sheet's drawing changes in a way the key cannot see. */
export const SHEET_CACHE_VERSION = 1;

/** What a sheet's pixels depend on, as one string. `engine` is the
 *  browser's user agent: a new Chromium may rasterize text differently, and
 *  an app update brings one. */
export function sheetCacheKey(
  request   
                                      
                         
                         
                                
                            
   ,
  engine        ,
)         {
  return JSON.stringify([
    SHEET_CACHE_VERSION,
    request.sizes,
    request.dpr,
    request.ink,
    request.fontFamily,
    request.glyphs,
    engine,
  ]);
}

/** A stored sheet: its pixels and its layout. */
                              
                     
                                                 
 

/**
 * Whether a stored record is a sheet the player can read: a PNG and one
 * entry per size, each with its cell and a position for every glyph. The
 * key covers the pixels, not the shape — a build that changed the entry
 * shape on the same Electron, or a corrupted record, read as valid and
 * threw inside the draw loop (review 2026-09-30); a sheet that fails this
 * is drawn afresh.
 */
export function validCachedSheet(
  record         ,
  glyphCount        ,
)                        {
  if (typeof record !== "object" || record === null) return false;
  const r = record                                        ;
  if (!(r.png instanceof Blob) || !Array.isArray(r.entries)) return false;
  const finite = (v         )          =>
    typeof v === "number" && Number.isFinite(v);
  return r.entries.every((e         ) => {
    if (typeof e !== "object" || e === null) return false;
    const entry = e     
                   
                  
                  
                    
     ;
    return (
      finite(entry.px) &&
      finite(entry.w) &&
      finite(entry.h) &&
      Array.isArray(entry.pos) &&
      entry.pos.length === glyphCount * 2 &&
      entry.pos.every(finite)
    );
  });
}

const DB_NAME = "herta-opening";
const STORE = "glyph-sheet";
const ENTRY = "latest";

                                            
                       
 

function openDb(idb                        )                              {
  if (idb === undefined) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const open = idb.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
      open.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** The stored sheet for `key`, or null (none, another key, or no storage).
 *  Never throws. */
export async function readCachedSheet(
  key        ,
  idb                         = globalThis.indexedDB,
)                              {
  const db = await openDb(idb);
  if (db === null) return null;
  return new Promise((resolve) => {
    try {
      const get = db
        .transaction(STORE, "readonly")
        .objectStore(STORE)
        .get(ENTRY);
      get.onsuccess = () => {
        const record = get.result                            ;
        db.close();
        resolve(
          record !== undefined && record.key === key
            ? { png: record.png, entries: record.entries }
            : null,
        );
      };
      get.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/** Store `sheet` under `key`, replacing whatever was stored. Never throws. */
export async function writeCachedSheet(
  key        ,
  sheet             ,
  idb                         = globalThis.indexedDB,
)                {
  const db = await openDb(idb);
  if (db === null) return;
  await new Promise      ((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const record               = { key, ...sheet };
      tx.objectStore(STORE).put(record, ENTRY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}


//# sourceURL=packages__gui__src__renderer__components__Opening__glyph-sheet-cache.ts
import {
  BASE_LAYER_STYLE,
  OPENING_GLYPHS,
  openingGlyphSizes,
  RENDER_OPTIONS,
  resolveLayerStyles,
} from "./ascii-renderer.js";
             
                  
                    
                                 
                                                            

/** The bundled sheet worker, or null where the platform has no `Worker` or
 *  `OffscreenCanvas` (jsdom). Vite emits the worker's entry as a chunk of
 *  its own from this exact expression; the CSP's `worker-src 'self'` admits
 *  it. */
function spawnBundledWorker()                {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return null;
  }
  return new Worker(new URL("./glyph-sheet.worker.js", import.meta.url), {
    type: "module",
  });
}

let pending                                      = null;

/** How long the worker may go on storing the sheet after answering. */
const WORKER_GRACE_MS = 15_000;
/** How long the worker may take to answer at all before it is ended. */
const WORKER_CAP_MS = 60_000;

/**
 * Starts drawing the opening's glyph sheet (see `glyph-sheet.worker.ts`) for
 * this window's size, device scale and theme. Called once, first thing at
 * boot. Never throws: where no worker can start, the sheet is null and the
 * opening draws text, as before.
 */
export function startOpeningGlyphSheet(
  spawnWorker                      = spawnBundledWorker,
)       {
  if (pending !== null) return;
  let worker               ;
  try {
    worker = spawnWorker();
  } catch {
    worker = null;
  }
  if (worker === null) {
    pending = Promise.resolve(null);
    return;
  }
  const w = worker;
  // The theme the opening will draw in: index.html stamps it before any
  // script runs, and the opening reads the same stamp at mount.
  const dark = document.documentElement.dataset.theme === "dark";
  const request                    = {
    sizes: openingGlyphSizes(window.innerWidth, window.innerHeight),
    fontFamily: RENDER_OPTIONS.fontFamily,
    glyphs: OPENING_GLYPHS,
    dpr: window.devicePixelRatio || 1,
    ink:
      resolveLayerStyles(undefined, dark).default?.foreground ??
      BASE_LAYER_STYLE.foreground,
  };
  pending = new Promise                     ((resolve) => {
    // A worker that never answers — a storage open that neither succeeds
    // nor errors — would keep its thread and canvas for the session; the
    // opening itself waits far less (review 2026-09-30).
    const cap = setTimeout(() => settle(null, true), WORKER_CAP_MS);
    const settle = (sheet                     , failed         )       => {
      clearTimeout(cap);
      w.onmessage = null;
      w.onerror = null;
      w.onmessageerror = null;
      if (failed) w.terminate();
      // After its answer the worker may still be storing the sheet for the
      // next launch, and closes itself when done; this only bounds a store
      // that never finishes.
      else setTimeout(() => w.terminate(), WORKER_GRACE_MS);
      resolve(sheet);
    };
    w.onmessage = (event                               ) =>
      settle(event.data.type === "sheet" ? event.data.sheet : null, false);
    w.onerror = () => settle(null, true);
    w.onmessageerror = () => settle(null, true);
  });
  w.postMessage(request);
}

/** The sheet once drawn; null when there is none (never started, no
 *  worker, nothing to draw, or released). */
export function openingGlyphSheet()                               {
  return pending ?? Promise.resolve(null);
}

/** The opening is over: free the sheet's pixels. */
export function releaseOpeningGlyphSheet()       {
  const held = pending;
  pending = Promise.resolve(null);
  void held?.then((sheet) => sheet?.bitmap.close());
}

/** Test hook. */
export function resetOpeningGlyphSheetForTest()       {
  pending = null;
}


//# sourceURL=packages__gui__src__renderer__components__Opening__glyph-sheet.ts
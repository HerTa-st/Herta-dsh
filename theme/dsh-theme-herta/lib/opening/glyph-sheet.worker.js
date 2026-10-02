import {
  readCachedSheet,
  sheetCacheKey,
  validCachedSheet,
  writeCachedSheet,
} from "./glyph-sheet-cache.js";
import {
  layoutOpeningSheet,
  OPENING_SHEET_WIDTH,
                    
} from "./glyph-sheet-layout.js";

/**
 * The opening's glyph sheet, on its own thread while the app boots
 * (M-opening-4, 2026-09-25; before that this thread only measured the
 * glyphs to warm the text cache, M-opening-2).
 *
 * Every symbol at every size the draw loop can ask for, at the device's
 * pixel scale, in the ink: ~2.6k glyphs at a 1440-wide window. Drawing it
 * took 0.3 s alone and ~0.55 s alongside a cold boot, much of it the thread's
 * own start-up (its fonts, its canvas). So a drawn sheet is kept between
 * launches (`glyph-sheet-cache.ts`, M-opening-5): a launch with the same
 * window, display scale, theme and engine decodes the stored PNG instead.
 * The canvas is a software one: the text is rasterized on this thread, not
 * in the GPU process the opening's frames queue for.
 */

/** What to draw. `sizes` are CSS px; `dpr` scales them to the device. */
                                    
                                    
                              
                          
                       
                       
 

/** The sheet, or `none` when there is none to draw (too large, or no 2D
 *  context) — the opening then draws text, as before. */
                             
                                                            
                              

function reply(message                 , transfer                 = [])       {
  // The options form: this file is typed against the window's globals, and a
  // worker's postMessage takes `{ transfer }` just the same.
  postMessage(message, { transfer });
}

addEventListener("message", (event                                 ) => {
  void makeSheet(event.data).finally(() => close());
});

async function makeSheet(request                   )                {
  const { sizes, fontFamily, glyphs, dpr, ink } = request;
  const key = sheetCacheKey(request, navigator.userAgent);
  const cached = await readCachedSheet(key);
  if (cached !== null && validCachedSheet(cached, glyphs.length)) {
    try {
      const bitmap = await createImageBitmap(cached.png, {
        premultiplyAlpha: "premultiply",
      });
      const sheet               = {
        bitmap,
        dpr,
        ink,
        glyphs,
        entries: cached.entries,
        origin: "kept",
      };
      reply({ type: "sheet", sheet }, [bitmap]);
      return;
    } catch {
      // A stored PNG that no longer decodes: draw a new one.
    }
  }

  const layout = layoutOpeningSheet(sizes, dpr, glyphs.length);
  if (layout === null) {
    reply({ type: "none" });
    return;
  }
  const canvas = new OffscreenCanvas(OPENING_SHEET_WIDTH, layout.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx === null) {
    reply({ type: "none" });
    return;
  }
  // The loop's own alignment, so a glyph sits in its cell as fillText would
  // place it at the cell's centre.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;
  for (const entry of layout.entries) {
    ctx.font = `${entry.px * dpr}px ${fontFamily}`;
    for (let i = 0; i < glyphs.length; i += 1) {
      const x = entry.pos[2 * i] ?? 0;
      const y = entry.pos[2 * i + 1] ?? 0;
      ctx.fillText(glyphs[i]          , x + entry.w / 2, y + entry.h / 2);
    }
  }
  // The PNG is taken from the canvas as it stands, before the bitmap empties
  // it; the opening gets its sheet first and the store happens after.
  const png = canvas.convertToBlob({ type: "image/png" });
  const bitmap = canvas.transferToImageBitmap();
  reply(
    {
      type: "sheet",
      sheet: {
        bitmap,
        dpr,
        ink,
        glyphs,
        entries: layout.entries,
        origin: "drawn",
      },
    },
    [bitmap],
  );
  try {
    await writeCachedSheet(key, { png: await png, entries: layout.entries });
  } catch {
    // Not kept: the next launch draws it again.
  }
}


//# sourceURL=packages__gui__src__renderer__components__Opening__glyph-sheet.worker.ts
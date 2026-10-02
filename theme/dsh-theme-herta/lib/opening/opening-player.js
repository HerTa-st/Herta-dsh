import {
  alphaFromStrength,
  BASE_LAYER_STYLE,
  backdropVeil,
  buildCellLayerNames,
  decodeBase64ToBytes,
  fontSizeFromStrength,
  getInterpolatedBrightness,
  getStrength,
  getSymbolState,
  openingGlyphSizes,
  precomputeCellTimings,
  quantizeGlyphSize,
  RENDER_OPTIONS,
  resolveLayerStyles,
  revealEnvelope,
                   
} from "./ascii-renderer.js";
                                                                               

/** Playback fraction at which the splash begins dissolving: the figure AND the
 *  white backdrop fade out together (carried by the overlay's opacity) over
 *  [DISSOLVE_START, DISSOLVE_END], revealing the connect screen — so both are
 *  gone exactly as it is fully shown. The figure holds on white before this.
 *  Adopted via the inline tuner (user 2026-06-20). */
export const DISSOLVE_START = 0.38;
/** Playback fraction at which the splash is fully transparent — connect screen
 *  fully shown, figure fully gone. */
export const DISSOLVE_END = 0.94;

/** A segment's wall-clock playback length and its dissolve slice, in ms. */
export function openingTimeline(data             )   
                                  
                              
  {
  const duration = data.frameCount / data.fps;
  const wallDurationMs = (duration / RENDER_OPTIONS.playbackRate) * 1000;
  return {
    wallDurationMs,
    dissolveMs: (DISSOLVE_END - DISSOLVE_START) * wallDurationMs,
  };
}

/** The 2D context the opening draws with: a DOM canvas's on the main thread,
 *  an OffscreenCanvas's on the draw worker. */
                            
                            
                                      

/** The veil at `alpha`. It matches the shell surface it dissolves into
 *  (dark: --shell's 13,17,22; light: white), so the fade-out is seamless in
 *  both themes. */
function veilFill(dark         , alpha        )         {
  return dark ? `rgba(13, 17, 22, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
}

/**
 * Size the surface and paint what the first frame opens on, the veil at
 * playback 0 (opaque), before the segment has loaded. The draw worker does
 * this as soon as it holds the canvas: the first draw creates the canvas's
 * GPU context (~85 ms on a cold start), and this way it happens in the
 * load's shadow, not in front of the first frame.
 */
export function paintOpeningCover(
  surface                                   ,
  ctx                ,
  dark         ,
  width        ,
  height        ,
  dpr        ,
)       {
  sizeSurface(surface, width, height, dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = veilFill(dark, backdropVeil(0));
  ctx.fillRect(0, 0, width, height);
}

/**
 * Give the surface its backing size; true when that wiped it. Setting a
 * canvas's size wipes it even when the size is unchanged, and a worker's
 * canvas reaches the screen at the end of every task: the draw worker's
 * wiped canvas showed as a frame of the blue app behind the splash, at the
 * start of the play and on a window resize mid-animation (owner 2026-09-25).
 * So an unchanged size is left alone, and every caller that wipes repaints
 * in the same task.
 */
function sizeSurface(
  surface                                   ,
  width        ,
  height        ,
  dpr        ,
)          {
  const w = Math.floor(width * dpr);
  const h = Math.floor(height * dpr);
  if (surface.width === w && surface.height === h) return false;
  surface.width = w;
  surface.height = h;
  return true;
}

                                      
                                                                   
                                                      
                                                    
                                                                          
                                                                           
                                       
                                 
 

                                
                                                                              
                                                           
                                                                           
                                                   
                                 
                                                                                
                       
 

/**
 * One play of a segment on a 2D context — the whole draw loop, with no idea
 * which thread it runs on (ported from preview_video_ascii.html's draw loop,
 * made one-shot). The host owns the animation frames and the view size: the
 * draw worker (`opening-draw.worker.ts`) on a transferred canvas, or the main
 * thread when no worker can start. `surface` is the canvas `ctx` draws on
 * (its backing size is set here). `mountMs` is the host's clock at start, in
 * the same time base as the frame times it will pass.
 *
 * With a `sheet` (`glyph-sheet-layout.ts`, M-opening-4) each glyph is copied
 * from it to a whole device pixel instead of drawn as text — whenever the
 * sheet matches: drawn at this device scale, in this segment's ink, and
 * holding every size this view can ask for. Otherwise the loop draws text.
 */
export function createOpeningPlayer(
  surface                                   ,
  ctx                ,
  data             ,
  dark         ,
  events                     ,
  mountMs        ,
  sheet                      = null,
)                {
  const duration = data.frameCount / data.fps;
  const { dissolveMs } = openingTimeline(data);
  const frameBytes = decodeBase64ToBytes(data.framesBase64);
  // Night mode (2026-07-13): the splash follows the stamped theme — light
  // ink on a dark veil over the dark shell. The host resolves it ONCE at
  // mount: the index.html early stamp (localStorage hint) lands before
  // React, so a cold dark start reads correctly; a mid-splash flip isn't
  // reachable (Settings can't open under the overlay).
  //
  // Per-layer ink styles + a per-cell layer lookup, resolved once for the
  // segment (the cell layout / layer ranges are fixed across frames).
  const layerStyles = resolveLayerStyles(data.layers, dark);
  const cellLayerNames = buildCellLayerNames(data.cells.length, data.layers);
  // Per-cell loop invariants (seed floors, flip interval, phase offset),
  // resolved once — the hot loop below runs ~3k–9k cells per frame while
  // the app is still bootstrapping (M-opening-1).
  const timings = precomputeCellTimings(data.cells);
  // Frozen-clock skip (user 2026-07-14): animation frames freeze while the
  // window is minimized but the wall clock keeps running. A frame gap this
  // large means the window was hidden — and if the resumed frame lands past
  // the dissolve point, the splash's moment has already passed.
  const GAP_SKIP_MS = 1000;
  let startMs                = null;
  let lastFrameMs                = null;
  let done = false;
  let viewW = 0;
  let viewH = 0;
  let dpr = 1;

  // The sheet's cells by size and its symbols by glyph, when it can serve
  // this segment at all: every layer must draw in the ink it was drawn in.
  const sheetCells = new Map                           ();
  const sheetGlyphs = new Map                ();
  if (
    sheet !== null &&
    Object.values(layerStyles).every((s) => s.foreground === sheet.ink)
  ) {
    for (const entry of sheet.entries) sheetCells.set(entry.px, entry);
    for (let g = 0; g < sheet.glyphs.length; g += 1) {
      sheetGlyphs.set(sheet.glyphs[g]          , g);
    }
  }
  const geometry = {
    width: data.width,
    height: data.height,
    maxCellSize: data.cells.reduce((m, c) => Math.max(m, c[2]), 0),
  };
  // Decided per view size: the sheet serves only a view it was drawn for.
  let useSheet = false;
  // The instant finish wiped the canvas for good: nothing repaints it.
  let over = false;

  const player                = {
    resize(width, height, nextDpr) {
      viewW = width;
      viewH = height;
      dpr = nextDpr;
      const wiped = sizeSurface(surface, width, height, dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      useSheet =
        sheet !== null &&
        sheetCells.size > 0 &&
        sheet.dpr === dpr &&
        openingGlyphSizes(width, height, geometry).every((px) =>
          sheetCells.has(px),
        );
      // A wiped canvas is repainted before this task ends (see sizeSurface):
      // the last frame again, or the cover the first frame opens on.
      if (!wiped || over) return;
      if (lastFrameMs === null) {
        ctx.fillStyle = veilFill(dark, backdropVeil(0));
        ctx.fillRect(0, 0, viewW, viewH);
      } else {
        player.frame(lastFrameMs);
      }
    },

    frame(timeMs) {
      // The sheet path leaves the canvas in device pixels; every frame
      // starts back in CSS pixels.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Restored after the timeline expired while hidden (user 2026-07-14):
      // painting the resumed frame would show ONE full-hold figure and then
      // run the whole multi-second dissolve — a ghost splash minutes later.
      // Detect the frozen-clock gap (vs the previous frame, or vs MOUNT when
      // the first frame never ran) landing at/past the dissolve point, wipe
      // the canvas, and complete instantly instead.
      const gapMs = timeMs - (lastFrameMs ?? mountMs);
      lastFrameMs = timeMs;
      const wouldElapse =
        ((timeMs - (startMs ?? timeMs - gapMs)) / 1000) *
        RENDER_OPTIONS.playbackRate;
      if (gapMs > GAP_SKIP_MS && wouldElapse >= duration * DISSOLVE_START) {
        ctx.clearRect(0, 0, viewW, viewH);
        over = true;
        if (!done) {
          done = true;
          events.onInstant();
        }
        return false;
      }
      if (startMs === null) startMs = timeMs;
      const elapsed = ((timeMs - startMs) / 1000) * RENDER_OPTIONS.playbackRate;
      const videoTime = Math.min(elapsed, duration);
      const framePosition = videoTime * data.fps;

      const p = duration > 0 ? videoTime / duration : 1;
      // outPortion 0: the figure does NOT shrink back on its own — it holds
      // full and dissolves via the overlay's opacity fade-out, in lockstep
      // with the white backdrop going transparent (the unified [38%, 94%]
      // dissolve).
      const reveal = revealEnvelope(p, RENDER_OPTIONS.revealInPortion, 0);
      const veil = backdropVeil(p);

      ctx.clearRect(0, 0, viewW, viewH);
      ctx.fillStyle = veilFill(dark, veil);
      ctx.fillRect(0, 0, viewW, viewH);

      const scale = Math.min(viewW / data.width, viewH / data.height);
      const offsetX = (viewW - data.width * scale) / 2;
      const offsetY = (viewH - data.height * scale) / 2;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Canvas state caches: `ctx.font =` re-parses a CSS font string on
      // every assignment, so an unchanged string is skipped. The size is
      // quantized to GLYPH_SIZE_STEP_PX (the deliberate approximation of
      // M-opening-1, coarsened by M-opening-2): the step bounds how many
      // (symbol, size) pairs the text engine must rasterize.
      let lastFont = "";
      let lastFill = "";
      const drawText = (
        symbol        ,
        px        ,
        fill        ,
        alpha        ,
        x        ,
        y        ,
      )       => {
        const font = `${px}px ${RENDER_OPTIONS.fontFamily}`;
        if (font !== lastFont) {
          ctx.font = font;
          lastFont = font;
        }
        if (fill !== lastFill) {
          ctx.fillStyle = fill;
          lastFill = fill;
        }
        ctx.globalAlpha = alpha;
        ctx.fillText(symbol, x, y);
      };
      // Sheet copies are placed in device pixels: the nearest whole one to
      // where fillText would centre the glyph.
      const bitmap = useSheet && sheet !== null ? sheet.bitmap : null;
      if (bitmap !== null) ctx.setTransform(1, 0, 0, 1, 0, 0);
      const copy = (
        entry                   ,
        symbol        ,
        alpha        ,
        x        ,
        y        ,
        px        ,
        fill        ,
      )       => {
        const g = sheetGlyphs.get(symbol);
        if (bitmap === null || g === undefined) {
          // Not a symbol the sheet holds: text, in CSS pixels.
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawText(symbol, px, fill, alpha, x, y);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          return;
        }
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          bitmap,
          entry.pos[2 * g] ?? 0,
          entry.pos[2 * g + 1] ?? 0,
          entry.w,
          entry.h,
          Math.round(x * dpr - entry.w / 2),
          Math.round(y * dpr - entry.h / 2),
          entry.w,
          entry.h,
        );
      };

      for (let i = 0; i < data.cells.length; i += 1) {
        const cell = data.cells[i];
        if (cell === undefined) continue;
        const style =
          layerStyles[cellLayerNames[i] ?? "default"] ??
          layerStyles.default ??
          BASE_LAYER_STYLE;
        const brightness = getInterpolatedBrightness(
          frameBytes,
          data.activeCount,
          data.frameCount,
          i,
          framePosition,
        );
        // Strength once per cell (it's a Math.pow), alpha BEFORE font math:
        // a fully transparent cell exits without paying for font sizing or
        // symbol hashing. Same drawn set as before — the per-symbol alpha
        // guards and the minDrawFontSize skip are unchanged.
        const strength = getStrength(brightness, style.gamma);
        const baseAlpha = alphaFromStrength(strength, style, reveal);
        if (baseAlpha <= 0.001) continue;
        const fontSize =
          fontSizeFromStrength(strength, cell[2], style, reveal) * scale;
        if (fontSize < style.minDrawFontSize) continue;

        const x = offsetX + cell[0] * scale;
        const y = offsetY + cell[1] * scale;
        const state = getSymbolState(
          timings.seedXs[i] ?? 0,
          timings.seedYs[i] ?? 0,
          brightness,
          elapsed,
          timings.intervals[i],
          timings.phaseOffsets[i],
        );

        const px = quantizeGlyphSize(fontSize);
        const entry = bitmap !== null ? sheetCells.get(px) : undefined;
        const ca = baseAlpha * state.currentAlpha;
        const na = baseAlpha * state.nextAlpha;
        if (entry !== undefined) {
          if (state.currentSymbol && ca > 0.001) {
            copy(entry, state.currentSymbol, ca, x, y, px, style.foreground);
          }
          if (state.nextSymbol && na > 0.001) {
            copy(entry, state.nextSymbol, na, x, y, px, style.foreground);
          }
          continue;
        }
        if (bitmap !== null) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (state.currentSymbol && ca > 0.001) {
          drawText(state.currentSymbol, px, style.foreground, ca, x, y);
        }
        if (state.nextSymbol && na > 0.001) {
          drawText(state.nextSymbol, px, style.foreground, na, x, y);
        }
        if (bitmap !== null) ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      ctx.globalAlpha = 1;
      // Begin the dissolve at DISSOLVE_START (single-fire), but KEEP drawing
      // so the figure keeps animating as the overlay's opacity fades it out —
      // the splash unmounts at DISSOLVE_END (onDone), before the last frame.
      if (elapsed >= duration * DISSOLVE_START && !done) {
        done = true;
        events.onDissolve(dissolveMs);
      }
      return elapsed < duration;
    },

    usesSheet() {
      return useSheet;
    },
  };
  return player;
}


//# sourceURL=packages__gui__src__renderer__components__Opening__opening-player.ts
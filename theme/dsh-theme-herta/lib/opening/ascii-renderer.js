/**
 * Pure helpers for the opening ASCII-halftone renderer, ported from
 * reference_UX_design/HertaHalftone/V2/preview_video_ascii.html. All functions
 * are deterministic — symbol selection uses an integer-hash PRNG (random01),
 * NOT Math.random(), so frames don't flicker (the guide's key rule).
 *
 * V2 introduced layered "scene" segments: the cell array is split into named
 * ranges (a fine `detail` layer for the character + a `coarse` layer for the
 * background) that each render with their own ink style. Non-layered segments
 * fall back to a single `default` style, so older single-layer data still
 * renders unchanged.
 */

/** One pre-cut opening segment asset (see scripts/cut-opening-segments.mjs). */
                              
                        
                         
                          
                       
                              
                               
                                                                   
                                
                                                                           
                                                
 

/** A contiguous range of cells `[start, start+count)` rendered as one layer. */
                               
                        
                         
                         
 

                            
                        
                         
                          
 

/**
 * Per-layer ink style. Drives darkness→ink mapping for one layer of cells.
 * `inkOpacity` scales the final alpha (so the coarse background reads lighter
 * than the character), and `alphaPower` shapes how quickly midtones gain ink.
 */
                             
                              
                              
                         
                              
                               
                                     
                                   
 

/** Global render config (everything that is NOT per-layer ink styling). */
export const RENDER_OPTIONS = {
  background: "#ffffff",
  playbackRate: 1,
  charGroups: [
    { name: "letters", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", weight: 1 },
    { name: "numbers", chars: "0123456789", weight: 1 },
    { name: "symbols", chars: "/[]{}<>+=-*#@$%&", weight: 1 },
  ]                        ,
  fontFamily: "Consolas, Menlo, Monaco, 'Courier New', monospace",
  symbolChangeIntervalMin: 0.35,
  symbolChangeIntervalMax: 1.2,
  symbolFadePortion: 0.25,
  revealInPortion: 0.2,
  revealOutPortion: 0.35,
  frostedVeilAlpha: 0.35,
}         ;

/**
 * Base ink style — used for the `default` and `detail` layers. Matches the V2
 * preview's base options (soft charcoal ink at near-full opacity, gamma 0.85).
 */
export const BASE_LAYER_STYLE             = {
  foreground: "rgba(60, 60, 67, 1)",
  inkOpacity: 0.92,
  gamma: 0.85,
  alphaPower: 1,
  minFontSize: 2.0,
  maxFontSizeFactor: 0.85,
  minDrawFontSize: 0.7,
};

/** Night-mode glyph ink (slice 2 bugfix, 2026-07-13): the charcoal base
 *  vanishes on the dark splash veil, so dark mode draws a cool light ink —
 *  the same figure, inverted field. Only the foreground swaps; opacity/
 *  gamma stay, so the reveal reads identically. */
export const DARK_FOREGROUND = "rgba(208, 218, 228, 1)";

/**
 * Per-layer overrides merged onto {@link BASE_LAYER_STYLE}, keyed by layer
 * name. Matches the V2 preview's `options.layerStyles`. The `coarse`
 * background renders as lighter UI ink (lower opacity, higher gamma).
 */
export const LAYER_STYLE_OVERRIDES           
                                     
  = {
  coarse: { inkOpacity: 0.48, gamma: 1.35, alphaPower: 1.15 },
};

export function clamp01(value        )         {
  return Math.max(0, Math.min(1, value));
}

export function mix(a        , b        , t        )         {
  return a + (b - a) * t;
}

export function smoothstep(t        )         {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * Develop-in / dissolve-out envelope over playback fraction `p in [0,1]`:
 * smoothsteps 0->1 over the first `inPortion`, holds 1 in the middle, and
 * smoothsteps 1->0 over the last `outPortion`. Drives the global `reveal`
 * multiplier so the ASCII grows out of / shrinks back to blank white.
 */
export function revealEnvelope(
  p        ,
  inPortion         = RENDER_OPTIONS.revealInPortion,
  outPortion         = RENDER_OPTIONS.revealOutPortion,
)         {
  const clamped = clamp01(p);
  if (inPortion > 0 && clamped < inPortion) {
    return smoothstep(clamped / inPortion);
  }
  if (outPortion > 0 && clamped > 1 - outPortion) {
    return smoothstep((1 - clamped) / outPortion);
  }
  return 1;
}

/**
 * White-veil alpha for the 3-phase opening backdrop (opaque white → frosted →
 * transparent). Returns 1 (opaque white) at p=0 and ramps via smoothstep to
 * `frostedAlpha` over the first `inPortion` of playback, then holds. The canvas
 * paints this white fill UNDER the glyphs; combined with the overlay's CSS
 * backdrop blur it reads opaque-white → frosted glass. (The final transparent
 * phase is the overlay's opacity fade-out, not this veil.)
 */
export function backdropVeil(
  p        ,
  inPortion = RENDER_OPTIONS.revealInPortion,
  frostedAlpha = RENDER_OPTIONS.frostedVeilAlpha,
)         {
  const developIn = smoothstep(inPortion > 0 ? clamp01(p / inPortion) : 1);
  return mix(1, frostedAlpha, developIn);
}

export function random01(a        , b        , c = 0)         {
  let n =
    Math.imul(a | 0, 374761393) +
    Math.imul(b | 0, 668265263) +
    Math.imul(c | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967296;
}

export function decodeBase64ToBytes(base64        )             {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function getStrength(
  brightness        ,
  gamma         = BASE_LAYER_STYLE.gamma,
)         {
  const darkness = clamp01(1 - brightness / 255);
  return darkness ** gamma;
}

/**
 * `reveal` (0..1) scales only the brightness-driven growth, NOT the additive
 * `minFontSize` floor — so at reveal 0 the font stays a stable ~minFontSize.
 * The "blank" look at reveal 0 comes from `getBaseAlpha` returning 0 (the
 * caller's alpha guard skips the draw), not from the font size collapsing.
 *
 * Strength-based variants (M-opening-1, 2026-07-05): `getStrength` is a
 * `Math.pow` and both the font size and the alpha need the SAME strength —
 * the draw loop computes it once per cell and calls the `…FromStrength`
 * forms; the brightness-based forms delegate and remain for tests/callers.
 */
export function fontSizeFromStrength(
  strength        ,
  cellSize        ,
  style             = BASE_LAYER_STYLE,
  reveal = 1,
)         {
  return (
    style.minFontSize + strength * reveal * (cellSize * style.maxFontSizeFactor)
  );
}

/**
 * The glyph size step, in CSS px (M-opening-2, 2026-09-25). The text engine
 * rasterizes and caches every distinct (symbol, size) pair the loop draws,
 * and a new pair costs ~0.1 ms on the main thread. At the old 0.1px step a
 * 1440×900 opening asks for ~12k pairs, and even its second loop cost 1.7×
 * the 0.5px loop per frame; a cold start drew the hold at 5–12 fps. At 0.5px
 * it asks for ~2.4k. A glyph's edges land within 1/8 px of where the exact
 * size puts them.
 */
export const GLYPH_SIZE_STEP_PX = 0.5;

export function quantizeGlyphSize(px        )         {
  return Math.round(px / GLYPH_SIZE_STEP_PX) * GLYPH_SIZE_STEP_PX;
}

/** The geometry every committed opening segment shares (a test holds each
 *  asset to it): the glyph sheet is drawn to it before the picked segment
 *  has loaded. */
export const OPENING_SEGMENT_GEOMETRY = {
  width: 1908,
  height: 1080,
  maxCellSize: 36,
}         ;

/** Every symbol the draw loop can pick. */
export const OPENING_GLYPHS = RENDER_OPTIONS.charGroups
  .map((group) => group.chars)
  .join("");

/**
 * Every quantized size the draw loop can ask for in a `viewW`×`viewH` view:
 * from a strength-0 glyph up to a full-strength glyph in the largest cell,
 * across every layer style, in GLYPH_SIZE_STEP_PX steps. Each value is
 * exactly what `quantizeGlyphSize` returns for a size in that range.
 */
export function openingGlyphSizes(
  viewW        ,
  viewH        ,
  geometry   
                           
                            
                                 
    = OPENING_SEGMENT_GEOMETRY,
)           {
  const scale = Math.min(viewW / geometry.width, viewH / geometry.height);
  let lo = Number.POSITIVE_INFINITY;
  let hi = 0;
  for (const style of Object.values(resolveLayerStyles())) {
    lo = Math.min(
      lo,
      Math.max(style.minDrawFontSize, style.minFontSize * scale),
    );
    hi = Math.max(
      hi,
      fontSizeFromStrength(1, geometry.maxCellSize, style) * scale,
    );
  }
  const sizes           = [];
  const last = Math.round(hi / GLYPH_SIZE_STEP_PX);
  for (let k = Math.round(lo / GLYPH_SIZE_STEP_PX); k <= last; k += 1) {
    sizes.push(k * GLYPH_SIZE_STEP_PX);
  }
  return sizes;
}

export function getFontSize(
  brightness        ,
  cellSize        ,
  style             = BASE_LAYER_STYLE,
  reveal = 1,
)         {
  return fontSizeFromStrength(
    getStrength(brightness, style.gamma),
    cellSize,
    style,
    reveal,
  );
}

export function alphaFromStrength(
  strength        ,
  style             = BASE_LAYER_STYLE,
  reveal = 1,
)         {
  return strength ** style.alphaPower * style.inkOpacity * reveal;
}

export function getBaseAlpha(
  brightness        ,
  style             = BASE_LAYER_STYLE,
  reveal = 1,
)         {
  return alphaFromStrength(getStrength(brightness, style.gamma), style, reveal);
}

/**
 * Resolve the style table for a segment: `default` plus every override in
 * {@link LAYER_STYLE_OVERRIDES}, plus a base fallback for any layer name the
 * segment uses that has no explicit override (e.g. `detail`).
 */
export function resolveLayerStyles(
  layers                              ,
  dark = false,
)                             {
  const base             = dark
    ? { ...BASE_LAYER_STYLE, foreground: DARK_FOREGROUND }
    : BASE_LAYER_STYLE;
  const styles                             = { default: base };
  for (const [name, override] of Object.entries(LAYER_STYLE_OVERRIDES)) {
    styles[name] = { ...base, ...override };
  }
  if (layers) {
    for (const layer of layers) {
      if (styles[layer.name] === undefined) {
        styles[layer.name] = base;
      }
    }
  }
  return styles;
}

/**
 * Build a per-cell layer-name lookup of length `cellCount`. Cells default to
 * `default`; each layer paints its name over `[start, start+count)`.
 */
export function buildCellLayerNames(
  cellCount        ,
  layers                              ,
)           {
  const names = new Array        (cellCount).fill("default");
  if (!layers) return names;
  for (const layer of layers) {
    const start = Math.max(0, Math.trunc(layer.start));
    const end = Math.min(cellCount, start + Math.trunc(layer.count));
    for (let i = start; i < end; i += 1) {
      names[i] = layer.name || "default";
    }
  }
  return names;
}

function getCellInterval(seedX        , seedY        )         {
  const r = random01(seedX + 101, seedY + 53);
  return mix(
    RENDER_OPTIONS.symbolChangeIntervalMin,
    RENDER_OPTIONS.symbolChangeIntervalMax,
    r,
  );
}

function getCellPhaseOffset(seedX        , seedY        )         {
  return random01(seedX + 211, seedY + 307) * 1000;
}

// Hoisted: the group table is a module constant, and this runs twice per
// cell per frame in the draw loop — no reason to re-reduce it there.
const TOTAL_GROUP_WEIGHT = RENDER_OPTIONS.charGroups.reduce(
  (sum, g) => sum + g.weight,
  0,
);

function getWeightedCharGroup(seed        )            {
  const groups = RENDER_OPTIONS.charGroups;
  let target = seed * TOTAL_GROUP_WEIGHT;
  for (const group of groups) {
    if (target < group.weight) return group;
    target -= group.weight;
  }
  return groups[groups.length - 1]             ;
}

function getSymbolForStep(
  seedX        ,
  seedY        ,
  brightness        ,
  step        ,
)         {
  const b = brightness | 0;
  const groupSeed = random01(seedX + step * 131, seedY + step * 71, b);
  const group = getWeightedCharGroup(groupSeed);
  const charSeed = random01(seedX + step * 311, seedY + step * 157, b + 999);
  const index = Math.floor(charSeed * group.chars.length) % group.chars.length;
  return group.chars[index]          ;
}

                              
                                 
                                     
                                
                             
 

/**
 * Symbol crossfade state for one cell at `time`. The cell's flip interval
 * and phase offset are pure functions of its seed coordinates; the draw
 * loop precomputes them per segment (`precomputeCellTimings`) and passes
 * them in to skip two hash derivations per cell per frame — omitted, they
 * are derived here, producing identical output (test-pinned).
 */
export function getSymbolState(
  seedX        ,
  seedY        ,
  brightness        ,
  time        ,
  interval         = getCellInterval(seedX, seedY),
  phaseOffset         = getCellPhaseOffset(seedX, seedY),
)              {
  const localTime = time + phaseOffset;
  const stepFloat = localTime / interval;
  const step = Math.floor(stepFloat);
  const frac = stepFloat - step;

  const currentSymbol = getSymbolForStep(seedX, seedY, brightness, step);
  const nextSymbol = getSymbolForStep(seedX, seedY, brightness, step + 1);
  const fadePortion = clamp01(RENDER_OPTIONS.symbolFadePortion);

  if (fadePortion <= 0) {
    return { currentSymbol, nextSymbol: null, currentAlpha: 1, nextAlpha: 0 };
  }

  const fadeStart = 1 - fadePortion;
  let currentAlpha = 1;
  let nextAlpha = 0;
  if (frac > fadeStart) {
    const t = (frac - fadeStart) / fadePortion;
    currentAlpha = 1 - t;
    nextAlpha = t;
  }
  return { currentSymbol, nextSymbol, currentAlpha, nextAlpha };
}

export function getInterpolatedBrightness(
  frameBytes            ,
  activeCount        ,
  frameCount        ,
  cellIndex        ,
  framePosition        ,
)         {
  // Clamp the tail instead of wrapping (M-opening-1): playback is one-shot,
  // and the reference's `% frameCount` wrap made the very last instant
  // (framePosition === frameCount) interpolate back toward frame 0 — a
  // pop to the first frame that was only invisible because the overlay
  // unmounts earlier. The final frame now holds.
  const baseFrame = Math.min(Math.floor(framePosition), frameCount - 1);
  const nextFrame = Math.min(baseFrame + 1, frameCount - 1);
  const t = clamp01(framePosition - baseFrame);
  const b0 = frameBytes[baseFrame * activeCount + cellIndex] ?? 0;
  const b1 = frameBytes[nextFrame * activeCount + cellIndex] ?? 0;
  return mix(b0, b1, t);
}

/** Per-cell loop invariants, resolved once per segment (M-opening-1): the
 *  integer seed coordinates plus the symbol-flip interval and phase offset
 *  they determine. The draw loop otherwise re-derived all four per cell per
 *  FRAME (~1M redundant hash calls over one splash) — and the splash plays
 *  during app bootstrap, the busiest CPU window the renderer ever sees. */
                              
                              
                              
                                   
                                      
 

export function precomputeCellTimings(
  cells                      ,
)              {
  const n = cells.length;
  const seedXs = new Int32Array(n);
  const seedYs = new Int32Array(n);
  const intervals = new Float64Array(n);
  const phaseOffsets = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const cell = cells[i];
    if (cell === undefined) continue;
    const sx = Math.floor(cell[0]);
    const sy = Math.floor(cell[1]);
    seedXs[i] = sx;
    seedYs[i] = sy;
    intervals[i] = getCellInterval(sx, sy);
    phaseOffsets[i] = getCellPhaseOffset(sx, sy);
  }
  return { seedXs, seedYs, intervals, phaseOffsets };
}


//# sourceURL=packages__gui__src__renderer__components__Opening__ascii-renderer.ts
/**
 * The opening's glyph sheet (M-opening-4, 2026-09-25): every symbol at every
 * size the draw loop can ask for, drawn once, in the ink, at the device's
 * pixel scale. The draw loop copies a glyph from it to a whole device pixel
 * instead of drawing the text: the GPU process copies pixels rather than
 * rasterizing text every frame. A glyph lands at most half a device pixel
 * from where fillText puts it; its shape and size are fillText's own (the
 * sheet is drawn with fillText, at the same device size).
 */

/** One size's cells: each glyph's cell in the sheet, in glyph order. */
                                    
                                                                
                      
                                                                  
                     
                     
                                                  
                                  
 

/** A drawn sheet, as the draw loop receives it. */
                               
                               
                                                        
                       
                                                                          
                       
                                    
                          
                                                 
                                                                         
                                    
 

export const OPENING_SHEET_WIDTH = 2048;
/** Taller than this (a device scale beyond ~3) and there is no sheet: the
 *  loop draws text as before. */
export const OPENING_SHEET_MAX_HEIGHT = 8192;

/**
 * Where each glyph goes: rows of cells, `sizes` in order, each size's
 * glyphs side by side. A cell holds a glyph drawn centred with room for its
 * ink (0.8 em wide, 1.4 em tall, the widest and tallest symbols of the set)
 * and 2 device px of antialiasing on every side. Null when a cell or the
 * sheet would not fit.
 */
export function layoutOpeningSheet(
  sizes                   ,
  dpr        ,
  glyphCount        ,
  width = OPENING_SHEET_WIDTH,
)                                                                            {
  const entries                      = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const px of sizes) {
    const dev = px * dpr;
    const w = Math.ceil(dev * 0.8) + 4;
    const h = Math.ceil(dev * 1.4) + 4;
    if (w > width) return null;
    const pos           = [];
    for (let g = 0; g < glyphCount; g += 1) {
      if (x + w > width) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      pos.push(x, y);
      x += w;
      rowH = Math.max(rowH, h);
    }
    entries.push({ px, w, h, pos });
  }
  const height = y + rowH;
  if (height === 0 || height > OPENING_SHEET_MAX_HEIGHT) return null;
  return { entries, height };
}


//# sourceURL=packages__gui__src__renderer__components__Opening__glyph-sheet-layout.ts
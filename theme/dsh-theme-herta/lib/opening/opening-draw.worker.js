                                                       
                                                            
import {
  createOpeningPlayer,
                     
  paintOpeningCover,
} from "./opening-player.js";

/**
 * The opening's draw loop on its own thread (M-opening-3, 2026-09-25).
 *
 * The opening plays while the app boots, and on the main thread each frame
 * (3k–6.5k glyph draws plus the canvas commit) waited behind the boot's own
 * tasks, and they behind it. Here the same player (`opening-player.ts`) draws
 * on the canvas the component transferred, from this thread's own animation
 * frames; its commits go straight to the compositor.
 *
 * Two steps, so the start-up overlaps the segment's load: `prepare` (sent as
 * the splash mounts) takes the canvas and paints the first frame's opaque
 * veil, which creates its GPU context; `play` (sent once the segment has
 * loaded and the glyph sheet is drawn, M-opening-4) starts the frames. The main thread hears of three
 * moments only: the first frame, the dissolve, and an instant finish.
 */

                
                         
                          
                       
 

/** Main → worker. Sizes are CSS px. */
                                
      
                               
                                       
                             
             
     
                            
                                 
                                                                       
                                          
     
                                         

/** Worker → main. `first-frame` carries when it was committed, in epoch ms,
 *  and whether the frames copy from the glyph sheet; `no-context`: the canvas
 *  gave no 2D context (the main thread plays the opening instead). */
                              
     
                                   
                                 
                                  
     
                                                              
                                
                                    

function send(event                  )       {
  postMessage(event);
}

let surface   
                                   
                                                  
                         
         = null;
let view       = { width: 0, height: 0, dpr: 1 };
let player                       = null;

/**
 * The sheet as this thread's GPU texture. The sheet arrives drawn on a
 * software canvas (its text is rasterized off the GPU process); copied once
 * into a canvas of this thread, it becomes a GPU-backed bitmap the frames
 * copy from. Drawn from directly, its pixels went to the GPU process again
 * with every frame (in-app trace, M-opening-4: 247 → 376 ms of the hold's
 * GPU time, and the hold slower than drawing text).
 */
function onGpu(sheet              )               {
  const upload = new OffscreenCanvas(sheet.bitmap.width, sheet.bitmap.height);
  const g = upload.getContext("2d");
  if (g === null) return sheet;
  g.drawImage(sheet.bitmap, 0, 0);
  sheet.bitmap.close();
  return { ...sheet, bitmap: upload.transferToImageBitmap() };
}

function play(data             , received                     )       {
  if (surface === null || player !== null) return;
  const sheet = received === null ? null : onGpu(received);
  const started = createOpeningPlayer(
    surface.canvas,
    surface.ctx,
    data,
    surface.dark,
    {
      onDissolve: (dissolveMs) => send({ type: "dissolve", dissolveMs }),
      onInstant: () => send({ type: "instant" }),
    },
    performance.now(),
    sheet,
  );
  player = started;
  started.resize(view.width, view.height, view.dpr);
  let first = true;
  const step = (timeMs        )       => {
    const more = started.frame(timeMs);
    if (first) {
      first = false;
      send({
        type: "first-frame",
        atEpochMs: performance.timeOrigin + performance.now(),
        usesSheet: started.usesSheet(),
      });
    }
    if (more) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

addEventListener("message", (event                                  ) => {
  const request = event.data;
  if (request.type === "resize") {
    view = request;
    if (player !== null) player.resize(view.width, view.height, view.dpr);
    else if (surface !== null) {
      paintOpeningCover(
        surface.canvas,
        surface.ctx,
        surface.dark,
        view.width,
        view.height,
        view.dpr,
      );
    }
  } else if (request.type === "prepare") {
    if (surface !== null) return;
    const ctx = request.canvas.getContext("2d");
    if (ctx === null) {
      send({ type: "no-context" });
      return;
    }
    surface = { canvas: request.canvas, ctx, dark: request.dark };
    view = request;
    paintOpeningCover(
      request.canvas,
      ctx,
      request.dark,
      view.width,
      view.height,
      view.dpr,
    );
  } else {
    play(request.data, request.sheet);
  }
});


//# sourceURL=packages__gui__src__renderer__components__Opening__opening-draw.worker.ts
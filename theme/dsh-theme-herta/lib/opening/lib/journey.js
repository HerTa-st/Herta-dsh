/**
 * Journey marks (2026-09-24): User Timing marks at the start and end of the
 * four things a user waits on — launching the app, opening a session,
 * sending a message (until it shows), and the reply's first glyph. Each
 * journey starts at the user's action and ends once its result is PAINTED,
 * so a measure is what the user felt, not when some code finished.
 *
 * Marks only: nothing is logged, sent or stored. A lab bench reads them over
 * CDP (`scripts/ux-probes/journeys.mjs`) with
 * `performance.getEntriesByType("mark")`; so can DevTools' Performance
 * panel. Each name keeps only its latest mark, so a long session holds a
 * few dozen entries, not one per turn.
 *
 * Method from the claude.ai speed-up (2026-09-23 post): define the journeys
 * first, start them at an interaction, end them at the render, and keep the
 * client's share apart from the server's — here `send:first-delta` (the
 * first glyph arrived) splits the reply's wait at the renderer's door.
 */

                         
                                                               
                        
                                                                       
                            
                                                              
                     
                                                             
                        
                                   
                        
                                                  
                          
                            
                
                                              
                       
                                                      
                      
                                              
                         

const PREFIX = "herta:";
/** An occluded window gets no animation frames; past this, mark anyway. */
const PAINT_WAIT_MAX_MS = 1000;

function canMark()          {
  return (
    typeof performance !== "undefined" &&
    typeof performance.mark === "function" &&
    typeof performance.clearMarks === "function"
  );
}

/** Mark now. */
export function journeyMark(name             )       {
  if (!canMark()) return;
  const full = PREFIX + name;
  performance.clearMarks(full);
  performance.mark(full);
}

/** Mark at a moment another thread saw, given as epoch ms (that thread's
 *  `performance.timeOrigin + performance.now()`): the opening's draw worker
 *  reports when its first frame was committed, and the message reaches this
 *  thread later than the frame reached the screen. */
export function journeyMarkAt(
  name             ,
  epochMs        ,
  detail                                    ,
)       {
  if (!canMark()) return;
  const full = PREFIX + name;
  performance.clearMarks(full);
  performance.mark(full, {
    startTime: Math.max(0, epochMs - performance.timeOrigin),
    ...(detail !== undefined ? { detail } : {}),
  });
}

                             
                                                                             
 

/** Run `cb` as the next task, ahead of the ordinary ones already queued.
 *  A plain timer waits behind all of them — React's scheduler work, a focus
 *  change — and in the send's trace (2026-09-24, 4× CPU) that put the echo's
 *  mark 47 ms after the frame that actually painted it. A `user-blocking`
 *  postTask runs first; where the browser has none, the timer it replaced. */
function nextTask(cb            )       {
  const s = (globalThis                                              )
    .scheduler;
  if (typeof s?.postTask === "function") {
    s.postTask(cb, { priority: "user-blocking" }).catch(() => undefined);
  } else {
    setTimeout(cb, 0);
  }
}

/**
 * Mark once the NEXT frame has painted: a task queued from inside an
 * animation frame runs after that frame's paint. A window with no frames
 * (occluded, minimized) would never paint, so a timer caps the wait and the
 * mark says so (`detail.late`). A `detail` given here rides along with it.
 */
export function journeyMarkAfterPaint(
  name             ,
  detail                                    ,
)       {
  if (!canMark()) return;
  let done = false;
  const mark = (late         )       => {
    if (done) return;
    done = true;
    const full = PREFIX + name;
    performance.clearMarks(full);
    const merged = late ? { ...detail, late: true } : detail;
    performance.mark(
      full,
      merged !== undefined ? { detail: merged } : undefined,
    );
  };
  const cap = setTimeout(() => mark(true), PAINT_WAIT_MAX_MS);
  if (typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(() => {
    nextTask(() => {
      clearTimeout(cap);
      mark(false);
    });
  });
}


//# sourceURL=packages__gui__src__renderer__lib__journey.ts
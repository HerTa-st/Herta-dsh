/**
 * The launch gate (2026-09-24): decoration that needs the GPU waits for the
 * opening, instead of racing it.
 *
 * A cold-start trace of the built app (Chromium --trace-startup, all
 * processes) found the renderer's main thread spending ~260 ms, right
 * before the opening's first frame, in synchronous WebGL calls: the
 * composer wave's shader setup (context, renderer-string check, compile,
 * seventeen uniform lookups) each a round trip to a GPU process that was
 * itself still starting up. Everything drawn there was behind the opening
 * splash, and the wave does not even draw on the connect screen. So the
 * opening's canvas gets the GPU first; the rest follows at idle.
 *
 * Two phases, in order:
 *   `opening`  — the opening's segment has loaded and is playing. The
 *                device card's visuals wait for this: they show once the
 *                splash lifts, and the opening's run is their time to start.
 *   `settled`  — the opening is over (or failed): the connect screen is up.
 *                The composer wave waits for this.
 * Waiters run in the next idle slot after their phase (capped, so a busy
 * main thread still gets them).
 *
 * OPEN BY DEFAULT: only an opening splash closes it (`holdLaunch`, from its
 * first render — before any effect of the tree it covers runs). Anything
 * rendered with no splash — a component test, the reference view — gets
 * its callback at once, exactly as before.
 */

                                                

const RANK                              = { opening: 1, settled: 2 };
/** The idle callback's own deadline once the phase is reached. */
const IDLE_TIMEOUT_MS = 800;

/** Highest phase reached; `settled` (open) when no launch is in progress. */
let reached = RANK.settled;

                  
                              
                          
                     
 
let waiting           = [];

function runAtIdle(w        )       {
  const run = ()       => {
    if (!w.cancelled) w.fn();
  };
  const idle = (
    globalThis     
                                                                               
     
  ).requestIdleCallback;
  if (typeof idle === "function") idle(run, { timeout: IDLE_TIMEOUT_MS });
  else setTimeout(run, 0);
}

/** An opening splash is up: close the gate until it releases the phases. */
export function holdLaunch()       {
  reached = 0;
}

/** The launch reached `phase` (and every phase before it). */
export function releaseLaunch(phase             )       {
  if (RANK[phase] <= reached) return;
  reached = RANK[phase];
  const due = waiting.filter((w) => RANK[w.phase] <= reached);
  waiting = waiting.filter((w) => RANK[w.phase] > reached);
  for (const w of due) runAtIdle(w);
}

/**
 * Run `fn` once the launch has reached `phase`: now, when it already has
 * (or no launch is in progress); otherwise in the first idle slot after it
 * does. Returns the cancel — call it from the effect's cleanup.
 */
export function afterLaunch(phase             , fn            )             {
  if (RANK[phase] <= reached) {
    fn();
    return () => undefined;
  }
  const w         = { phase, fn, cancelled: false };
  waiting.push(w);
  return () => {
    w.cancelled = true;
    waiting = waiting.filter((x) => x !== w);
  };
}


//# sourceURL=packages__gui__src__renderer__lib__launch-gate.ts
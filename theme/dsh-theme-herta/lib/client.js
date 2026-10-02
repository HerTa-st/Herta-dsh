/**
 * dsh-theme-herta —— 浏览器端（启动开场）。
 *
 * 机制与上游主题插件同一套：`window.__ModuleLoader__.load()` 注册；
 * 导出 `{ isPlugin, inject, apply }`。区别只有一个 ——
 * **我们不在这个文件里内联动画代码**，而是在运行时从宿主那条静态路由
 * **动态 import** 移植来的模块（所以不需要任何打包器 ✓）。
 *
 * 粒度（按开拓者定的）：**每次启动 DSH 播一次** ——
 * 用 sessionStorage 打标记：冷启动播 ✓、刷新页面不重播 ✓、关掉应用下次再播 ✓。
 *
 * 字形表（上游 M-opening-4/M-opening-5）：开场每一帧要把 3k–9k 个字形画出来，
 * 逐帧 `fillText` 等于每帧都让文字引擎光栅化一遍。上游的做法是**开机时用另一个
 * worker 把每个符号×每个尺寸预先画成一张大图**（`glyph-sheet.js`，缓存在
 * IndexedDB 里，第二次启动直接解码），播放器逐帧从这张图上**拷贝**像素。
 * 我们这里同样：先起表，再播 —— 表没赶上就照旧画字（见 `waitForSheet`）。
 *
 * 三条护栏（少一条都可能把人卡在白屏上）：
 *   1. 标记**先设**再播：中途炸了也不会每次刷新重播；
 *   2. 无论如何都移除遮罩（成功、失败、超时都走同一个 cleanup）；
 *   3. 硬超时 15 秒兜底 —— 播放器卡住也不许挡住界面。
 */
window.__ModuleLoader__.load({
  id: "dsh-theme-herta",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const ROUTE = "/herta-theme";
    const FLAG = "dsh-theme-herta:booted";
    const HARD_TIMEOUT_MS = 15000;
    /** 等字形表的上限（照上游 `OpeningAsciiCanvas` 的 SHEET_WAIT_MAX_MS）：
     *  超过就照文本画 —— 不为了省 CPU 把第一帧无限期拖住。 */
    const SHEET_WAIT_MAX_MS = 2500;
    /** 画帧 worker 在窗口可见时多久还不来第一帧就交回主线程（上游同值）。 */
    const FIRST_FRAME_WATCHDOG_MS = 2000;
    /**
     * 收尾闸：图上那条 `dissolve` 消息是**唯一**的收场信号（worker 不发「播完」），
     * 而它要是没来，遮罩就一直盖着 —— 只剩 15 秒硬超时兜底，用户白等十几秒。
     * 所以照时间轴另外挂一道闸：到 DISSOLVE_END 还没开始淡，就自己收。
     * 正常路上它永远不会响（`faded` 先为真）。上游没有这一道 —— 它的收场同样
     * 全押在 `dissolve` 上，只是它的 overlay 归 React 管，这里归我们管。
     */
    const FINISH_GUARD_SLACK_MS = 700;
    /** 收尾闸自己动手时用的淡出时长：拿 CSS 那条 transition 的值，别再来一次长淡。 */
    const GUARD_FADE_MS = 260;
    const SEGMENTS = ["b-0.json", "b-1.json", "c-0.json", "c-1.json"];

    /**
     * 开场画在哪个设备像素倍率上。
     *
     * **这个值必须与画表那一个一致**：表只服务「它自己那一档」的视图
     * （播放器里的判据是 `sheet.dpr === dpr`，尺寸表也按这一档算），
     * 这里换成别的值 = 表算白画，逐帧退回 `fillText`（静默的，不报错）。
     * 所以取与 `glyph-sheet.js` 完全相同的表达式。
     */
    const openingDpr = () => window.devicePixelRatio || 1;

    exports.isPlugin = true;
    exports.inject = ["theme"];

    /** 铺满全屏的遮罩 + 画布；返回 cleanup（突然撤）与 fade（按点淡出）。 */
    function mountSplash() {
      // 与播放器第一条帧铺的那层「幕」同色（浅色 #eef6f9 / 深色 rgb(13,17,22)），
      // 好让「画布还没有内容」的那几百毫秒不闪另一个底色 —— 深色模式下尤其明显。
      // 明暗判断必须**跟窗口装饰同源** ✗✓ —— 那三个原生标题栏按钮（Electron 的
      // titleBarOverlay：asar 里搜到 titleBarStyle / setTitleBarOverlay / nativeTheme ✓）
      // 的颜色由原生主题决定，而原生主题正是喂给 `prefers-color-scheme` 的那一个。
      // 只读 `documentElement.dataset.theme` 会漏判 → 「浅色遮罩 + 深色窗口装饰」错配
      // → 按钮跳到最前面来。以前没这问题，是因为那时两边都是浅色、彼此融着。
      // （这同一句错判断在文件里有两处 —— 遮罩底色一处、播放器的墨色一处，一起改。）
      const dark =
        document.documentElement.dataset.theme === "dark" ||
        document.body?.hasAttribute("data-ds-dark-theme") === true ||
        (typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      const stage = document.createElement("div");
      stage.id = "herta-boot-splash";
      stage.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        `background:${dark ? "rgb(13,17,22)" : "#eef6f9"}`,
        "opacity:1",
        "transition:opacity 260ms ease",
        "pointer-events:none",
      ].join(";");

      const canvas = document.createElement("canvas");
      canvas.style.cssText = "display:block;width:100%;height:100%";
      stage.appendChild(canvas);
      document.body.appendChild(stage);

      let removed = false;
      let fading = false;
      /** 出了问题要立刻撤：不淡出，直接熄灭再摘掉。 */
      const cleanup = () => {
        if (removed) return;
        removed = true;
        fading = true;
        stage.style.opacity = "0";
        setTimeout(() => stage.remove(), 320);
      };
      /**
       * 按上游那套契约淡出：**淡出与图一起开始（DISSOLVE_START）、一起结束
       * （DISSOLVE_END）**。整层一起淡是关键 —— 不然画布自己的幕先淡光，
       * 露出的正好是这层不透明的底色，等于给用户闪一块纯色板。
       */
      const fade = (durationMs) => {
        if (removed || fading) return;
        fading = true;
        stage.style.transition = `opacity ${Math.max(0, durationMs)}ms linear`;
        stage.style.opacity = "0";
        setTimeout(() => {
          removed = true;
          stage.remove();
        }, durationMs + 40);
      };
      /** 遮罩已经撤了吗 —— 播放循环据此自己停下，别对着空气画。 */
      const isRemoved = () => removed;
      return { stage, canvas, cleanup, fade, isRemoved };
    }

    /**
     * 画帧的 worker（上游 `opening-draw.worker.ts`，M-opening-3）：帧循环搬到
     * 另一个线程，主线程的启动任务不再和它互相排队，它的提交直接进合成器。
     * 平台没有 Worker / OffscreenCanvas（jsdom），或者构造被 CSP 挡下，就 null。
     */
    function spawnDrawWorker() {
      if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
        return null;
      }
      return new Worker(`${ROUTE}/opening/opening-draw.worker.js`, {
        type: "module",
      });
    }

    /** 等字形表；到点还没有就 null —— 播放器届时照文本画。 */
    function waitForSheet(getSheet) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), SHEET_WAIT_MAX_MS);
        getSheet().then(
          (sheet) => {
            clearTimeout(timer);
            resolve(sheet);
          },
          () => {
            clearTimeout(timer);
            resolve(null);
          },
        );
      });
    }

    /**
     * 播一段。任何失败都只记日志 + cleanup，绝不抛到宿主。
     *
     * 两处 host，与上游 `OpeningAsciiCanvas` 同一套取舍：
     *   1. **画帧 worker**（首选）：画布用 `transferControlToOffscreen` 交出去，
     *      帧循环在那边跑。交出去的画布主线程**再也读不了、画不了**，所以一旦
     *      要退回主线程，必须换一张新画布（旧的那张是 worker 的了）。
     *   2. **主线程**：worker 起不来 / 起不来帧 / 拿不到 2d 上下文时的回退。
     *
     * `registerStop` 把「收尾」交回调用方：硬超时那条路也要能停掉帧循环并
     * 归还字形表（表关掉之后 `drawImage` 会抛，所以释放只在停之后做）。
     */
    async function play(splash, registerStop) {
      // 字形表先起：它自己开一个 worker 去画，与下面「起画帧 worker + 载入播放器
      // + 取段落」并行 —— 上游也是这么排的。
      const sheets = await import(`${ROUTE}/opening/glyph-sheet.js`);
      sheets.startOpeningGlyphSheet();

      // 明暗判断必须**跟窗口装饰同源** ✗✓ —— 那三个原生标题栏按钮（Electron 的
      // titleBarOverlay：asar 里搜到 titleBarStyle / setTitleBarOverlay / nativeTheme ✓）
      // 的颜色由原生主题决定，而原生主题正是喂给 `prefers-color-scheme` 的那一个。
      // 只读 `documentElement.dataset.theme` 会漏判 → 「浅色遮罩 + 深色窗口装饰」错配
      // → 按钮跳到最前面来。以前没这问题，是因为那时两边都是浅色、彼此融着。
      // （这同一句错判断在文件里有两处 —— 遮罩底色一处、播放器的墨色一处，一起改。）
      const dark =
        document.documentElement.dataset.theme === "dark" ||
        document.body?.hasAttribute("data-ds-dark-theme") === true ||
        (typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      const view = () => ({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: openingDpr(),
      });

      let stopped = false;
      let faded = false;
      let canvas = splash.canvas;
      let worker = null;
      let player = null;
      let raf = 0;
      let watchdog = 0;
      let finishGuard = 0;
      /** 段落与表都到手之后，回退主线程要用它们再搭一次。 */
      let ready = null;

      const stop = () => {
        if (stopped) return;
        stopped = true;
        if (raf !== 0) cancelAnimationFrame(raf);
        raf = 0;
        window.clearTimeout(watchdog);
        window.clearTimeout(finishGuard);
        window.removeEventListener("resize", onResize);
        if (worker !== null) {
          worker.onmessage = null;
          worker.onerror = null;
          worker.onmessageerror = null;
          worker.terminate();
          worker = null;
        }
        sheets.releaseOpeningGlyphSheet(); // 几十 MB 的位图，播完就还
        splash.cleanup();
      };
      const fadeOut = (durationMs) => {
        if (faded) return;
        faded = true;
        splash.fade(durationMs);
        // 图的淡出结束 = 这一场结束：连帧循环一起收。
        setTimeout(stop, durationMs + 60);
      };

      /**
       * 照时间轴挂一道收尾闸（见 `FINISH_GUARD_SLACK_MS` 的注释）：正常路上
       * `dissolve` 先到、`faded` 先为真，它就不会响；它响就意味着**没有收场
       * 信号**，那时宁可自己收，也不让遮罩盖到 15 秒硬超时。
       */
      const armFinishGuard = (timeline) => {
        const at = Math.ceil(
          mod.DISSOLVE_START * timeline.wallDurationMs +
            timeline.dissolveMs +
            FINISH_GUARD_SLACK_MS,
        );
        finishGuard = window.setTimeout(() => {
          if (stopped || faded) return;
          console.warn(
            `[dsh-theme-herta] ${at}ms 内没收到收场信号，自己收（这一场应到 ${Math.round(
              mod.DISSOLVE_START * timeline.wallDurationMs + timeline.dissolveMs,
            )}ms 就淡完）`,
          );
          fadeOut(GUARD_FADE_MS);
        }, at);
      };

      function onResize() {
        if (worker !== null) worker.postMessage({ type: "resize", ...view() });
        else if (player !== null) resizeOnMain();
      }

      function resizeOnMain() {
        const d = openingDpr();
        canvas.width = Math.floor(window.innerWidth * d);
        canvas.height = Math.floor(window.innerHeight * d);
        player.resize(window.innerWidth, window.innerHeight, d);
      }

      /** 交出去的画布换一张新的（旧那张的主权已经在 worker 手里）。 */
      function replaceCanvas() {
        const fresh = document.createElement("canvas");
        fresh.style.cssText = canvas.style.cssText;
        canvas.replaceWith(fresh);
        canvas = fresh;
      }

      /** 回退：worker 不干活了，用新画布在主线程接着播。淡出已经开始就没可回退的。 */
      function fallBack() {
        if (stopped || faded || worker === null) return;
        const dead = worker;
        worker = null;
        window.clearTimeout(watchdog);
        dead.onmessage = null;
        dead.onerror = null;
        dead.onmessageerror = null;
        dead.terminate();
        // 交出去的那张画布回不来了，必须换一张新的。
        replaceCanvas();
        // 段落还没到手就先只记着;等它到了 play() 会看见 worker === null，直接走主线程。
        if (ready !== null) playOnMain(ready.segment, ready.sheet);
      }

      /** 起画帧 worker 并把画布交给它。起不来就返回 null（走主线程）。 */
      function startWorker() {
        if (typeof canvas.transferControlToOffscreen !== "function") return null;
        let spawned;
        try {
          spawned = spawnDrawWorker();
        } catch {
          spawned = null;
        }
        if (spawned === null) return null;
        let offscreen;
        try {
          offscreen = canvas.transferControlToOffscreen();
        } catch {
          spawned.terminate();
          return null;
        }
        worker = spawned;
        spawned.onmessage = (event) => {
          const msg = event.data;
          if (msg.type === "dissolve") fadeOut(msg.dissolveMs);
          else if (msg.type === "instant") stop();
          else if (msg.type === "no-context") fallBack();
          // first-frame：只是 worker 到了第一帧，没有要做的事
        };
        spawned.onerror = () => fallBack();
        spawned.onmessageerror = () => fallBack();
        spawned.postMessage({ type: "prepare", canvas: offscreen, dark, ...view() }, [
          offscreen,
        ]);
        return spawned;
      }

      /** 主线程那条路：播放器逐帧画在这张画布上。 */
      function playOnMain(segment, sheet) {
        let ctx2d = null;
        try {
          ctx2d = canvas.getContext("2d");
        } catch {
          ctx2d = null;
        }
        if (ctx2d === null) {
          // 连 2d 上下文都没有（无头/jsdom）：照时间轴收场，别把界面挡住 ——
          // 与上游同一条路：到 DISSOLVE_START 开始淡，淡出时长就是那段 dissolve。
          const timeline = ready.module.openingTimeline(segment);
          setTimeout(
            () => fadeOut(timeline.dissolveMs),
            Math.ceil(ready.module.DISSOLVE_START * timeline.wallDurationMs),
          );
          return;
        }
        try {
          player = mod.createOpeningPlayer(
            canvas,
            ctx2d,
            segment,
            dark,
            { onDissolve: (ms) => fadeOut(ms), onInstant: stop },
            performance.now(),
            sheet,
          );
        } catch (e) {
          console.warn("[dsh-theme-herta] 搭播放器失败，表也不要了：", e);
          if (sheet !== null) return playOnMain(segment, null);
          throw e;
        }
        resizeOnMain();
        window.addEventListener("resize", onResize);
        const step = (t) => {
          // 硬超时已经把遮罩撤了：停下，别对着一个卸掉的画布继续画。
          if (splash.isRemoved()) {
            stop();
            return;
          }
          let more = false;
          try {
            more = player.frame(t);
          } catch (e) {
            console.warn("[dsh-theme-herta] 开场播放出错：", e);
            stop();
            return;
          }
          if (more) raf = requestAnimationFrame(step);
          else stop();
        };
        raf = requestAnimationFrame(step);
      }

      // 画帧 worker 就在这儿起（上游：splash 一挂就起，好让它的 GPU 上下文
      // 在「取段落 + 等表」那段时间里建好）。
      startWorker();
      // 窗口变化两边都要知道：worker 在跑就报给它，退回主线程就自己重算。
      window.addEventListener("resize", onResize);
      registerStop(stop);

      const name = SEGMENTS[Math.floor(Math.random() * SEGMENTS.length)];
      const [mod, res] = await Promise.all([
        import(`${ROUTE}/opening/opening-player.js`),
        fetch(`${ROUTE}/opening-segments/${name}`),
      ]);
      if (!res.ok) throw new Error(`取 ${name} 失败：HTTP ${res.status}`);
      const segment = await res.json();

      const sheet = await waitForSheet(sheets.openingGlyphSheet);
      if (stopped) return;
      ready = { segment, sheet, module: mod };
      // 两条路都在这里挂闸：主线程那条有自己的自然收场（帧跑完就 stop），
      // worker 那条没有 —— 闸主要是给它用的，顺手一起挂，省得两处各写一份。
      armFinishGuard(mod.openingTimeline(segment));
      if (worker === null) {
        playOnMain(segment, sheet);
        return;
      }
      // sheet 是**克隆**不是转移：位图的像素是共享的，回退到主线程时还能用它。
      worker.postMessage({ type: "play", data: segment, sheet });
      // 窗口可见却一直不来帧（某些平台 worker 的动画帧不跑）不许把遮罩留在那儿。
      watchdog = window.setTimeout(() => {
        if (stopped || faded) return;
        if (document.visibilityState === "visible") fallBack();
        else watchdog = window.setTimeout(fallBack, FIRST_FRAME_WATCHDOG_MS);
      }, FIRST_FRAME_WATCHDOG_MS);
    }

    exports.apply = (ctx) => {
      // 主题层（配色令牌 + 背景层）**每次打开都要装** —— 它跟「本次运行是否播过开场」无关 ✗，
      // 所以必须放在下面那个 sessionStorage 早退之前。走宿主那条路由动态 import，免打包 ✓。
      // 失败只 warn：界面保持原样，绝不让主题把应用搞坏。
      import(`${ROUTE}/theme.js`)
        .then((m) => {
          m.applyTheme(ctx, ROUTE);
          m.installDebugHook(ROUTE);
          // 外观设置页：单独一个模块，挂到 DSH 的 `settings.section` 槽上。
          // React 必须从**这边**给它 —— `require` 只在这个 factory 里存在。
          // 拿不到 React 也只是一条 warn：值照样能用 `__hertaTheme` 调，界面不受影响。
          let React = null;
          try {
            React = require("react");
          } catch (e) {
            console.warn('[dsh-theme-herta] require("react") 失败，设置页不挂：', e);
          }
          return import(`${ROUTE}/settings.js`)
            .then((s) => s.installSettingsSection(ctx, { React, route: ROUTE }))
            .catch((e) => console.warn("[dsh-theme-herta] 设置页未挂载：", e));
        })
        .catch((e) => {
          console.warn("[dsh-theme-herta] 主题层加载失败（界面保持原样）：", e);
          // 状态也写进 localStorage —— 它落在盘上，比"只打控制台"有用（控制台我看不到）。
          try {
            window.localStorage.setItem(
              "herta-theme:status",
              `${new Date().toISOString()} 主题层 import 失败：${String(e?.message ?? e)}`,
            );
          } catch {
            /* 写不进就算了 */
          }
        });

      try {
        if (window.sessionStorage.getItem(FLAG) === "1") return; // 本次运行已播过
        window.sessionStorage.setItem(FLAG, "1"); // 先设标记，再播
      } catch {
        // 隐私模式下 sessionStorage 可能抛 —— 那就当没播过，直接不播，别冒险
        return;
      }

      const splash = mountSplash();
      let stop = null;
      // 兜底：不许挡住界面。停循环 + 撤遮罩一起做（只 cleanup 的话帧循环还在画）。
      setTimeout(() => {
        stop?.();
        splash.cleanup();
      }, HARD_TIMEOUT_MS);
      play(splash, (fn) => {
        stop = fn;
      }).catch((e) => {
        console.warn("[dsh-theme-herta] 开场失败：", e);
        stop?.();
        splash.cleanup();
      });
    };

    return module.exports;
  },
});

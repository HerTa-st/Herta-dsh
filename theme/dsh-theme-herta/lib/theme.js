/**
 * dsh-theme-herta —— 主题层：配色令牌 + 背景层。
 *
 * 由 `client.js` 在 `apply` 里**动态 import**（走宿主那条静态路由 `/herta-theme`）。
 * 所以这个文件不需要任何打包器 —— 与开场那套同一条路。
 *
 * 三件事：
 *   1. **配色令牌**：`ctx.theme.register({ id, colorScheme, tokens })` + `setTheme`；
 *      令牌名一律 `--dsw-alias-*`（四十多个，这里只改视觉上真正会看的那批）。
 *      颜色取自她原画量出来的那五个色值（`#17131D` / `#2E2636` / `#65549B` / `#88749E` / `#EBDFE7`）。
 *   2. **背景层**：铺在 `body` 上（**不用 z-index 叠层** ✗ —— 半透明面板自己会透出来），
 *      遮罩强度直接烘进 `background-image` 的第一层渐变里，因此不需要额外元素。
 *   3. **可换背景**：`builtin`（包里四张）/ `url` / `color` / `off` 四种来源，
 *      存在 localStorage。**界面（设置页/命令）是下一步的事** ✗ ——
 *      眼下用 `window.__hertaTheme` 这个测试钩子调，免得现在造一个你讨厌的浮动条。
 */

/** 深色：已通过的那套。 */
const TOKENS_DARK = {
  "--dsw-alias-bg-base": "rgba(28, 23, 35, 0.44)",
  "--dsw-alias-bg-layer-1": "rgba(38, 31, 46, 0.64)",
  "--dsw-alias-bg-layer-2": "rgba(46, 38, 54, 0.78)",
  "--dsw-alias-bg-layer-3": "rgba(56, 46, 66, 0.88)",
  "--dsw-alias-bg-overlay": "rgba(46, 38, 54, 0.95)",
  "--dsw-alias-bg-module-platform": "rgba(24, 19, 30, 0.86)",
  "--dsw-alias-bg-multi-select": "rgba(46, 38, 54, 0.92)",
  "--dsw-alias-bg-mask-1": "rgba(10, 8, 14, 0.72)",
  "--dsw-alias-bg-mask-2": "rgba(10, 8, 14, 0.40)",
  "--dsw-alias-label-primary": "#ebdfe7",
  "--dsw-alias-label-secondary": "#b49fbb",
  "--dsw-alias-label-tertiary": "#88749e",
  "--dsw-alias-label-caption": "#7e6d90",
  "--dsw-alias-label-dimmed": "#564969",
  "--dsw-alias-label-primary-foreground": "#1d1826",
  "--dsw-alias-label-primary-inverted": "#1d1826",
  "--dsw-alias-brand-primary": "#9b8ae0",
  "--dsw-alias-brand-text": "#9b8ae0",
  "--dsw-alias-brand-primary-invert": "#1d1826",
  "--dsw-alias-button-primary-fill": "#7c63d6",
  "--dsw-alias-button-primary-hover": "#8e76e8",
  "--dsw-alias-button-primary-dimmed": "rgba(124, 99, 214, 0.5)",
  "--dsw-alias-interactive-bg-hover": "rgba(155, 138, 224, 0.12)",
  "--dsw-alias-interactive-bg-active": "rgba(155, 138, 224, 0.18)",
  "--dsw-alias-border-l1": "rgba(180, 159, 187, 0.18)",
  "--dsw-alias-border-l2": "rgba(180, 159, 187, 0.30)",
  "--dsw-alias-border-l3": "rgba(180, 159, 187, 0.44)",
  "--dsw-alias-border-l4": "rgba(180, 159, 187, 0.58)",
};

/** 浅色：同一族色，明度轴掉过头。 */
const TOKENS_LIGHT = {
  "--dsw-alias-bg-base": "rgba(254, 254, 254, 0.88)",
  "--dsw-alias-bg-layer-1": "#fbf8fc",
  "--dsw-alias-bg-layer-2": "#f4eff7",
  "--dsw-alias-bg-layer-3": "#ebe3f0",
  "--dsw-alias-bg-overlay": "rgba(255, 255, 255, 0.97)",
  "--dsw-alias-bg-module-platform": "rgba(247, 243, 250, 0.94)",
  "--dsw-alias-bg-multi-select": "rgba(235, 227, 240, 0.94)",
  "--dsw-alias-bg-mask-1": "rgba(46, 38, 54, 0.28)",
  "--dsw-alias-bg-mask-2": "rgba(46, 38, 54, 0.16)",
  "--dsw-alias-label-primary": "#2e2636",
  "--dsw-alias-label-secondary": "#564969",
  "--dsw-alias-label-tertiary": "#88749e",
  "--dsw-alias-label-caption": "#7e6d90",
  "--dsw-alias-label-dimmed": "#a99bb8",
  "--dsw-alias-label-primary-foreground": "#fefefe",
  "--dsw-alias-label-primary-inverted": "#fefefe",
  "--dsw-alias-brand-primary": "#65549b",
  "--dsw-alias-brand-text": "#65549b",
  "--dsw-alias-brand-primary-invert": "#fefefe",
  "--dsw-alias-button-primary-fill": "#65549b",
  "--dsw-alias-button-primary-hover": "#77649f",
  "--dsw-alias-button-primary-dimmed": "rgba(101, 84, 155, 0.5)",
  "--dsw-alias-interactive-bg-hover": "rgba(101, 84, 155, 0.10)",
  "--dsw-alias-interactive-bg-active": "rgba(101, 84, 155, 0.16)",
  "--dsw-alias-border-l1": "rgba(86, 73, 105, 0.14)",
  "--dsw-alias-border-l2": "rgba(86, 73, 105, 0.24)",
  "--dsw-alias-border-l3": "rgba(86, 73, 105, 0.38)",
  "--dsw-alias-border-l4": "rgba(86, 73, 105, 0.52)",
};

export const THEME_ID = "dsh-theme-herta";
export const THEME_ID_DARK = "dsh-theme-herta-dark";
export const THEME_ID_LIGHT = "dsh-theme-herta-light";

/** 包里自带的四张（文件名即 id）。**第一张就是默认** —— 排序即默认，不用改三处。 */
export const BUILTIN_BACKGROUNDS = [
  { id: "bg-05-witch", label: "魔女阳台", file: "bg-05-witch.png" },
  { id: "bg-04-nebula-flower", label: "花与星云", file: "bg-04-nebula-flower.png" },
  { id: "bg-03-blueprint", label: "空间站工程图", file: "bg-03-blueprint.png" },
  { id: "bg-02-starchart", label: "星盘", file: "bg-02-starchart.png" },
];
/** 默认背景：魔女阳台（用户定的）。 */
export const DEFAULT_BACKGROUND = "bg-05-witch";

const LS = {
  bg: "herta-theme:bg", // builtin | url | color | off
  bgValue: "herta-theme:bg-value",
  veil: "herta-theme:veil",
};
const DEFAULT_VEIL = 18;

const log = (m, e) => console.warn(`[dsh-theme-herta] ${m}`, e ?? "");

function read(key, fallback) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) {
    log("localStorage 读不到，用默认值", e);
    return fallback;
  }
}
function write(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    log("localStorage 写不进（记住了但不持久）", e);
  }
}

/** 当前背景设置（来源 + 值 + 遮罩）。 */
export function getBackground() {
  return {
    source: read(LS.bg, "builtin"),
    value: read(LS.bgValue, DEFAULT_BACKGROUND),
    veil: Number(read(LS.veil, String(DEFAULT_VEIL))),
  };
}

const STYLE_ID = "herta-theme-style";
const BG_ID = "herta-theme-bg";
const SHADE_ID = "herta-theme-shade";

/**
 * 令牌样式表：**除了 `ctx.theme.register`，再用 `<style>` 把令牌注一遍（带 `!important`）**。
 * 这一步是照参照物的做法 ✗ —— 光靠主题服务，一旦它没认下来（或没被选为当前主题），
 * 界面就毫无变化、连个错都不报；带上这一层，样式**一定会**上。
 */
export function ensureStyle() {
  let el = document.getElementById(STYLE_ID);
  if (el === null) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  const tokens = currentMode() === "light" ? TOKENS_LIGHT : TOKENS_DARK;
  const tokenLines = Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v} !important;`)
    .join("\n");
  el.textContent = [
    // **不要设 `color-scheme`** ✗ —— 它会影响窗口自身的绘制：右上角那三个窗口键
    // 就是在设了它之后才显出来的。配色由令牌负责，不靠浏览器原生的明暗开关。
    "html { background: #17131d !important; }",
    "body { background: transparent !important; }",
    `body {\n${tokenLines}\n}`,
    // 应用的窗口 frame 是**整屏不透明**的（探针实测：div.BynINW_frame，rgb(27,27,28)，
    // 1280x820，position: relative，住在 #root 里）—— 负数 z 的壁纸层永远画在它后面 ✗，
    // 所以必须把它变透明，壁纸才露得出来。类名带哈希前缀（BynINW_frame），
    // 用后缀匹配，免得版本一变就失效。
    `[class*="_frame"] { background-color: transparent !important; }`,
    // 左侧那栏：**正解是改令牌** ✓ —— 参照物点的就是 `--dsw-specific-sidebar-*` 这一族
    // （fill / nav-item-hover / nav-item-active / active-accent），侧栏的底与悬停都归它们管。
    // 我上一版用类名硬压是错的解法 ✗（悬停会跳成不透明，正因为它另有出处）。
    "body {" +
      " --dsw-specific-sidebar-fill: rgba(38,31,46,0.64) !important;" +
      " --dsw-specific-sidebar-nav-item-hover: rgba(155,138,224,0.10) !important;" +
      " --dsw-specific-sidebar-nav-item-active: rgba(155,138,224,0.16) !important;" +
      " --dsw-specific-sidebar-nav-item-active-accent: #9b8ae0 !important; }",
    // 兜底：万一那栏没吃令牌（探针只量到"计算值不透明"，量不出它从哪儿来），
    // 类名这层仍按**同一个值**压住 —— 两处指向同一个数，就不会又出现不一致。
    `[class*="_sidebarCol"], [class*="_quietBars"] {` +
      " background-color: var(--dsw-specific-sidebar-fill, rgba(38,31,46,0.64)) !important; }",
    // 悬停：令牌 + 一点兜底，别跳成不透明。**不去改它的 transition** ✗ ——
    // 参照物根本不碰过渡，因为它的悬停本来就是半透明的，淡入淡出无所谓。
    `[class*="_sidebarCol"] *:hover, [class*="_quietBars"] *:hover {` +
      " background-color: rgba(155,138,224,0.10) !important; }",
    `body { --dsw-alias-interactive-bg-hover-solid: rgba(155,138,224,0.12) !important; }`,
    "#root { background-color: transparent !important; }",
    // 壁纸层（z -2）与可读性遮罩（z -1）：**不能**铺在 body 自己的背景上 ✗
    // —— 应用那些容器带着不透明底压在上面，铺了就看不见。
    `#${BG_ID} { position: fixed; inset: 0; z-index: -2; pointer-events: none;` +
      " background-color: #17131d; background-size: cover; background-repeat: no-repeat; }",
    `#${SHADE_ID} { position: fixed; inset: 0; z-index: -1; pointer-events: none; }`,
  ].join("\n");
  return el;
}

/** 两个固定层，只建一次。 */
export function ensureLayers() {
  let bg = document.getElementById(BG_ID);
  if (bg === null) {
    bg = document.createElement("div");
    bg.id = BG_ID;
    document.body.appendChild(bg);
  }
  let shade = document.getElementById(SHADE_ID);
  if (shade === null) {
    shade = document.createElement("div");
    shade.id = SHADE_ID;
    document.body.appendChild(shade);
  }
  return { bg, shade };
}

/** 把设置渲染到那两个层上。遮罩**有方向**：左侧（文字所在）压得更暗，右侧留给画面。 */
export function renderBackground(route = "/herta-theme") {
  const { source, value, veil } = getBackground();
  const { bg, shade } = ensureLayers();
  const v = Math.max(0, Math.min(60, veil)) / 100;
  const a = (k) => `rgba(11,8,16,${(v * k).toFixed(3)})`;

  shade.style.background =
    `linear-gradient(100deg, ${a(2.2)} 0%, ${a(1.6)} 34%, ${a(0.7)} 68%, ${a(0.25)} 100%), ` +
    `linear-gradient(180deg, ${a(1.2)} 0%, ${a(0.1)} 32%)`;

  if (source === "builtin") {
    const hit = BUILTIN_BACKGROUNDS.find((b) => b.id === value) ?? BUILTIN_BACKGROUNDS[0];
    bg.style.backgroundImage = `url("${route}/backgrounds/${hit.file}")`;
    bg.style.backgroundColor = "#17131d";
  } else if (source === "url" || source === "data") {
    bg.style.backgroundImage = `url("${value}")`;
    bg.style.backgroundColor = "#17131d";
  } else if (source === "color") {
    // 这里的值可能是**别的来源留下的**（比如一个图片文件名）✗ —— 不是颜色就用默认色。
    // 让浏览器去忽略非法值，就是「选了纯色但什么都没发生」那个 bug 的根 ✓。
    const solid = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) || /^rgba?\([\d.,%\s]+\)$/i.test(value);
    bg.style.backgroundImage = "none";
    bg.style.backgroundColor = solid ? value : "#17131d";
    shade.style.background = "none";
  } else {
    // off：交还底色（层留着，图撤掉）
    bg.style.backgroundImage = "none";
    bg.style.backgroundColor = "#17131d";
    shade.style.background = "none";
  }
  return getBackground();
}

/** 改背景设置并立刻生效（值不合法就退回默认，不抛）。 */
export function setBackground(patch) {
  const next = { ...getBackground(), ...patch };
  if (patch.source !== undefined) write(LS.bg, String(patch.source));
  if (patch.value !== undefined) write(LS.bgValue, String(patch.value));
  if (patch.veil !== undefined) write(LS.veil, String(patch.veil));
  return renderBackground();
}

/**
 * 当前配色方案。判据是**应用自己那个标记**：`body[data-ds-dark-theme]`
 * —— 参照物用的就是它；`documentElement.dataset.theme` 是我先前猜的，那个属性根本不存在。
 * 我们锁深色，所以正常情况下恒为 "dark"；浅色令牌留着，将来做「跟随系统」时再切。
 */
function currentMode() {
  if (document.body?.hasAttribute("data-ds-dark-theme") === true) return "dark";
  const t = document.documentElement.dataset?.theme;
  return t === "light" ? "light" : "dark";
}

/**
 * 装主题。**任何一步失败都只 warn，绝不把界面搞坏**（这是主题层的底线）。
 * @returns 清理函数（解绑观察器）。
 */
export function applyTheme(ctx, route = "/herta-theme") {
  if (ctx?.theme === undefined) {
    log("拿不到 theme 服务，配色不生效（界面保持原样）");
    return () => {};
  }

  /** 报状态：控制台一份 + localStorage 一份（后者落在盘上，我能读到 —— 浏览器控制台我够不到）。 */
  const status = (s, e) => {
    log(s, e);
    try {
      window.localStorage.setItem(
        "herta-theme:status",
        `${new Date().toISOString()} ${s}${e === undefined ? "" : `：${String(e?.message ?? e)}`}`,
      );
    } catch {
      /* 记不住就算了，别把主题搞坏 */
    }
  };

  const registerAndActivate = () => {
    try {
      ctx.theme.register({ id: THEME_ID_DARK, colorScheme: "dark", tokens: TOKENS_DARK });
      ctx.theme.register({ id: THEME_ID_LIGHT, colorScheme: "light", tokens: TOKENS_LIGHT });
      status("register ok（dark + light）");
    } catch (e) {
      status("register 失败", e);
    }
    try {
      // 照参照物：**锁深色标记**（已通过的那套就是深色的）。浅色的令牌也注册着，
      // 将来做「跟随系统」时再切。**但不设 `color-scheme`** ✗ —— 它会连带改窗口自身
      // 的绘制（右上角那三个键就是被它显出来的）。
      ctx.theme.setTheme(THEME_ID_DARK);
      document.body?.toggleAttribute("data-ds-dark-theme", true);
      status("setTheme ok（dark）");
    } catch (e) {
      status("setTheme 失败", e);
    }
  };

  // 参照物把这件事放在 cordis 的 effect 作用域里；有就用，没有就直接跑
  // —— 不能因为少一个 API 就整个不装主题。
  try {
    if (typeof ctx.effect === "function") ctx.effect(registerAndActivate);
    else registerAndActivate();
  } catch (e) {
    status("apply 失败", e);
  }

  // 应用自己会往回改那个深色标记，盯着它（参照物的做法）
  let observer = null;
  try {
    observer = new MutationObserver(() => {
      if (document.body && !document.body.hasAttribute("data-ds-dark-theme")) {
        document.body.toggleAttribute("data-ds-dark-theme", true);
      }
    });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    }
  } catch (e) {
    status("盯不住 data-ds-dark-theme", e);
  }

  try {
    ensureStyle();
    renderBackground(route);
    status(`背景已铺（两个层 + 令牌样式）：${JSON.stringify(getBackground())}`);
    // 探针：把"我下面站着什么、谁是不透明的"记到盘上 —— 真应用里谁压着壁纸，
    // 在探针页（那不是这个应用）里问不出来。下次我读 localStorage 就知道该改哪儿。
    try {
      window.localStorage.setItem("herta-theme:probe", JSON.stringify(probeReport()));
    } catch {
      /* 记不住就算了 */
    }
  } catch (e) {
    status("铺背景失败", e);
  }

  // ── 与原生标题栏那条对齐 ──────────────────────────────────────────────
  // DSH 的 preload-windows 里有个隐藏探针 span：它的 background-color（= 我们的
  // `--dsw-specific-sidebar-fill`）决定原生覆盖层的底色，它的 color（= 我们的
  // `--dsw-alias-label-primary`）决定那三根键的颜色。
  // 所以：**开机动画期间**把这两个令牌与遮罩一起压成同一个不透明色 → 那条与键一起融掉；
  // 动画结束就恢复 → 它们回到设计里该有的样子。它内部的 send() 盯着 body 的 style 属性
  // 与 head 的子节点，所以改完再碰一下 body.style 就能让它重发。
  //
  // 这个色必须**正好等于画布铺的那层暗底**，否则两片暗色之间会留一道缝（上一版用 #17131d
  // 就留了那道缝）。来源是 `lib/opening/opening-player.js`：
  //   dark ? `rgba(13, 17, 22, ${alpha})` : `rgba(255, 255, 255, ${alpha})`
  // 注释里写明那是「shell's 13,17,22」—— 也就是这个应用自己的暗底。
  let restoreCaption = null;
  try {
    restoreCaption = matchNativeCaption("#0d1116");
  } catch (e) {
    status("对齐原生标题栏失败", e);
  }

  return () => {
    try {
      restoreCaption?.();
    } catch (e) {
      log("还原标题栏失败", e);
    }
    try {
      observer?.disconnect();
    } catch (e) {
      log("解绑失败", e);
    }
  };
}

/**
 * 开机动画期间，把"原生标题栏那条 + 三根键"压成与遮罩同色。
 * @param matchColor - 不透明色（两边必须**完全同一个值**）。
 * @returns 还原函数；本次没播动画（例如刷新过）时返回 null。
 */
function matchNativeCaption(matchColor) {
  const stage = document.getElementById("herta-boot-splash");
  const body = document.body;
  if (stage === null || body === null) return null;

  const kick = () => {
    try {
      body.style.setProperty("--herta-caption-kick", String(Math.round(performance.now())));
    } catch {
      /* 碰不动就算了 */
    }
  };
  const set = (on) => {
    for (const name of ["--dsw-specific-sidebar-fill", "--dsw-alias-label-primary"]) {
      try {
        if (on) body.style.setProperty(name, matchColor, "important");
        else body.style.removeProperty(name);
      } catch {
        /* 单个令牌失败不影响另一个 */
      }
    }
    kick();
  };

  stage.style.background = matchColor; // 遮罩也用同一个色 —— 两边必须是一个色，否则就是原来那个错配
  set(true);

  const mo = new MutationObserver(() => {
    if (document.getElementById("herta-boot-splash") !== null) return;
    mo.disconnect();
    set(false);
  });
  mo.observe(body, { childList: true });

  return () => {
    try {
      mo.disconnect();
    } catch {
      /* ignore */
    }
    set(false);
  };
}

/**
 * 探针：回报壁纸层自己，以及**压在它上面的东西**。
 * 上一版只记了 z 与底色，漏了两样关键量 —— 尺寸（不透明的固定元素到底铺满没有）
 * 和"屏幕上某一点那一摞到底是什么"。补上这两样，下次不必再猜。
 */
function probeReport() {
  const pick = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      cls: el.className ? String(el.className).slice(0, 48) : undefined,
      bg: cs.backgroundColor,
      bgi: cs.backgroundImage === "none" ? undefined : cs.backgroundImage.slice(0, 60),
      z: cs.zIndex,
      pos: cs.position,
      op: cs.opacity,
      wh: [Math.round(r.width), Math.round(r.height)],
    };
  };
  const stackAt = (x, y) => {
    try {
      return document.elementsFromPoint(x, y).slice(0, 7).map(pick);
    } catch (e) {
      return ["elementsFromPoint 抛了：" + String(e && e.message)];
    }
  };
  const bg = document.getElementById(BG_ID);
  const shade = document.getElementById(SHADE_ID);
  const splash = document.getElementById("herta-boot-splash");

  /**
   * 应用自己那套 `--dsw-*` 变量里，**跟背景有关且不透明**的那些。
   * 左侧工作区栏不肯透，多半就是它用了其中一个 —— 照清单改，比一个个试类名靠谱。
   */
  const opaqueVars = () => {
    const out = {};
    for (const scope of [document.documentElement, document.body]) {
      if (!scope) continue;
      const cs = getComputedStyle(scope);
      for (let i = 0; i < cs.length; i++) {
        const name = cs[i];
        if (!name.startsWith("--dsw-")) continue;
        if (!/bg|background/i.test(name)) continue;
        const value = cs.getPropertyValue(name).trim();
        // 不透明 = rgb(...) / #rrggbb（没有 alpha 通道）
        if (/^rgb\(/i.test(value) || /^#[0-9a-f]{3,8}$/i.test(value)) out[name] = value;
      }
    }
    return out;
  };

  // 决定性测试：把遮罩临时改成"可命中"，再量一次右上角。
  // 如果那一摞顶上就是遮罩 → 你还看得见的三个键**一定不在网页里**（是原生画的）。
  const splashHitTest = () => {
    if (!splash) return "遮罩当前不在（这一测做不了）";
    const before = splash.style.pointerEvents;
    try {
      splash.style.pointerEvents = "auto";
      return stackAt(window.innerWidth - 40, 18);
    } catch (e) {
      return "命中测试抛了：" + String(e && e.message);
    } finally {
      splash.style.pointerEvents = before;
    }
  };

  return {
    at: new Date().toISOString(),
    view: [window.innerWidth, window.innerHeight],
    dark: document.body.hasAttribute("data-ds-dark-theme"),
    base: getComputedStyle(document.body).getPropertyValue("--dsw-alias-bg-base").trim(),
    html: pick(document.documentElement),
    body: pick(document.body),
    bgLayer: pick(bg),
    bgImage: bg ? getComputedStyle(bg).backgroundImage.slice(0, 80) : null,
    shadeLayer: pick(shade),
    children: [...document.body.children].slice(0, 12).map(pick),
    // 屏幕正中、右上角、**左侧工作区栏**各自压着什么 —— "谁挡住了"的直接答案
    center: stackAt(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2)),
    topRight: stackAt(window.innerWidth - 40, 18),
    leftSide: stackAt(100, Math.round(window.innerHeight / 2)),
    // 遮罩可命中时的右上角（看那三个键到底在不在网页里）
    topRightHit: splashHitTest(),
    opaqueBgVars: opaqueVars(),
  };
}

/**
 * 测试钩子：现在没有设置界面（那是下一步的事），先用这个在控制台里调。
 * 例：`__hertaTheme.setBackground({ source: "builtin", value: "bg-03-blueprint" })`
 */
export function installDebugHook(route = "/herta-theme") {
  window.__hertaTheme = {
    builtins: BUILTIN_BACKGROUNDS.map((b) => b.id),
    get: () => getBackground(),
    setBackground: (patch) => setBackground(patch),
    /** 换一张自带图 / 用外链 / 纯色 / 关掉 */
    builtin: (id) => setBackground({ source: "builtin", value: id }),
    url: (u) => setBackground({ source: "url", value: u }),
    solid: (c) => setBackground({ source: "color", value: c }),
    off: () => setBackground({ source: "off" }),
    veil: (n) => setBackground({ veil: n }),
  };
  console.log(
    `[dsh-theme-herta] 主题已装。背景可在控制台调：__hertaTheme.builtin("${BUILTIN_BACKGROUNDS[0].id}") / .url("https://…") / .solid("#17131d") / .off() / .veil(25)`,
  );
}

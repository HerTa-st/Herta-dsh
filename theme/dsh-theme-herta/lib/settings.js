/**
 * dsh-theme-herta —— 外观设置页（客户端）。
 *
 * 挂载方式照抄同机那个正在工作的设置页（`dsh-herta/lib/client.js`）：
 *
 *   ctx.inject(["slots"], (scoped) => {
 *     scoped.effect(() => scoped.slots.inject("settings.section", () =>
 *       scoped.slots.register({ name: "settings.section", id, order, label, inject }, Component)), "…");
 *   });
 *
 * 两条从它的注释里学来的要紧事 ✗：
 *   1. **必须 `slots.inject("settings.section", …)` 而不是裸 `register`** —— 那个槽由
 *      `ui-settings-general` 声明，不等声明到位就注册会**静默落空**；
 *   2. 组件是 React 组件（槽的渲染器决定的），所以 `require("react")` 由调用方传进来
 *      （`client.js` 手里才有 `require`）。
 *
 * 界面本身**全是自己画的 DOM** ✗ —— 不依赖 `@deepseek-ai/dsh-client-ui-primitives`
 * （少一个能坏的地方），颜色直接吃主题令牌，所以它跟着主题走。
 *
 * 值存在浏览器本地（`localStorage`，由 `theme.js` 读写）——**不是** profile 配置 ✗，
 * 所以换机器不带走。要变成"真设置"（落进 profile 的 config）得再加宿主那份字段表。
 */
import { BUILTIN_BACKGROUNDS, getBackground, renderBackground, setBackground } from "./theme.js";

export const SECTION_ID = "herta-theme";
export const SECTION_LABEL = "黑塔外观";

/** 一行：左边标题+说明，右边控件。 */
function row(label, hint, control) {
  const el = document.createElement("div");
  el.style.cssText =
    "display:flex;align-items:flex-start;gap:16px;padding:14px 0;" +
    "border-top:1px solid var(--dsw-alias-border-l1,rgba(180,159,187,.18))";
  const left = document.createElement("div");
  left.style.cssText = "flex:1 1 auto;min-width:0";
  const t = document.createElement("div");
  t.textContent = label;
  t.style.cssText = "font:500 13px/1.5 system-ui,'Microsoft YaHei',sans-serif;color:var(--dsw-alias-label-secondary,#b49fbb)";
  const h = document.createElement("div");
  h.textContent = hint;
  h.style.cssText =
    "margin-top:3px;font:12px/1.5 system-ui,'Microsoft YaHei',sans-serif;color:var(--dsw-alias-label-dimmed,#564969)";
  left.append(t, h);
  const right = document.createElement("div");
  right.style.cssText = "flex:0 0 auto";
  right.append(control);
  el.append(left, right);
  return el;
}

/** 一小段按钮组（选中的那个高亮）。 */
function segmented(options, current, onPick) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:inline-flex;border:1px solid var(--dsw-alias-border-l3,rgba(180,159,187,.44));border-radius:9px;overflow:hidden";
  for (const opt of options) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = opt.label;
    const on = opt.value === current;
    b.style.cssText =
      "font:inherit;padding:6px 12px;border:0;cursor:pointer;" +
      (on
        ? "background:var(--dsw-alias-bg-layer-3,rgba(56,46,66,.88));color:var(--dsw-alias-label-primary,#ebdfe7)"
        : "background:transparent;color:var(--dsw-alias-label-secondary,#b49fbb)");
    b.addEventListener("click", () => onPick(opt.value));
    wrap.append(b);
    if (opt !== options[options.length - 1]) {
      const sep = document.createElement("span");
      sep.style.cssText = "width:1px;background:var(--dsw-alias-border-l3,rgba(180,159,187,.44))";
      wrap.append(sep);
    }
  }
  return wrap;
}

/** 面板主体：读设置 → 画控件 → 改动即写回并立刻生效。 */
function buildPanel(route) {
  const panel = document.createElement("div");
  panel.style.cssText = "max-width:640px;font:13px/1.6 system-ui,'Microsoft YaHei',sans-serif";

  const intro = document.createElement("p");
  intro.textContent = "主题的一切都在这一屏。不开浮动条 —— 它不会出现在界面上。";
  intro.style.cssText = "margin:0 0 6px;color:var(--dsw-alias-label-dimmed,#564969);font-size:12px";
  panel.append(intro);

  const redraw = () => {
    const cur = getBackground();
    panel.replaceChildren(intro);

    /** 看起来像颜色吗（只认 #rgb/#rrggbb/rgb()/rgba()）—— 非法值不写进去，免得又"没变化" ✗。 */
    const isColor = (v) =>
      /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ||
      /^rgba?\([\d.,%\s]+\)$/i.test(v);

    /** 把用户选的文件读成 data URL —— 先压到最长边 2560（localStorage 只有几 MB，不能不压 ✗）。 */
    const fileToBackground = async (file) => {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const c2d = canvas.getContext("2d");
      if (c2d === null) throw new Error("拿不到 2d 上下文");
      c2d.drawImage(bitmap, 0, 0, w, h);
      if (typeof bitmap.close === "function") bitmap.close();
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (dataUrl.length > 4 * 1024 * 1024) {
        throw new Error("压过之后还是太大（超过 4MB），换一张小一点的");
      }
      return dataUrl;
    };

    // 1) 背景来源：自带图 / 图片（网址或本机文件）/ 纯色 / 关
    const isImageSource = cur.source === "url" || cur.source === "data";
    panel.append(
      row(
        "背景来源",
        "「图片」可以填网址，也可以从本机选一张（选的文件只存在这台机器上）。「纯色」不铺图，只用一个底色。",
        segmented(
          [
            { value: "builtin", label: "自带" },
            { value: "image", label: "图片" },
            { value: "color", label: "纯色" },
            { value: "off", label: "关" },
          ],
          isImageSource ? "image" : cur.source,
          (v) => {
            if (v === "image") {
              // 从「自带」切过来时，值里还挂着自带图的名字 ✗ —— 清掉，等用户给网址或选文件。
              setBackground({ source: "url", value: /^https?:/i.test(cur.value) ? cur.value : "" });
            } else if (v === "color") {
              // **这就是"没变化"的原因** ✗：值可能是个图片名，被当成颜色用 → 非法 → 浏览器忽略。
              setBackground({ source: "color", value: isColor(cur.value) ? cur.value : "#17131d" });
            } else {
              setBackground({
                source: v,
                value: v === "builtin" ? BUILTIN_BACKGROUNDS[0].id : cur.value,
              });
            }
            renderBackground(route);
            redraw();
          },
        ),
      ),
    );

    // 2) 图片：网址格 + 「选本机图片」
    if (isImageSource) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = /^data:/i.test(cur.value) ? "" : cur.value;
      input.placeholder = "粘贴图片网址，或点右边的按钮选本机文件";
      input.style.cssText =
        "width:100%;margin-top:10px;padding:8px 10px;border-radius:9px;font:inherit;" +
        "background:rgba(10,8,14,.5);border:1px solid var(--dsw-alias-border-l2,rgba(180,159,187,.3));" +
        "color:var(--dsw-alias-label-primary,#ebdfe7)";
      input.addEventListener("input", () => {
        setBackground({ source: "url", value: input.value.trim() });
        renderBackground(route);
      });

      const file = document.createElement("input");
      file.type = "file";
      file.accept = "image/*";
      file.style.display = "none";

      const note = document.createElement("div");
      note.textContent = /^data:/i.test(cur.value) ? "当前用的是一张本机导入的图。" : "";
      note.style.cssText =
        "margin-top:8px;font:12px/1.5 system-ui,'Microsoft YaHei',sans-serif;" +
        "color:var(--dsw-alias-label-dimmed,#564969)";

      file.addEventListener("change", () => {
        const f = file.files?.[0];
        if (f === undefined) return;
        note.textContent = "读取中…";
        fileToBackground(f)
          .then((dataUrl) => {
            setBackground({ source: "data", value: dataUrl });
            renderBackground(route);
            redraw();
          })
          .catch((e) => {
            note.textContent = "这张图没能用上：" + String(e?.message ?? e);
          });
      });

      const pickBtn = document.createElement("button");
      pickBtn.type = "button";
      pickBtn.textContent = "选本机图片";
      pickBtn.style.cssText =
        "font:inherit;margin-top:10px;padding:6px 14px;border-radius:9px;cursor:pointer;background:transparent;" +
        "border:1px solid var(--dsw-alias-border-l3,rgba(180,159,187,.44));" +
        "color:var(--dsw-alias-label-secondary,#b49fbb)";
      pickBtn.addEventListener("click", () => file.click());

      const box = document.createElement("div");
      box.append(input, pickBtn, file, note);
      panel.append(box);
    }

    // 3) 纯色：一个颜色格 + 预览方块
    if (cur.source === "color") {
      // 预设：全部取自她原画量出来的那几档，外加应用自己的暗底 —— 点点就能用，
      // 不用手打色号。要别的颜色，右边有系统调色盘，再右边能精确输入。
      const PRESETS = [
        "#0d1116",
        "#17131d",
        "#1d1826",
        "#2e2636",
        "#564969",
        "#65549b",
        "#88749e",
        "#b49fbb",
        "#ebdfe7",
        "#fefefe",
      ];
      const pick = (v) => {
        if (!isColor(v)) return;
        setBackground({ source: "color", value: v });
        renderBackground(route);
        redraw(); // 重画一遍：预览方块、调色盘、输入框三处跟着同步
      };

      const strip = document.createElement("div");
      strip.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:12px";
      for (const c of PRESETS) {
        const sw = document.createElement("button");
        sw.type = "button";
        sw.title = c;
        const on = isColor(cur.value) && cur.value.toLowerCase() === c;
        sw.style.cssText =
          "width:26px;height:26px;border-radius:7px;cursor:pointer;padding:0;" +
          "background:" +
          c +
          ";border:2px solid " +
          (on ? "var(--dsw-alias-brand-primary,#9b8ae0)" : "rgba(255,255,255,.18)");
        sw.addEventListener("click", () => pick(c));
        strip.append(sw);
      }
      panel.append(strip);

      const native = document.createElement("input");
      native.type = "color";
      native.value = /^#[0-9a-f]{6}$/i.test(cur.value) ? cur.value : "#17131d";
      native.title = "系统调色盘";
      native.style.cssText =
        "width:38px;height:28px;padding:0;border:0;background:none;cursor:pointer;vertical-align:middle";
      native.addEventListener("input", () => pick(native.value));

      const colorInput = document.createElement("input");
      colorInput.type = "text";
      colorInput.value = isColor(cur.value) ? cur.value : "#17131d";
      colorInput.placeholder = "#17131d";
      colorInput.style.cssText =
        "width:150px;padding:8px 10px;border-radius:9px;font:inherit;" +
        "background:rgba(10,8,14,.5);border:1px solid var(--dsw-alias-border-l2,rgba(180,159,187,.3));" +
        "color:var(--dsw-alias-label-primary,#ebdfe7)";
      const swatch = document.createElement("span");
      const paint = () => {
        const v = colorInput.value.trim();
        swatch.style.cssText =
          "display:inline-block;width:22px;height:22px;border-radius:6px;vertical-align:middle;" +
          "border:1px solid var(--dsw-alias-border-l3,rgba(180,159,187,.44));" +
          "background:" +
          (isColor(v) ? v : "#17131d");
      };
      colorInput.addEventListener("input", () => {
        paint();
        const v = colorInput.value.trim();
        if (!isColor(v)) return; // 非法值不写进去
        setBackground({ source: "color", value: v });
        renderBackground(route);
      });
      paint();

      const box = document.createElement("div");
      box.style.cssText = "margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap";
      box.append(native, colorInput, swatch);
      panel.append(box);
    }

    // 3) 四张自带图（点一下即换）
    if (cur.source === "builtin") {
      const strip = document.createElement("div");
      strip.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-top:12px";
      for (const b of BUILTIN_BACKGROUNDS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.cssText =
          "padding:0;border-radius:10px;overflow:hidden;cursor:pointer;background:none;" +
          `border:2px solid ${b.id === cur.value ? "var(--dsw-alias-brand-primary,#9b8ae0)" : "transparent"}`;
        const img = document.createElement("img");
        img.src = `${route}/backgrounds/${b.file}`;
        img.alt = b.label;
        img.style.cssText = "display:block;width:132px;height:74px;object-fit:cover";
        const cap = document.createElement("span");
        cap.textContent = b.label;
        cap.style.cssText =
          "display:block;padding:4px 2px 2px;text-align:left;font-size:12px;color:var(--dsw-alias-label-tertiary,#88749e)";
        btn.append(img, cap);
        btn.addEventListener("click", () => {
          setBackground({ source: "builtin", value: b.id });
          renderBackground(route);
          redraw();
        });
        strip.append(btn);
      }
      panel.append(strip);
    }

    // 4) 遮罩强度
    const veil = document.createElement("input");
    veil.type = "range";
    veil.min = "0";
    veil.max = "60";
    veil.value = String(cur.veil);
    veil.style.cssText = "width:200px;vertical-align:middle";
    const veilVal = document.createElement("span");
    veilVal.textContent = `${cur.veil}%`;
    veilVal.style.cssText = "margin-left:8px;color:var(--dsw-alias-label-primary,#ebdfe7)";
    veil.addEventListener("input", () => {
      veilVal.textContent = `${veil.value}%`;
      setBackground({ veil: Number(veil.value) });
      renderBackground(route);
    });
    const veilBox = document.createElement("span");
    veilBox.append(veil, veilVal);
    panel.append(row("遮罩强度", "把背景压暗多少；文字压不住就往右推。", veilBox));

    // 5) 恢复默认
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "恢复默认";
    reset.style.cssText =
      "font:inherit;padding:6px 14px;border-radius:9px;cursor:pointer;background:transparent;" +
      "border:1px solid var(--dsw-alias-border-l3,rgba(180,159,187,.44));color:var(--dsw-alias-label-secondary,#b49fbb)";
    reset.addEventListener("click", () => {
      setBackground({ source: "builtin", value: BUILTIN_BACKGROUNDS[0].id, veil: 18 });
      renderBackground(route);
      redraw();
    });
    panel.append(row("恢复默认", "背景回到第一张自带图、遮罩回到 18%。", reset));
  };

  redraw();
  return panel;
}

/**
 * 把设置区挂上 DSH 的 `settings.section` 槽。
 * @param ctx - 插件上下文（cordis）。
 * @param options - `{ React, route }`；`React` 由 `client.js` 用 `require("react")` 拿到。
 * @returns 卸载函数（没有槽、或没有 React 时返回 null）。
 */
export function installSettingsSection(ctx, options = {}) {
  const { React, route = "/herta-theme" } = options;
  const log = (m, e) => console.warn(`[dsh-theme-herta] ${m}`, e ?? "");
  if (ctx?.inject === undefined) {
    log("拿不到 cordis 上下文，设置页不挂");
    return null;
  }
  if (React === undefined || typeof React.createElement !== "function") {
    log("拿不到 React，设置页不挂（值仍可用 __hertaTheme 调）");
    return null;
  }

  const Component = function HerthaThemeSettings() {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const host = ref.current;
      if (host === null) return undefined;
      // 面板是**我们自己画的 DOM** —— 挂进来、卸载时带走。
      const panel = buildPanel(route);
      host.append(panel);
      return () => {
        panel.remove();
      };
    }, []);
    return React.createElement("div", { ref });
  };

  ctx.inject(["slots"], (scoped) => {
    scoped.effect(
      () =>
        scoped.slots.inject("settings.section", () =>
          scoped.slots.register(
            {
              name: "settings.section",
              id: SECTION_ID,
              order: 30,
              label: () => SECTION_LABEL,
              inject: () => ({}),
            },
            Component,
          ),
        ),
      "dsh-theme-herta: settings section",
    );
  });

  return () => {
    /* cordis 的 effect 会在卸载时自己撤下贡献 */
  };
}

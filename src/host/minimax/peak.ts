/**
 * 峰值归一化 —— **只给 `relay` 那类端点用**（`endpoint.ts` 的 `relay` 形状）。
 *
 * ## 为什么需要（实测，不是"顺手优化"）
 *
 * 中转站回的裸 PCM 电平明显偏小：同一句台词的峰值只有 `6231 / 32768 ≈ 0.19`，
 * 而官方那条路回来的同长度音频峰值在 `28000 / 32768 ≈ 0.85` 量级
 * （2026-10-10 实测，95 017 样本 / 3.96 秒 / 24 kHz）。不做归一化，听感就是
 * "换了一档之后她说话明显变轻"，而用户只会以为是插件坏了。
 *
 * ## 为什么**不是**无条件乘一个系数
 *
 * 归一化是有代价的：把任何材料放大到满刻度，等于对本来正常的素材做了一次
 * 削波。所以这里设两道闸，只对**明确偏轻**的材料动手：
 *
 *   · `peak < MIN_PEAK`（0.5，≈ int16 的 16384）才放大；
 *   · 放大后**不越过** `maxPeak`（0.99），留一点头。
 *
 * 官方那条路的峰值本来就在 0.85 上下 —— 也在阈值之上，所以即使哪天把它接进来，
 * 它也不会被这条规则碰到。
 *
 * 纯函数、无副作用：入口是 `Int16Array`，出口是新的 `Int16Array`。
 */

/** 低于这个峰值（相对满刻度）才算"偏轻"，值得放大。 */
export const MIN_PEAK = 0.5;

/** 目标峰值：留 1% 头，免得下游重采样时削波。 */
export const TARGET_PEAK = 0.99;

/**
 * 峰值低于 `MIN_PEAK` 时把整条音频放大到 `TARGET_PEAK`；否则**原样返回**。
 *
 * 返回原对象（而不是副本）是有意的：调用方据此可以判断"什么都没做"，
 * 而多复制一份 90 k 样本的数组在每句话上都是白花的。
 */
export function normalizePeak(
  samples: Int16Array,
  minPeak = MIN_PEAK,
  targetPeak = TARGET_PEAK,
): Int16Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] ?? 0;
    const abs = v < 0 ? -v : v;
    if (abs > peak) peak = abs;
  }
  // 全零（或空）没得放大：`peak === 0` 时比值是 NaN，乘完会变成一整条 NaN。
  if (peak === 0) return samples;
  const gain = targetPeak / (peak / 32768);
  if (gain <= 1) return samples;
  if (peak / 32768 >= minPeak) return samples;

  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const scaled = Math.round((samples[i] ?? 0) * gain);
    out[i] = scaled > 32767 ? 32767 : scaled < -32768 ? -32768 : scaled;
  }
  return out;
}

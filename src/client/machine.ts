/**
 * 「机器」那一层：DSH 的设置表单、凭据服务、机器字段的读写（#2 拆出的四个 region 之一）。
 *
 * 为什么单独一个文件：这一段由 **DSH 的 bridge 与凭据通道**驱动，与语音（SSE/PCM）、界面（面板/视图）、
 * 设置页三项各不相干 —— 改语音的 PCM 播放不必碰这里的 diff（架构审查 candidate #2 的 Divergent change）。
 *
 * 从 `index.tsx` 原样搬来（含 machineForm 那个模块级状态与 MachineForm 接口）：只改了所在文件、export，
 * 以及给装配层补了一个显式入口 `bindMachineForm` —— 行为没动。
 */
import { createRoot, type Root } from "react-dom/client";
import { fullSnapshot, nodesToRecord, toBubbles } from "../shared/mapping.js";
import {
  buildRealtimeVoiceState,
  isVoiceEngine,
  normalizeVoiceSettings,
} from "../host/voice-settings-shared.js";
import {
  FIELDS,
  normalizeSettings,
  SETTINGS_GROUPS,
  SETTINGS_NAMESPACE,
  UNWIRED_FIELD_NAMES,
} from "../host/settings-schema.js";
export interface MachineForm {
  getSnapshot(): {
    status: "loading" | "ready" | "unavailable";
    value?: Record<string, unknown>;
    user?: unknown;
    writable?: boolean;
  };
  subscribe(listener: () => void): () => void;
  set(field: string, value: unknown): Promise<boolean>;
  unset(field: string): Promise<boolean>;
  mutate(ops: readonly unknown[]): Promise<boolean>;
}

/**
 * 当前绑定的设置表单。由 `apply` 里的 `ctx.inject(["configForms"], …)` 赋值 ——
 * 服务缺席（或命名空间还没被宿主服务）时保持 null，所有读取退到默认值，
 * 所有写入变成无害的空操作。**不报错、不白屏**是这里唯一的设计要求。
 */
export let machineForm: MachineForm | null = null;

/** 设置值快照（永远完整：非法/缺失一律回落默认），供 iframe 的应答器同步读。 */
export function machineValues(): Record<string, unknown> {
  return normalizeSettings(machineForm?.getSnapshot().value);
}

/** 一趟原子写入：一次 revision 栅栏、一次失败重读。 */
async function writeMachineOps(ops: readonly Record<string, unknown>[]): Promise<boolean> {
  const field = String((ops[0]?.path as readonly string[] | undefined)?.[0] ?? "");
  if (machineForm === null) {
    markMachine("settingsWriteSkipped", field);
    return false;
  }
  try {
    const accepted = await machineForm.mutate(ops);
    markMachine("settingsLastWrite", field);
    markMachine("settingsLastWriteAccepted", accepted);
    return accepted;
  } catch (error) {
    markMachine("settingsWriteError", String((error as Error)?.message ?? error));
    return false;
  }
}

/** 写一个设置字段。 */
export async function writeMachineField(field: string, value: unknown): Promise<boolean> {
  return writeMachineOps([{ op: "set", path: [field], value }]);
}

/**
 * 读一个设置字段的当前值（已归一）。
 *
 * iframe 的应答器要用它 —— 那里是**同步**应答（`getLocale` 这类不能 await HTTP），
 * 所以只能读客户端手上的这份快照。
 */
export function machineField(field: string): unknown {
  return machineValues()[field];
}

/** 记一条设置相关的诊断，便于从无头浏览器外部确认「到底写没写」。 */
function markMachine(field: string, value: unknown): void {
  const mark = (globalThis as Record<string, unknown>).__DSH_HERTA__ as
    | Record<string, unknown>
    | undefined;
  if (mark !== undefined) mark[field] = value;
}

/**
 * DSH 的**凭据缝**（`ctx.remote.credentials`）—— 只列本文件用到的三个成员。
 *
 * ## 为什么密钥不走 Config
 *
 * Config 落在 profile 的 `cordis.patch.yml` 里，那是**明文 YAML**。密钥走那条路
 * 等于把它们公开。凭据缝才是它的位置：值的读写分两半，读的那半只回
 * `{configured, source, writable}`（**没有能装值的槽位**），所以它才能安全地跨
 * Remote 走到浏览器；写的那半是 `set(ref, value)`，落 `$DSH_HOME/.credentials.yaml`
 * （0600，file 层，可写）。
 *
 * ## 为什么是 `remote.credentials` 而不是自己开一条 HTTP
 *
 * 官方设置页（`dsh-client-ui-settings-models`）存密钥走的就是这一套
 * （`lib/client.js:2787-2795`）。自己再开一条写入口就是第二个真相来源 ——
 * 上一版正因这个理由删掉了 `/herta-settings`。
 *
 * 服务缺席（无头 / SDK 组合）时这里保持 `null`，页面上的密钥行显示「不可用」
 * 而不是抛错：`ctx.inject` 的回调不触发，别的部分照常。
 */
interface CredentialsRemote {
  describe(refs: readonly string[]): Promise<{
    ok: boolean;
    value?: Record<string, { configured?: boolean; source?: string; writable?: boolean }>;
    error?: { message?: string };
  }>;
  set(ref: string, value: string): Promise<{ ok: boolean; error?: { message?: string } }>;
  unset(ref: string): Promise<{ ok: boolean; error?: { message?: string } }>;
}

/** 由 `installSettingsSection` 里的惰性 inject 赋值；缺席即 null。 */
export let credentialsRemote: CredentialsRemote | null = null;

/**
 * 凭据缝**晚一点**才出现的订阅者。
 *
 * 页面的密钥行在挂载时就会查一次状态，而 `remote.credentials` 可能是握手之后
 * 才挂上来的（见 `installSettingsSection` 里的注释）。没有这张订阅表，那一次
 * 查询会永久停在「凭据服务不可用」，即使服务半秒后就绪 —— 那是「界面在说谎」，
 * 正是这一轮要消灭的东西。
 */
const credentialsSubs = new Set<() => void>();

/** 绑定凭据缝并通知所有正在等它的行。 */
function bindCredentialsRemote(next: CredentialsRemote): void {
  credentialsRemote = next;
  for (const cb of credentialsSubs) {
    try {
      cb();
    } catch {
      /* 一个订阅者坏掉不该影响别的 */
    }
  }
}

/** 订阅「凭据缝就绪」。返回退订函数。 */
export function subscribeCredentials(cb: () => void): () => void {
  credentialsSubs.add(cb);
  return () => {
    credentialsSubs.delete(cb);
  };
}

/**
 * 解析凭据缝（`remote.credentials`）。拿不到就返回 `undefined`，**永不抛错**。
 *
 * ## 为什么不用 `ctx.inject(["remote.credentials"], …)`
 *
 * 实测（lab，三次构建）：
 *   · `inject(["remote.credentials"])` —— 回调**不触发**，三行密钥全「不可用」；
 *   · `inject(["remote"])` 之后读 `scoped.remote.credentials` —— 也不可靠
 *     （第一次构建里那次回调确实触发了，可那次没读属性；之后两次连回调都没来，
 *     计时器也没到超时，与「读属性抛异常」一致）。
 *
 * 所以这里不再依赖注入时机，也不假设属性读取会安静地返回 undefined ——
 * 两种取法都包在 try 里，失败就交给上层的**有界轮询**再试。
 * 轮询不是洁癖：`credentials` 是握手之后挂到 `remote` 上的命名空间，
 * 客户端插件挂载时它常常还没到。
 *
 * @param ctx - 插件（或注入作用域）的 cordis 上下文。
 * @returns 凭据缝，或 undefined。
 */
export function resolveCredentials(ctx: {
  get?(name: string): unknown;
  remote?: unknown;
}): CredentialsRemote | undefined {
  try {
    const direct = ctx.get?.("remote.credentials");
    if (direct !== undefined && direct !== null) return direct as CredentialsRemote;
  } catch {
    // 服务路径解不开：退回下面那次属性读取。
  }
  try {
    const remote = ctx.remote;
    if (remote === null || remote === undefined || typeof remote !== "object") return undefined;
    return (remote as { credentials?: CredentialsRemote }).credentials;
  } catch {
    return undefined;
  }
}

/** 有界轮询凭据缝并绑定；每次结果都写进诊断标记（`__DSH_HERTA__`）。 */
export function watchCredentials(
  ctx: { get?(name: string): unknown; remote?: unknown; effect?(cb: () => unknown, label?: string): unknown },
  mark: Record<string, unknown>,
): void {
  const already = resolveCredentials(ctx);
  if (already !== undefined) {
    bindCredentialsRemote(already);
    mark.settingsCredentialsBound = true;
    mark.settingsCredentialsAttempts = 1;
    return;
  }
  const INTERVAL_MS = 500;
  const MAX_ATTEMPTS = 40; // 20 秒
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const found = resolveCredentials(ctx);
    if (found !== undefined) {
      bindCredentialsRemote(found);
      mark.settingsCredentialsBound = true;
      mark.settingsCredentialsAttempts = attempts;
      clearInterval(timer);
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      mark.settingsCredentialsError = `remote.credentials 在 ${(MAX_ATTEMPTS * INTERVAL_MS) / 1000} 秒内没有出现（试了 ${attempts} 次）`;
      clearInterval(timer);
    }
  }, INTERVAL_MS);
  // 随插件 fiber 一起释放，别留下没人清的定时器。
  ctx.effect?.(() => () => clearInterval(timer), "dsh-herta: 等 remote.credentials");
}

/** 查一个密钥「设了没有」。拿不到服务时返回 undefined（页面显示「不可用」）。 */
export async function credentialStatus(
  ref: string,
): Promise<{ configured: boolean; writable: boolean } | undefined> {
  if (credentialsRemote === null) {
    markMachine("credentialsStatusError", "no-remote");
    return undefined;
  }
  try {
    const res = await credentialsRemote.describe([ref]);
    if (!res.ok) {
      // 注入成功但调用失败，是最容易看错的一种：注入标记为 true，页面却全线
      // 「不可用」。所以这里单独记一条，好从无头浏览器外部一眼分清。
      markMachine("credentialsStatusError", res.error?.message ?? "describe rejected");
      return undefined;
    }
    const info = res.value?.[ref];
    return { configured: info?.configured === true, writable: info?.writable !== false };
  } catch (error) {
    markMachine("credentialsStatusError", String((error as Error)?.message ?? error));
    return undefined;
  }
}

/** 存一个密钥。返回 null 表示成功，否则是给用户看的原因。 */
export async function saveCredential(ref: string, value: string): Promise<string | null> {
  if (credentialsRemote === null) return "这个部署没有挂凭据服务";
  try {
    const res = await credentialsRemote.set(ref, value);
    return res.ok ? null : (res.error?.message ?? "宿主拒绝了这次写入");
  } catch (error) {
    return String((error as Error)?.message ?? error);
  }
}

/** 清掉一个密钥。返回 null 表示成功，否则是原因。 */
export async function clearCredential(ref: string): Promise<string | null> {
  if (credentialsRemote === null) return "这个部署没有挂凭据服务";
  try {
    const res = await credentialsRemote.unset(ref);
    return res.ok ? null : (res.error?.message ?? "宿主拒绝了这次删除");
  } catch (error) {
    return String((error as Error)?.message ?? error);
  }
}
/**
 * 装配层用它把设置表单交给这一层。
 *
 * 为什么要有这个函数：原先 `apply` 里是直接 `machineForm = form;` —— 而 `machineForm` 现在住在本文件，
 * 外面直接赋值就成了「给 import 赋值」（v1 就是被 esbuild 这一条挡下的）。状态归这一层独占，外面只经这个口子。
 */
export function bindMachineForm(form: MachineForm | null): void {
  machineForm = form;
}

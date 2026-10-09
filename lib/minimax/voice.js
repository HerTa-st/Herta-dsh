/**
 * MiniMax 音色**认领**服务（只认领，不克隆）。
 *
 * ## 与上游最大的差别，以及为什么
 *
 * 上游 `Herta-src/.../tts/minimax-voice.ts` 的 `prepare()` 会做三件事：探测 host、
 * 列账号上的克隆、**没有就上传参考音频现克隆一个**。本插件**不做第三件**
 * （用户决策：参考音频 8.36 MB 且只存在于她的安装目录里，不把它带进插件）——
 * 于是这里的 `prepare()` 只有两步：
 *
 *   1. `probeHost` 选一个能用的大陆/国际端点；
 *   2. `listClones` 找**带 herta tag 的克隆**并采用最新那个。
 *
 * 认领是可行的，因为她的克隆 id 形如 `herta-b1a43133-uo58hrlu1x`，而
 * `LEGACY_REFERENCE_TAG = "b1a43133"` 正是上游为"参考音频换过一次"准备的兼容标记
 * （它同时是 `herta-reference.wav` 的 SHA-256 前 8 位 —— 这条巧合让"不下载那份
 * 8 MB 音频也能认领"成立）。
 *
 * ## 没有克隆可认领时会发生什么（诚实版本）
 *
 * MiniMax 会删除 7 天没用的克隆。上游这时会自动重克隆一次；**我们没有克隆能力**，
 * 所以：清掉记录 → 进入 `failed` → 由宿主分发层**显式回落本地模型**（并在状态里
 * 标明"已回落"）。`failed` 同时写进冷却（10 分钟），到期后会再 `listClones` 一次 ——
 * 如果你在独立版里重新克隆了，DSH 这边就会自动认领回来。
 *
 * ## 密钥是异步的（这条与上游不同）
 *
 * 上游从 `key-store` 同步读文件；DSH 的凭据服务 `ctx.credentials.resolve()` 是
 * **异步**的。所以这里注入的 `key()` / `planKey()` 返回 Promise —— 值每次现读，
 * 不缓存明文。
 */
                                                          
import {
  MINIMAX_CONTROL_TIMEOUT_MS,
  MINIMAX_HOSTS,
  MiniMaxError,
  listClones,
  probeEndpoint,
  synthesizePcm,
  withDeadline,
} from "./api.js";
                                                   
import { DEFAULT_ENDPOINT_SHAPE, probeShape, shapeFor } from "./endpoint.js";
                                                   
import { adoptCoolingDown, cloneRecordOf, emptyState, readMiniMaxState, writeMiniMaxState } from "./state.js";
import { errorMessage } from "./types.js";

/**
 * 上游的 `LEGACY_REFERENCE_TAG`：第一版参考音频的 tag。
 * 它同时是 `herta-reference.wav` 的 SHA-256 前 8 位（`b1a43133…`）。
 */
export const LEGACY_REFERENCE_TAG = "b1a43133";

/** 认领阶段。与上游同名同义（`preparing` 是瞬态，读状态的人可能看不到它）。 */
                                                                            

/** 与上游一致：失败原因 = HTTP 层的原因码，外加"没有可认领的克隆"。 */
                                                                            

/** 给宿主/设置页读的一份事实（可 JSON 序列化，直接进 SSE 与端点）。 */
                                      
                           
                   
                
                    
                      
                                           
                           
                                           
                            
                                
                                         
                   
 

                                      
                   
                               
                                    
                                         
                                         
                                                        
                                
                                           
                            
                     
                               
                                         
                                                    
                      
                           
     
                                                                     
                                  
    
                                                   
                                                 
                         
    
                                                
                                                       
                                                            
                                                                 
     
                                                                              
                                           
                              
     
                                
    
                                                       
                                           
             
     
                                           
 

                                      
                                 
                             
                                                    
                             
                                          
                                      
                               
                                  
                                     
                        
                                                      
                                        
 

/** 克隆 id 是不是"她的"（上游按 tag 判断；这里用包含判定，与她 id 的形状一致）。 */
export function isHertaVoiceId(voiceId        , tag = LEGACY_REFERENCE_TAG)          {
  return voiceId.includes(tag);
}

/** 把上游的 `createdTime`（数字秒/毫秒或字符串）折成毫秒；不认识就给兜底值。 */
function createdMs(value         , fallback        )         {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** 非空字符串才算"填了"（与 `state.ts` 的 `str()` 同一条口径：空串等于缺失）。 */
function trimmed(value                    )                     {
  if (typeof value !== "string") return undefined;
  const out = value.trim().replace(/\/+$/, "");
  return out === "" ? undefined : out;
}

/** 校验钉住的音色时念的那一句。**只花一个字符**（平台按字符计费），
 *  内容是作者本人的台词 —— 万一哪天它出现在日志里，至少不是一句乱码。 */
const VERIFY_TEXT = "黑塔。";

/** 落进 `adoptedTag` 的标记：这条记录来自用户在设置里钉的音色，不是认领来的。
 *  有它，日志和状态文件里就能分清"这是他自己填的"还是"插件替他找的"。 */
const ADOPTED_PIN_TAG = "configured";

/**
 * 创建认领服务。
 *
 * 构造时**同步**读一次状态（读文件是同步的、且失败一律当空），所以 `readout()` 与
 * `voice()` 都是同步的 —— 宿主可以在任何地方问"现在有没有克隆"，不必 await。
 */
export function createMiniMaxVoiceService(opts                     )                      {
  const log = opts.log ?? ((line        ) => console.log(`[herta-minimax] ${line}`));
  const now = opts.now ?? (() => Date.now());
  const cooldownMs = opts.cooldownMs ?? 10 * 60_000;
  const stampThrottleMs = opts.stampThrottleMs ?? 10 * 60_000;
  const load = opts.load ?? (() => readMiniMaxState());
  const save = opts.save ?? ((state                  ) => writeMiniMaxState(state));

  let state                   = (() => {
    try {
      return load();
    } catch {
      return emptyState();
    }
  })();

  /** 瞬态失败（取消）不写盘，只影响本次 readout。 */
  let transientError                               ;
  /** 钉住的音色**本进程内**校验过没有。它是"只探一次"的闩锁：不闩住的话，每问一次
   *  `prepare()`（宿主在启动与填密钥时都会问）就多打一次网络。 */
  let pinReady = false;
  let lastStampAt = 0;
  let inFlight                                      = null;
  /**
   * 计费字符（进程级，不随克隆记录走）。
   *
   * 为什么值得单独记：MiniMax 每合成一次都会回一个 `billedChars`，而它以前**被丢掉**
   * （`onUsed` 收了参数没人用）—— 于是「这一档到底花了多少」在界面上没有任何答案，
   * 用户能看到的只有「静音不停合成」这行小字。
   */
  let billedCharsTotal = 0;
  let lastBilledChars                    ;

  const record = () => cloneRecordOf(state);

  /**
   * 用户钉住的音色（设置里的 `minimaxVoiceId` / `minimaxBaseUrl`）。
   *
   * **同步**是必须的：`voice()` 与 `readout()` 都是同步接口，而它俩正是
   * `available()`（同步活开关）的依据。所以这里只能读配置，不能 await 任何东西。
   *
   * 钉住的音色**不落 state**（配置是用户偏好、state 是机器状态），所以它的 host
   * 从哪来要分三种情况：用户钉了地址 → 用他钉的；没钉但落过一条记录 → 沿用那个
   * host（那是我们自己校验过的地址）；两样都没有 → `null`，等 `prepare()` 探出来。
   */
  function configuredVoice()                                                                        {
    let raw                                                = null;
    try {
      raw = opts.pin?.() ?? null;
    } catch (err) {
      log(`读钉住的音色配置失败：${errorMessage(err)}`);
      raw = null;
    }
    const voiceId = trimmed(raw?.voiceId);
    const baseUrl = trimmed(raw?.baseUrl);
    if (voiceId === undefined && baseUrl === undefined) return null;
    return {
      ...(voiceId === undefined ? {} : { voiceId }),
      ...(baseUrl === undefined ? {} : { baseUrl }),
    };
  }

  /** 这个音色是不是用户在设置里钉住的那个。 */
  function isConfiguredVoice(voiceId        )          {
    return configuredVoice()?.voiceId === voiceId;
  }

  /** 用户声明的请求形状（默认官方）。配置写错不该让语音整个失声，所以这里也兜一次。 */
  function declaredShape()                {
    try {
      return opts.shape?.() ?? DEFAULT_ENDPOINT_SHAPE;
    } catch (err) {
      log(`读请求形状失败：${errorMessage(err)}`);
      return DEFAULT_ENDPOINT_SHAPE;
    }
  }

  /**
   * **这个地址算不算官方** —— 判据就是 `opts.hosts` 那一份名单。
   *
   * 名单**默认是官方那两条**（`api.ts` 的 `MINIMAX_HOSTS` 就是它），所以插件的
   * 行为与"官方两条之外即第三方"完全一致；而测试/自建网关能通过传自己的名单来
   * 表明"我这些地址就是官方"，不必再注入第二个判断。
   *
   * 为什么不做成"官方两条之外一律第三方"：那样连测试里的假 host 都会被判成
   * 第三方、请求形状被悄悄改掉（2026-10-10 真被自己的测试拦过两次）。
   */
  function officialHosts()                    {
    return opts.hosts ?? MINIMAX_HOSTS;
  }

  /**
   * **这个地址上该用哪个形状** —— 地址说了算，配置那一格只是意愿。
   *
   * 为什么必须有这一步：填了中转站地址却把「接口形状」留在默认「官方原生」时，
   * 官方那条路径（`/v1/t2a_v2`）打在中转站上必然 404，而用户看到的是
   * "配置全对、每句都没声"。反过来（只填形状不填地址）会拿中转站路径去打官方，
   * 同样静默。归正一次，比让用户去猜哪一格没改要诚实得多。
   *
   * 形状被改掉时会**记一行日志**：两个人（用户与插件）对同一件事的判断不一致时，
   * 得有人写下来是谁让的步。
   */
  function shapeAt(host        )                {
    const declared = declaredShape();
    // 名单由宿主给出（默认官方那两条）。不在名单里就是第三方地址 —— 于是形状归正。
    const thirdParty = !officialHosts().includes(host);
    const resolved = shapeFor(host, declared, thirdParty, officialHosts());
    if (resolved.name !== declared.name) {
      log(`地址 ${host} 不是官方站点 —— 请求形状按「${resolved.name}」走（配置里写的是「${declared.name}」）`);
    }
    return resolved;
  }

  function readout()                      {
    const rec = record();
    /** 计费字符是**进程级**的事实（不属于某一条克隆记录），两条分支都要带上。 */
    const billing = {
      ...(lastBilledChars === undefined ? {} : { lastBilledChars }),
      ...(billedCharsTotal > 0 ? { billedCharsTotal } : {}),
    };
    const configured = configuredVoice();
    // ── 优先级的顺序就是"这一档现在到底能不能出声"的答案 ──────────────────
    //
    // 1) **有地址、有音色** → ready。地址可以是用户钉的，也可以是落盘那条记录里的
    //    host（我们自己探通过的事实）。钉住的音色在这里就算 ready，而不是等落盘 ——
    //    否则设置页会显示"还没认领到克隆音色"，`available()`（这一档的活开关）
    //    在第一次合成前为假，router 直接跳过 `synthesize()` 静默回落本地。
    // 2) 钉了音色但**两处都没有地址** → failed / `no_host`。这条不能落到 ready：
    //    `{phase:"ready", host:undefined, lastError:"no_host"}` 是个自相矛盾的读数
    //    （设置页照着 ready 渲染、合成却发不出去）。
    // 3) 有落盘记录 → ready。
    // 4) 其余按认领状态。
    if (configured !== null && configured.voiceId !== undefined) {
      const host = configured.baseUrl ?? rec?.host;
      if (host !== undefined) {
        return {
          phase: "ready",
          voiceId: configured.voiceId,
          host,
          ...(rec?.clonedAt === undefined ? {} : { clonedAt: rec.clonedAt }),
          ...(rec?.lastUsedAt === undefined ? {} : { lastUsedAt: rec.lastUsedAt }),
          ...billing,
        };
      }
      const stuck                      = { phase: "failed", ...billing };
      stuck.lastError = (transientError                                 ) ?? "no_host";
      return stuck;
    }
    if (rec !== null) {
      return {
        phase: "ready",
        voiceId: rec.voiceId,
        host: rec.host,
        clonedAt: rec.clonedAt,
        lastUsedAt: rec.lastUsedAt,
        ...billing,
      };
    }
    const cooling = adoptCoolingDown(state, now(), cooldownMs);
    const lastError = (state.adoptFailure                                 ) ?? transientError;
    const out                      = { phase: lastError === undefined ? "absent" : "failed", ...billing };
    if (lastError !== undefined) out.lastError = lastError;
    if (cooling && state.adoptAttemptAt !== undefined) {
      const at = Date.parse(state.adoptAttemptAt);
      if (Number.isFinite(at)) out.retryAt = new Date(at + cooldownMs).toISOString();
    }
    return out;
  }

  function emit()                      {
    const out = readout();
    try {
      opts.onChange?.(out);
    } catch (err) {
      // 回调坏掉不该影响认领本身。
      log(`onChange 抛错：${errorMessage(err)}`);
    }
    return out;
  }

  function persist(patch                           )       {
    state = { ...state, version: state.version || 1, ...patch };
    try {
      save(state);
    } catch (err) {
      log(`状态落盘失败：${errorMessage(err)}`);
    }
  }

  /** 记一次失败：**失败才写时间戳**（成功的尝试不需要冷却）。 */
  function fail(reason                   , options                         = {})                      {
    const cooldown = options.cooldown ?? true;
    log(`认领失败（${reason}）${cooldown ? `，${Math.round(cooldownMs / 60000)} 分钟内不再重试` : ""}`);
    if (cooldown) {
      persist({ adoptAttemptAt: new Date(now()).toISOString(), adoptFailure: reason });
    } else {
      transientError = reason;
    }
    return emit();
  }

  async function adopt()                               {
    const pin = configuredVoice();
    const existing = record();

    if (pin !== null && pin.voiceId !== undefined) {
      return adoptPinned(pin, existing);
    }

    if (existing !== null) return emit();

    if (adoptCoolingDown(state, now(), cooldownMs)) {
      log("在冷却期内，跳过这次认领");
      return emit();
    }

    let key                = null;
    try {
      key = await opts.key();
      if (key === null && opts.planKey !== undefined) key = await opts.planKey();
    } catch (err) {
      return fail("other");
    }
    if (key === null) {
      // 没填密钥不是"网络失败"：不该进冷却，否则用户填完还要等 10 分钟。
      log("没有 MiniMax 密钥，认领无从开始");
      transientError = "no_key";
      return emit();
    }

    transientError = undefined;
    try {
      // 控制面必须带截止时间：一个被接受却永不回话的连接会把认领永远挂住
      // （上游 2026-09-10 的教训）。probeEndpoint 自带 per-host 截止时间，
      // listClones 这里另套一条。超时的 reason 是 TimeoutError → 分类成 network。
      //
      // 地址从哪来：用户钉了就用他钉的（**不再去试官方** —— 他要的是那个网关，
      // 打不到就该报错，而不是偷偷回退到官方把整件事变得看不懂）；没钉才探。
      const host =
        pin?.baseUrl ??
        (await probeEndpoint(opts.fetch, declaredShape(), key, undefined, opts.hosts, MINIMAX_CONTROL_TIMEOUT_MS));
      const hostShape = shapeAt(host);
      // 只有官方形状才有"列账号克隆"这件事；第三方地址上没有它（也没有那条路径）。
      const clones = hostShape.supportsVoiceList
        ? await withDeadline(MINIMAX_CONTROL_TIMEOUT_MS, undefined, (signal) =>
            listClones(opts.fetch, host, key, signal),
          )
        : [];
      const mine = clones
        .filter((c) => isHertaVoiceId(c.voiceId))
        .map((c) => ({ voiceId: c.voiceId, createdMs: createdMs(c.createdTime, 0) }))
        .sort((a, b) => b.createdMs - a.createdMs);
      const newest = mine[0];
      if (newest === undefined) {
        // 账号上没有她的克隆 —— 而本插件不带克隆能力，所以这是终局失败（等冷却后再看）。
        return fail("no_clone_key");
      }
      // `undefined` 在 JSON.stringify 里会被丢掉 —— 所以"清掉上次的失败"只要把
      // 它设成 undefined 就够了，不需要额外的 delete。
      persist({
        voiceId: newest.voiceId,
        host,
        clonedAt: new Date(newest.createdMs || now()).toISOString(),
        adoptedTag: LEGACY_REFERENCE_TAG,
        adoptAttemptAt: new Date(now()).toISOString(),
        adoptFailure: undefined,
      });
      log(`已认领克隆 ${newest.voiceId}（${host}）`);
      return emit();
    } catch (err) {
      if (err instanceof MiniMaxError) {
        if (err.reason === "cancelled") {
          transientError = "cancelled";
          return emit();
        }
        return fail(err.reason);
      }
      log(`认领时未预期错误：${errorMessage(err)}`);
      return fail("other");
    }
  }

  /**
   * 用户钉住了音色 —— **不列克隆、不按 tag 过滤、不落 state**。
   *
   * 这条路存在的理由：`b1a43133` 那个 tag 是作者账号上那个克隆的标记，中转站用户
   * 不可能有（2026-10-10 那份 issue 的原话），所以"列出来筛 tag"对他们必然空集 ——
   * 而空集在这里是终局失败 `no_clone_key` + 10 分钟冷却。钉住的音色绕开的就是它。
   *
   * 三件事只做一次（`pinReady` 当闩锁）：探一次地址、确认音色**真的能用**、落一条记录。
   * 之后再问 `voice()` / `readout()` 就是纯计算 —— 不会每次合成又打一次网络。
   *
   * ⚠️ **要不要"确认音色真的能用"由形状说了算**（`canVerifyVoice`）：
   *   · 官方 —— 列一次克隆就知道这个 id 在不在；
   *   · 中转站 —— 它没有"列音色"这个接口，所以只能真发一次合成（一个字符）。
   *     代价是首用多一次调用，换来的是"音色 id 填错了"当场就能看出来，而不是等到
   *     正文合成失败、界面只给一句"被拒绝"。
   */
  async function adoptPinned(
    pin                                        ,
    existing                                          ,
  )                               {
    // 本进程内已经校验过、而且地址也定了（钉过，或者落盘那条记录里有）——不必再打网络。
    if (pinReady && voice() !== null) return emit();

    // **走不通的组合**：选了「中转站」形状、却没填地址，也没落过记录 ——
    // 中转站形状的路径（`/v1/tts/speech`）在官方那两条站点上不存在，探过去只会
    // 拿到 404，而 404 在 `probeShape` 里算"地址活着"（那是给中转站地址定的规矩）
    // —— 于是会"探通"一个根本发不出声的官方地址。直接说清楚缺哪一格。
    //
    // 注意**不能**把"只钉了音色"整个拦掉：那时形状多半还是官方的，走
    // `opts.hosts` 去试官方两条是**对的**（用户手填一个官方账号上的音色 id）。
    if (pin.baseUrl === undefined && existing === null && declaredShape().name !== DEFAULT_ENDPOINT_SHAPE.name) {
      log("选了中转站形状但没填地址：请在设置里填「MiniMax 地址」（中转站/网关地址）");
      transientError = "no_host";
      return emit();
    }

    if (adoptCoolingDown(state, now(), cooldownMs)) {
      log("在冷却期内，跳过这次校验");
      return emit();
    }

    let key                = null;
    try {
      key = await opts.key();
      if (key === null && opts.planKey !== undefined) key = await opts.planKey();
    } catch {
      return fail("other");
    }
    if (key === null) {
      log("没有 MiniMax 密钥，钉住的音色也用不了");
      transientError = "no_key";
      return emit();
    }
    transientError = undefined;

    try {
      // 地址从哪来，三种情况按"我们有多确信"排：
      //   1. 用户钉了地址 —— 用它；
      //   2. 上次认领/校验记过一条 —— 沿用那个 host（那是我们自己探通过的事实）；
      //   3. 都没有 —— 探出来（`probeEndpoint` 知道该用哪条路径去问）。
      const host =
        pin.baseUrl ??
        (existing === null ? undefined : existing.host) ??
        (await probeEndpoint(
          opts.fetch,
          declaredShape(),
          key,
          undefined,
          pin.baseUrl === undefined ? opts.hosts : [pin.baseUrl],
          MINIMAX_CONTROL_TIMEOUT_MS,
        ));

      // `canVerifyVoice` 为假时说"这次没验成" —— 那条路上 `verifyPinnedVoice`
      // 只在**明确失败**时才返回 false（"它没有这个接口"不算失败）。
      const verified = await verifyPinnedVoice(host, key, pin.voiceId          );
      if (!verified) {
        log(`钉住的音色 ${pin.voiceId} 这次没验成：地址通、但它没答出音频；照用，交给合成去报`);
      }
      // **落一条记录**：`voice()` 需要 `{voiceId, host}` 成对 —— 只记着音色的话，
      // 下次启动它会返回 null，于是 `available()` 为假、router 静默回落本地
      // （就是这份 issue 里"加了字段也不生效"的那个坑）。
      // 这不违反"配置不落 state"：落的是**地址**这条机器事实，音色照样每次从配置读
      // —— 用户改配置时 `configuredVoice()` 立刻盖过它。
      persist({
        voiceId: pin.voiceId,
        host,
        clonedAt: new Date(now()).toISOString(),
        adoptedTag: ADOPTED_PIN_TAG,
        adoptAttemptAt: new Date(now()).toISOString(),
        adoptFailure: undefined,
      });
      pinReady = true;
      log(`钉住的音色 ${pin.voiceId}（${host}）可用`);
      return emit();
    } catch (err) {
      if (err instanceof MiniMaxError) {
        if (err.reason === "cancelled") {
          transientError = "cancelled";
          return emit();
        }
        return fail(err.reason);
      }
      log(`校验钉住的音色时未预期错误：${errorMessage(err)}`);
      return fail("other");
    }
  }

  /**
   * 钉住的音色到底能不能用 —— **由形状决定怎么回答**（见 `endpoint.ts` 的
   * `canVerifyVoice`）：
   *
   *  · `true`（官方）—— 列一次克隆，看这个 id 在不在账号上。不在**不算致命**：
   *    上游允许"还没开口说过的克隆不列出"，所以照用，让合成去报真实原因；
   *  · `false`（中转站）—— 它没有"列音色"这个接口，只能**真合成一次**（一个字符）。
   *    返回 `false` 表示"地址通、但它没答出音频"，同样照用。
   *
   * 抛出（`MiniMaxError`）才代表这条配置根本走不通 —— 那时由调用方按 code 记失败。
   */
  async function verifyPinnedVoice(host        , key        , voiceId        )                   {
    // 形状**跟着地址定**（`shapeAt`）：官方那两条之外就没有 `/v1/get_voice` 这回事，
    // 拿它去问一个中转站必然 404 —— 而用户在设置里选了「中转站」形状之外还留着
    // 默认的「官方原生」时，正会走到这里。
    const hostShape = shapeAt(host);
    if (hostShape.supportsVoiceList) {
      const clones = await withDeadline(MINIMAX_CONTROL_TIMEOUT_MS, undefined, (signal) =>
        listClones(opts.fetch, host, key, signal),
      );
      return clones.some((c) => c.voiceId === voiceId);
    }
    const out = await withDeadline(MINIMAX_CONTROL_TIMEOUT_MS, undefined, (signal) =>
      synthesizePcm(opts.fetch, host, key, {
        voiceId,
        text: VERIFY_TEXT,
        shape: hostShape,
        signal,
      }),
    );
    // 判"有没有答出东西"按**字节**，不按样本数：中转站回的可能是奇数长度的裸
    // PCM（最后一个字节被丢掉），那也说明它是活的；而空体才是"它没答"。
    return out.samples.length > 0 || out.rawBytes > 0;
  }

  return {
    readout,

    /**
     * 现在能不能合成。
     *
     * 两条来源，顺序就是"我们有多确信"：**钉住的配置**优先（用户刚填的就是他想用的），
     * 其次才是落盘那条认领记录。前者让"中转站用户手填音色"在**第一次合成前**就为真 ——
     * 否则 `available()`（这一档的活开关）为假，router 会跳过 `synthesize()`
     * 静默回落本地，配置看起来毫无作用。
     */
    voice() {
      const configured = configuredVoice();
      if (configured !== null && configured.voiceId !== undefined) {
        const host = configured.baseUrl ?? record()?.host;
        // 地址还没定（用户只钉了音色、也没探过）——先返回 null，等 `prepare()` 探，
        // 免得拿一个猜出来的地址去打请求。
        return host === undefined ? null : { voiceId: configured.voiceId, host };
      }
      const rec = record();
      return rec === null ? null : { voiceId: rec.voiceId, host: rec.host };
    },

    prepare() {
      if (inFlight !== null) return inFlight;
      inFlight = adopt().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },

    reset() {
      log("已清掉克隆记录（等待重新认领）");
      transientError = undefined;
      pinReady = false;
      persist({
        voiceId: undefined,
        host: undefined,
        clonedAt: undefined,
        lastUsedAt: undefined,
        adoptedTag: undefined,
        adoptAttemptAt: undefined,
        adoptFailure: undefined,
      });
      return emit();
    },

    markMissing(voiceId) {
      const rec = record();
      if (rec === null || rec.voiceId !== voiceId) return;
      // 用户自己钉的音色**不许被后台抹掉**。原先这里无条件清 `voiceId`，症状是
      // "配好的音色过一会儿又没声了"（那份 issue 专门点了这一条）。钉住的配置本来
      // 就不该走服务端那套"消失了就重认领"的循环 —— 它到底对不对，由合成自己报。
      if (isConfiguredVoice(voiceId)) {
        log(`服务端说音色 ${voiceId} 已不存在，但它是你在设置里钉住的 —— 保留配置，原因交给合成报`);
        persist({ adoptFailure: "voice_missing", adoptAttemptAt: new Date(now()).toISOString() });
        emit();
        return;
      }
      log(`服务端说克隆 ${voiceId} 已不存在 —— 本插件不带克隆能力，转由宿主回落`);
      // 清记录 + 写冷却：冷却到期后会再列一次（若你在独立版里重新克隆过，就能捡回来）。
      persist({
        voiceId: undefined,
        host: undefined,
        clonedAt: undefined,
        lastUsedAt: undefined,
        adoptedTag: undefined,
        adoptAttemptAt: new Date(now()).toISOString(),
        adoptFailure: "voice_missing",
      });
      emit();
    },

    /**
     * 记账：这一单元花了多少**计费字符**（MiniMax 自己报的数，2026-09-30 起真的收下）。
     *
     * **累计在节流之前、也在 `rec === null` 早退之前**：节流是为了少写盘、
     * 认领记录缺失是另一件事，而**钱是按次花的** —— 不能因为「同一秒内第二次」
     * 或者「记录刚被删」就不计这笔账。
     */
    stampUsed(billedChars = 0) {
      if (Number.isFinite(billedChars) && billedChars > 0) {
        billedCharsTotal += billedChars;
        lastBilledChars = billedChars;
      }
      const rec = record();
      if (rec === null) return;
      const at = now();
      if (at - lastStampAt < stampThrottleMs) return;
      lastStampAt = at;
      persist({ lastUsedAt: new Date(at).toISOString() });
    },
  };
}


//# sourceURL=voice.ts
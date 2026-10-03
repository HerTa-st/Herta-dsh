# adapter 给 code，文案在边界拼一次

每一档合成器（adapter）失败时报的是**机器可读的 code**（`no_key` / `network` / `refused` /
`local_failed` / `not_wired` / `other`），不是给用户看的中文。中文只在**边界**拼一次：
宿主侧的 `reasonText`（把 code 变成「Fish Audio 连不上」这种话），以及客户端状态行。

共同形状：`synthesize(req) → { audio: SynthesizedAudio | null, name, code }`。

**为什么要包一层**：更早的形状是 `SynthesizedAudio | null` —— `null` 同时表示「失败」与
「没有音频」，于是**原因没地方放**，只能塞进 `mini.engineNote` 那个可变字段。结果是
原因与产生它的代码分居两处（23 处读写散在宿主、管线、客户端、fish 四个文件里），
而「谁该读它」也没有答案。

**后果**：

- `audio: null` 与 `code` 各说各的：失败一定有原因，成功一定没有；
- 每档另有可选的 `status()`，放**原始细节**（`fish` 放 `keyPresent` 与 `reason` 原文、
  `minimax` 放 `synthesizer.status()` 与 describe 的原文）—— 给人看的长句子从这里取；
- 「云端失败 + 兜底也失败」由 router 用 `a+b` 表达（两个 code 拼起来），边界翻译成
  「MiniMax 不可用；本地兜底也不可用：…」；
- 加一档时，只需在 `SYNTH_CODES` 想清楚它失败时归哪个 code，文案不用你管。

这条与 ADR-0003（产物只经构建）无关，但同样是**边界纪律**：一处拼文案，别处只用 code。

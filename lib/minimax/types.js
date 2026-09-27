/**
 * DSH 宿主侧的语音接口形状 —— 与 Herta 上游 `app-server/src/types.ts` 对齐。
 *
 * ## 为什么这三个类型要单独一个文件
 *
 * 它们是**移植件与宿主布线之间的契约**：`synthesizer.ts` / `voice.ts` 实现它，
 * 宿主（`index.js`）与 SSE 端点消费它。把契约单独放，是为了让"上游换了形状"
 * 这件事只在这里改一次，而不是散在合成器与端点两处各改一遍。
 *
 * ## 与上游逐字对齐的三条语义（不要"顺手改成更合理的"）
 *
 *  1. `synthesize()` **失败与被取消都 resolve `null`**，不抛异常 —— 该单元退化成
 *     打字节奏继续推进，而不是把整段回复卡住。
 *  2. `available()` 是**活开关**：每次流起点都要重新问一次（密钥可能刚填上、
 *     克隆可能刚被删），不要在启动时求值一次就缓存。
 *  3. `cancel(utteranceId)` 只丢弃**该 utterance** 的排队与在飞请求；在飞的原生
 *     合成允许跑完，但结果被丢掉。取消**不用异常表达**给调用方。
 */

/** 一单元的合成请求。`text` 是**已经切好**的单元（切分见 `segment.ts`）。 */
                                   
                                                 
                               
                            
                       
                        
                             
                                    
                            
 

/** 合成结果：单声道 16 bit PCM。 */
                                   
                               
                              
                              
 

/** 合成器的对外契约。 */
                                    
                       
                                                                      
                                    
 

/** 上游 `@herta/core` 的 `errorMessage`（移植件里就这一处要它，不引整包）。 */
export function errorMessage(err         )         {
  return err instanceof Error ? err.message : String(err);
}


//# sourceURL=types.ts
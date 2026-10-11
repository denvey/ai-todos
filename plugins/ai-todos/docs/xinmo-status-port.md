# 心魔状态迁移对照

来源：Xinmo Desktop 的 `src/lib/execution-board.ts`、`src/views/ExecutionView.tsx` 和 `src/types.ts`。迁移后的共享归类函数位于 `ui/execution-board.ts`，运行状态与文案位于 `src/runtime.ts`。适配本地字段：`workflowState → task.state`、`runtimeForTask → task.ai`、`sessionId → session.id`；不持久化看板列。

## 任务阶段

| 心魔阶段 | 显示 | 看板默认归类 |
| --- | --- | --- |
| defining | 需补充要求 | 未开始 |
| ready | 可以开始 | 未开始 |
| executing | AI 执行中；未关联 AI 时为执行中 | 进行中，按真实运行状态调整 |
| awaiting_acceptance | 待我验收 | 需要你处理 |
| changes_requested | 需修改 | 未开始 |
| accepted | 验收通过；看板显示已完成 | 已完成 |
| cancelled | 已取消 | 独立取消记录 |

心魔原交付文案为“等待验收”，这里按用户要求使用“待我验收”。停止执行不会把任务改成待验收；必须提交真实交付证据。所有人工验收沿用已有版本校验与审阅入口。

## AI 运行状态

| 状态 | 执行文案 | 规划文案 | 会话看板归类 |
| --- | --- | --- | --- |
| queued | 等待执行 | 等待规划 | 进行中 |
| running | 正在执行 | 正在规划 | 进行中 |
| waiting_approval | 等待审批 | 规划等待审批 | 需要你处理 |
| waiting_input | 等待输入 | 规划等待输入 | 需要你处理 |
| failed | 执行失败 | 规划失败 | 需要你处理 |
| idle / completed | 待确定 | 待确定 | 未确认时需要你处理，确认后已完成 |
| interrupted | 已中断 | 规划已中断 | 其他会话；关联执行任务回到可以开始 |
| unknown | 状态未确认 | 状态未确认 | 其他会话；关联执行任务需要你处理 |

官方接口分别识别 `waitingOnApproval`、`waitingOnUserInput`，`systemError` 显示执行失败。已有本地 `waiting`、`ended` 记录分别按 `waiting_approval`、`completed` 读取，无需改写历史数据。可信 PermissionRequest 记录等待审批；Stop 记录 idle；SessionEnd 记录 completed。

共享宿主接口通过 WebSocket 握手连接。桌面会话在独立 daemon 中返回 notLoaded 时，仅对最近五分钟更新的会话读取官方日志的生命周期元信息，并核对 session ID；task_started、task_complete、turn_aborted 分别补齐 running、idle、interrupted。观察沿用日志实际活动时间，不靠目录轮询延长历史运行状态；更新的 hooks 和同轮等待审批／输入优先保留。日志缺失或无法读取时继续保持未知。

规划标签仅用于真实 `mode=planning`，不会从任务标题或停止事件猜测。心魔的 hooks 同样不提供规划模式；规划／排队信息原本由其 Codex 控制器提供。当前本地插件保留所有这些状态的展示与归类规则，收到对应状态才显示。

## 迁移的交互

- 已关联任务的真实等待、失败、结束状态参与归类；交付阶段仍保留并显示，不自动提交或验收。
- 待我验收提供审阅与退回修改；拖回未开始打开人工退回审阅，不直接修改验收状态。
- 等待输入／审批的会话提供回原会话处理。当前同步接口不返回心魔控制器的待审批请求对象，使用原 Codex 会话处理真实请求。
- 未关联业务任务的结束会话可以点击确认完成，或拖到已完成；两者校验同一观察版本与全部任务的关联关系。
- 已验收任务继续运行时，新的会话活动仍显示；只隐藏已被任务卡片或验收时间实际覆盖的会话状态。
- 完成的任务与确认过的会话合并排序，默认显示最近 5 项，支持展开历史。
- 顶部会话统计与看板列复用同一归类函数；状态未确认或已中断的会话不显示在任务看板中，也不计入看板总数或未开始任务。同步提示中的目录总数包含历史会话。

心魔另有归属分类状态（未分类、分类中、已分类、待确认归属、分类失败）和控制器连接状态，它们不是交付或 AI 运行状态。当前 AI 建议仍需人在预览中应用；没有凭空创建归属分类或控制器连接记录。

# 心魔组件复用

本次采用心魔 Xinmo Desktop 已有的 React 组件，不再维护字符串 HTML 模板和全局 DOM 事件实现。源文件来自 ClawMate checkout 的 `apps/xinmo-desktop/src/`，仅只读提取；运行包包含全部代码与样式，没有跨仓绝对路径依赖。

| ai-todos 文件 | 心魔来源 | 复用与适配 |
| --- | --- | --- |
| `ui/components/FormControls.tsx` | `components/FormControls.tsx` | 直接复用 SelectControl、SelectField、DatePickerField、日期辅助函数；日期组件增加 `type="datetime-local"`，复用同一日历弹层选择日期和时间；移除未使用的 NumberStepperField |
| `ui/components/ExecutionView.tsx` | `views/ExecutionView.tsx`、`lib/execution-board.ts` | 四列、折叠卡片、完成历史、甘特布局与指针交互结构；改用本项目 task 字段、revision 和回调 |
| `ui/components/TaskEditor.tsx` | `components/TaskEditor.tsx` | 执行定义、分段优先级、排期与归属、AI 会话区域、AI 建议对照预览；保留本项目字符串验收标准和审阅边界 |
| `ui/components/GoalsView.tsx` | `views/GoalsView.tsx` | 折叠目标、进度环、KR 树；数值使用本项目 baseline/current/target，不引入不存在的权重字段 |
| `ui/components/FocusCard.tsx` | `components/FocusCard.tsx` | 空闲时紧凑一行、运行时计时与暂停／恢复／结束控制；使用持久化累计时间，不引入番茄阶段或倒计时 |
| `ui/components/TodayView.tsx` | `views/TodayView.tsx`、`components/QuickCapture.tsx`、`components/TaskRow.tsx`、`components/TaskEditor.tsx` 的 DailyPlanEditor | 今日进度、快捷输入、四按钮、Enter／Alt+Enter、AI 完善与拆分、今日列表、专注、待办池选择、全部加入／清空、结束分组、备注；接独立任务与计划事务 |
| `ui/components/InboxView.tsx` | `components/InboxDrawer.tsx` | 捕获、折叠、搜索、整理筛选、AI 预览、提升任务／加入今天、归档恢复；原始想法随提升后的任务保留 |
| `ui/xinmo.css` | `styles/components.css`、`styles/execution.css`、`styles/views.css` | 提取上述组件的相关规则；`ui/style.css` 映射宿主颜色、字体、圆角，补充窄面板与对话框定位 |

## 运行边界

- React、Radix、lucide-react 和 react-day-picker 由 esbuild 捆绑进单个 `dist/app.html`；运行时不加载 CDN，不执行 npm。
- Radix Dialog 提供焦点约束和 Escape 关闭；按用户反馈改为居中弹窗，四周保留间距，最大高度为视口的 80%。Dialog/Popover/Select 选用共享弹层与焦点依赖的版本，避免独立弹层上下文引起点击穿透。
- 看板沿用 `execution.css` 的视口高度、纵向 flex 和列内滚动约束，适配本项目 `.main`；空看板不再叠加第二个新建任务入口。已取消列表展开后限制高度并独立滚动。
- 任务弹窗使用心魔的 520px 宽度和紧凑字段尺寸；各表单正文独立滚动，标题与操作栏留在可视区域。排期、任务详情和历史按内容高度排列，避免被网格压缩裁切。
- 浏览器继续通过 cookie、CSRF 与同源 HTTP API 访问独立服务；嵌入界面继续使用 ext-apps bridge 与宿主主题 helpers。
- 不导入心魔 backend、Tauri API、飞书、桌面控制器、桌宠或番茄调度。所有状态转换、审阅 ticket、数据验证和计时持久化仍由 `src/domain.ts`、`src/server.ts` 提供。
- AI 完善复用心魔按钮和建议预览结构，后端改接独立 Codex CLI。标题旁的 AI 入口完善整份定义，说明与验收标准旁的入口根据当前草稿单独优化对应字段；所有建议先预览，应用只改表单，保存才持久化。既有无 `field` 的 `refine` 调用仍返回说明与验收标准。项目通过 Codex app-server 的 `project/list` 同步，不依赖心魔进程。
- 今天与收件箱切换保留输入及本地 AI 预览；完整任务入口带入快捷草稿，保存成功才清空。拆分创建与加入计划共用一个事务与幂等请求，收件箱提升也在同一事务内完成。安排今天读取全部当天计划的 revision，拒绝过期保存；编辑任务详情后返回仍保留尚未保存的勾选和备注。
- 主导航收拢为首页、任务、项目、OKR，设置位于右侧。首页复用今日任务和专注计时，直接展示投入统计并保留可展开的时间明细与任务选择；收件箱从今日任务区进入，每日计划从首页操作区进入，提醒配置与记录放在设置页。复用原有数据和操作，不新增持久化字段。
- 本次迁移截图中的文字录入流程；心魔图片附件、⌘/Ctrl+Enter 直接启动 Codex、后台归类、飞书与原生计时不在本轮范围。任务归属、状态和删除使用已有详情，今日圆形按钮打开交付／人工审阅或重开任务，不绕过验收。
- 人工审阅必须展示实际版本、标准和证据，并要求填写审阅人与明确确认。MCP 面板仍打开本地审阅页，模型没有验收工具。

这些是心魔的 React Web 组件；ext-apps 不提供 Codex 原生控件，也不能通过样式新增原生侧栏入口。

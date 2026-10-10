# 宿主支持与交付证据

核实日期：2026-10-10。运行环境：macOS，Node.js `24.15.0`；当前 Codex 桌面客户端提供内置浏览器。结论严格区分协议实现、工具协议检查和实际宿主渲染。

## 官方证据

- [Plugin Extensions](https://developers.openai.com/plugins/build/extensions)：声明 `_meta.ui.resourceUri`；`_meta["openai/ui"].entrypoints` 中 `global` 打开侧边栏应用，`thread` 打开对话旁面板。该页面以 ChatGPT 体验描述这些扩展，没有明确保证当前 Codex 本地 STDIO 插件的入口发现能力。
- [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)：MCP Apps 资源与 `ui/*` bridge，`tools/call` 调用，`ui/message`，建议按能力检测并保留无 UI 的工具路径。
- [Package your plugin](https://developers.openai.com/plugins/build/plugins)：根 `plugin.json`、`mcp.json` 与 `skills/`；OpenAI 元数据在 `extensions.com.openai`，兼容 `.codex-plugin/plugin.json`；本地 marketplace、CLI 安装、手动安装桌面插件的 hooks 和 hook 信任规则。
- [Plugins](https://learn.chatgpt.com/docs/plugins)：Codex 支持插件、技能、MCP 和可选 UI；新会话加载已安装能力。并未承诺本地插件入口在所有客户端、账户或版本可用。
- [MCP](https://learn.chatgpt.com/docs/extend/mcp)：Codex 支持本地 STDIO 和 Streamable HTTP 配置；本项目采用 STDIO。
- [Hooks](https://learn.chatgpt.com/docs/hooks)：`session_id` 是宿主事件可信来源；UserPromptSubmit、PreToolUse、PostToolUse、PermissionRequest、Stop、Interrupt、SessionEnd 等生命周期。插件 hooks 在用户审阅信任前跳过；云编排 Work 不支持本地插件 command hooks。
- [Plugin UI changelog](https://developers.openai.com/plugins/changelog)：2026-05-28 条目说明 ChatGPT 通过 `hostContext.styles.variables` 提供标准宿主样式，并在主题变化时发送 host-context-changed。本项目使用已安装 ext-apps SDK 的主题、样式和字体 helpers，按宿主实际提供的值应用。

没有通过普通 sidebar section 冒充应用，没有注册远程 MCP、使用他人连接 ID 或尝试绕过宿主限制。

## 已实现与实际检查

| 路径／能力 | 实现 | 本机检查证据 |
| --- | --- | --- |
| 插件包装与安装 | 完成 | `npm run package:plugin` 成功；`codex plugin marketplace add <repo>` 和 `codex plugin add ai-todos@ai-todos-local --json` 成功，安装到本机插件缓存 |
| 独立本地应用 | 完成 | `http://127.0.0.1:16943` 在 Codex 内置浏览器实际加载，无需任何心魔进程 |
| MCP 工具 | 完成 | MCP SDK Client 连接真实 STDIO 服务，调用 open / snapshot / task / manage；也运行打包入口，读到同一持久化任务 |
| MCP Apps UI 资源 | 完成 | resources/list、resources/read 返回 `ui://ai-todos/app.html`，MIME `text/html;profile=mcp-app`；UI 使用官方 ext-apps SDK，完整资源内嵌依赖 |
| 面板布局与宿主样式 | 完成接入 | 八个顶部页签，React 复用心魔组件；Radix 下拉框和中文日历在内置浏览器实际打开。此前 480px 页面无横向溢出，无 error / warn。真实 Codex iframe 主题初始化与变更通知仍未验证 |
| `global` / `thread` | 元数据已实现 | 工具列表检查确实返回两种 entrypoint；当前会话未重新加载新安装插件，原生入口发现和 iframe 渲染**未验证** |
| 会话观察 hooks | 完成 | 正式事件结构通过 hook 脚本写入隔离数据库；绑定与 Stop 不推进业务状态检查通过。真实客户端事件、用户信任后的 hook 执行**未验证** |
| AI 发起执行 | 完成指令路径 | 浏览器复制指令；MCP App 用户点击 `ui/message`。实际宿主 `ui/message`、当前对话匹配和真实 AI 执行**未验证**，未猜测会话标识 |
| 人工审阅 | 完成 | HTTP fixture 检查退回、一次性 ticket 与旧版本拒绝；界面实际打开显示 r6、标准、证据和未勾选确认框。未将界面检查冒充用户验收 |
| 看板、甘特图 | 完成 | 隔离真实数据库创建任务；拖动将起止时间后移一天，拖右边缘延长结束一天；重载与详情显示保存值 |
| 项目、OKR、计划 | 完成 | 界面创建项目、目标、KR 和计划；计划引用同一任务，推进后显示执行中 |
| Codex 项目同步 | 完成 | 实际 `project/list` 读到 20 个目录；首次同步新增 20 个，再次新增和更新均为 0；项目页显示来源和目录。临时数据库检查改名保留本地说明、任务引用和版本冲突 |
| AI 完善定义 | 完成 | 独立 Codex app-server 临时会话返回真实结构化说明和验收标准；浏览器中的组合商品报价草稿显示建议对照预览。生成不保存任务，不绑定会话，不推进状态 |
| 今日快捷录入与收件箱 | 完成文字流程 | Enter 加今日、Alt+Enter 存收件箱、完整任务带入草稿、取消与页面切换保留输入、保存成功清空、归档恢复与提升加入今天均在隔离页面实际完成；真实 Codex 返回两项拆分，任务说明和验收标准随创建保存 |
| 安排今天 | 完成 | 全部加入、勾选取消、备注保存；打开任务详情再返回保留选择与备注；外部更新后界面拒绝旧计划且保留草稿。临时 SQLite assert 检查同日多计划合并、创建幂等、批量失败回滚及原始想法保留；打包 MCP 的批量创建／计划保存返回对象检查通过 |
| 专注、时间统计 | 完成 | 界面开始／暂停、重载保留暂停、恢复／结束保存一条记录；自动检查验证数据库重开后恢复与暂停排除 |
| 监督调度 | 完成 | 自动检查到期提醒、跟进与复盘，重复 tick 不生成重复提醒；未验证真实长时间待机、OS 通知权限及退出 Codex 后的 OS 行为 |

初版 `npm run check`：6 个检查通过，0 失败。初版浏览器初始及完整界面操作后均没有 error / warn；界面操作检查在单独数据目录及端口进行，不写入日常数据库。另检查 480px 宽布局以模拟会话面板，并恢复浏览器尺寸。数据层验收输入是明确命名的测试 fixture，未记录用户对本次开发工作的认可。后续迁移按下方记录检查，没有重跑完整套件。

## 当前交付入口与边界

插件已安装，本地应用已可在内置浏览器使用。**不把协议元数据和安装成功报告为“Codex 左侧 ai-todos 原生入口已完成”。** 检查当前原生客户端时，Computer Use 明确拒绝访问 `com.openai.codex`，因此未绕过该限制或声称原生入口可用／不可用。需要用户在方便时开启新会话／重启，审阅信任 hooks 后检查原生入口；该动作会影响正在进行的会话，未由开发过程擅自执行。

当前页面的顶部功能导航属于插件 React Web UI。复用心魔的 Radix/DayPicker 控件和组件布局，样式优先消费宿主 tokens，缺失时使用中性系统样式；这不会将组件变成 Codex 原生组件，也不会新增原生侧栏入口。首次组件迁移阶段修改了 UI、构建依赖与说明，未改数据服务，未重跑业务测试。

看板使用心魔的四列和折叠卡片布局，业务状态与 AI 观察状态独立展示。控件已迁移到心魔的 React/Radix 实现；Radix Dialog、Select、Popover 共用同版弹层与焦点依赖，修复了版本不一致造成的日历点击穿透。具体来源与适配见 [ui-reuse.md](ui-reuse.md)。

本轮浏览器检查使用隔离目录和端口 16944，未写入日常数据库：项目筛选、任务创建与编辑、中文日历选择和具体时间保存、时间线键盘移动一天与右边缘延长一天、专注开始／暂停／重载／继续／结束、计划引用任务保存、KR 从 2 更新为 3 并显示 60% 均实际完成。人工审阅页打开了真实 fixture 的 r4、标准和证据，切换退回决定，确认框仍未勾选；未记录用户验收。提醒配置表单打开正常。480px 下四组按两列排列，页面宽度和 scrollWidth 均为 480px；无可见原生 select，无 error / warn。本轮未检查真实 MCP iframe、可信 hooks 或原生入口。

用户截图反馈后的布局修复：补齐看板父容器的视口高度与 flex 规则，移除重复空状态；任务抽屉恢复 520px 宽度，正文与固定操作栏分开，修复展开排期被网格压缩的问题。隔离页面 1280×720 下展开排期后正文 clientHeight 568px、scrollHeight 905px，实际滚动到底仍显示创建按钮；480×560 下页面 scrollWidth 为 480px，四列按 2×2 占用剩余高度，任务抽屉操作栏留在视口内；700×480 下计划正文滚动且保存按钮可见，看板没有页面级横向溢出。任务详情的生成指令按钮打开指令页；人工审阅的版本、证据与未勾选确认框仍显示。控制台无 error / warn；未重跑业务测试套件。日常页面保留用户未保存的输入，使用隔离页面进行布局检查。

本次 AI 与项目补齐新增受既有同源／CSRF／内部 Bearer 保护的 Codex API，以及仅对 app 可见的 MCP 工具。实际 SDK Client 检查 `action` 的完整 schema、app visibility 和打包入口同步成功；临时数据库检查创建幂等、任务更新、设为就绪、同步去重、项目改名与旧 revision 拒绝。已重新打包并安装，日常服务的 HTML 与安装缓存和最终构建一致。日常数据库仅同步了 Codex 项目，用户草稿保留在表单中，没有保存或验收。此前完整业务测试记录保持原有范围，本次未重跑完整套件，也未验证旧版／未登录 CLI、真实 MCP iframe 或原生侧栏入口。

若客户端不显示 `global` / `thread` 或不渲染本地 MCP Apps，继续使用内置浏览器／普通浏览器完整应用以及 STDIO 数据工具。人工验收始终通过本地页面，避免向模型开放一个可以自行验收的工具。系统通知只在本地页面打开且权限允许时发出，后台提醒保存到收件箱；服务停止期间不能执行提醒或唤醒 AI。

本次今日交互迁移增加独立 inbox 实体，复用现有 SQLite 实体表、CRUD 校验和事务，无 SQL migration；只有提升确认后才创建任务，并保留原始想法。当天已有多个计划不删除、不覆盖名称；新增成员和今日备注进入稳定排序的首个计划。AI 快捷完善使用独立的 capture_refine 输出契约，复用原 Codex 生成服务，原编辑器 refine 契约保持不变。实际页面与临时数据库检查使用 16944，日常数据未新增测试任务。已重新打包安装并启动 16943，旧页面未刷新，组合商品草稿的输入值仍保留。图片粘贴和 ⌘/Ctrl+Enter 直接启动执行尚未迁移，真实 MCP iframe／原生入口与完整套件未重验。

未发布 npm、未部署 NAS、未操作其他源码仓库。未加入桌宠、截图监督、菜单栏、全局快捷键、云端同步或心魔集成。

用户于 2026-10-10 提供截图，确认已安装 ai-todos 的原生侧边栏入口及全屏工作台实际可用。该证据适用于用户当前客户端，不代表所有客户端版本。插件 interface 已补充 composerIcon 和 logo，图标为透明背景的任务勾选框。

Codex 会话同步迁移：参考心魔 execution-board.ts 和 AiSessionCard，将未关联业务任务的会话作为独立卡片显示，业务状态不被运行状态覆盖。使用官方 app-server thread/list 完整分页、排除子代理及临时会话，按 ID 更新；任务关联认可官方同步 ID。当前默认宿主 control socket 不存在，proxy 连接失败，已使用隔离 STDIO app-server 成功同步 2,198 个未归档主会话，均为 notLoaded / 未知，未伪造运行或完成状态。同步不读取完整对话或触发 turn/start。每列分批渲染 50 个；自动刷新与手动同步共享当前页面请求。实际宿主代理在线路径和原会话深链接跳转仍待客户端验证。

会话同步实际界面记录：本地工作台任务页显示 0 项业务任务 / 2,198 个 Codex 会话；搜索 ai-todos 后显示 1 个匹配会话。第二次官方同步新增 0、更新 5，业务任务数量不变。已完成构建，未重跑完整业务套件。

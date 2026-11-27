# 变更记录

## 2.2.1 — 2026-11-27

### [2026-11-27 19:15:00] fix: 全面安全加固与热更新稳定性修复（修复 Codex 全量审查 21 项问题）

- 变更：
  1. **高危安全底线加固**：
     - 更新链路引入 Ed25519 发布清单公钥验签（`src/main/update-verify.js`、`scripts/make-hot-patch.mjs`）、GitHub Releases HTTPS 来源白名单、强制 64 位 SHA-256 校验与安装包启动前二次核验；
     - 自动填充严格限制为受信任 HTTPS 域名逐帧校验与完整登录表单特征，拦截 `will-redirect` 外部跳转；
     - 远端视图摄像头/麦克风权限申请与检查均绑定受信 HTTPS 来源与媒体类型；
     - 密码加密（`src/main/crypto.js`）取消静默降级明文 Base64，加密不可用时明确拒绝保存并支持历史记录自动迁移；
     - 集中校验高权限 IPC 发送方为主窗口本地壳主框架、站点 IPC 为受信帧来源，统一限制 `shell.openExternal` 为安全协议白名单（`https:`/`http:`/`mailto:`）。
  2. **热更新、并发与数据落盘可靠性**：
     - 热补丁改为下载暂存至唯一不可变目录，点击重启生效时才原子切换 `active.json` 并保留 `previous` 上一版本；支持清单版本/补丁版本/包内 `package.json` 三方一致校验、解压 32MB 防炸弹上限及全量包自动回退；
     - 引导器单实例锁前置（避免第二实例消耗试运行次数）并改为渲染进程版本绑定握手确认启动；
     - 全链路下载超时与流式体积上限、安装包 `stream.pipeline` 背压写盘；
     - 会话 Cookie 仅限受信域且保留 `hostOnly` 属性，与清除登录态共用串行队列消除竞态；
     - 自动填充与弹窗引入任务代次防覆盖、多企业账号改 `(cno, account)` 复合键与登录后确认落盘；
     - 图片另存为补齐网络流式 / `data:` / `blob:` 50MB 上限；账号与设置写盘失败不提交内存缓存并真实提示；托盘不可用时点关闭不再隐藏窗口失联。
  3. **体验与工具脚本收尾**：
     - 分离已就绪更新与后台检查状态，网络波动不再隐藏更新入口，合法新清单支持撤回/换摘要刷新；
     - 内存清理主进程合并并发请求并透传真实成功/部分失败状态；
     - 修复 `scripts/changelog-add.mjs` 兼容 CRLF 与缺失「未发布」区块，修复 `scripts/png_tool.py` 拒绝 Adam7 交错图，移除 `scripts/check-syntax.mjs` 旧 100 行硬限制。
- 原因：落实 Codex 深度静态安全审查检出的全部 21 项问题及回归复审发现，消除安全隐患与并发竞态并推送热更新。
- 文件：`src/main/*`、`src/preload.js`、`src/renderer/*`、`scripts/make-hot-patch.mjs`、`scripts/check-syntax.mjs`、`scripts/changelog-add.mjs`、`scripts/png_tool.py`、`tests/core.test.mjs`、`tests/updater.test.mjs`、`package.json`、`CHANGELOG.md`
- 验证：`npm run check`（59 个源码文件通过）、`npm test`（8/8 通过）、Codex 回归复审修复闭环、`npm run patch` 签名验证通过。

---

## 2.2.0 — 2026-11-26

### [2026-11-26 17:55:00] feat: 新增后台自动推送与秒级热更新系统（含防崩溃回滚与流式全量兜底）

- 变更：
  1. **热更新引导与防崩溃回滚**（`src/main/boot.js`）：主入口升级为轻量引导器，启动时自动加载已激活的高版本本地热更包；若连续 2 次启动未能正常渲染主窗口则自动回滚至内置版本；安装新版 `.exe` 后自动清理旧热更残留。
  2. **双层后台静默更新引擎**（`src/main/updater.js`、`src/main/hot-apply.js`、`src/main/update-download.js`、`src/main/semver.js`）：
     - 启动 15 秒后及每 4 小时自动检查 GitHub Releases `update-manifest.json`（定时器全托管，退出即清理）；
     - 常规 UI/脚本更新自动后台拉取 ~25 KB `hot-patch.json.gz`，严格校验 SHA-256 与白名单相对路径（拦截路径穿越），原子替换并自动清理旧版本；
     - Electron 内核升级场景自动流式下载全量 `.exe`（避免大缓冲占内存）并校验 SHA-256。
  3. **前端与托盘交互**（`src/renderer/updater-ui.js`、`src/index.html`）：标题栏在更新就绪时显示渐变胶囊「↑ 热更 vX.Y.Z · 重启生效」，设置菜单新增「后台自动推送与热更新」开关及「检查更新…」入口，托盘菜单同步新增「检查更新」。
  4. **热补丁打包脚本与自动化测试**（`scripts/make-hot-patch.mjs`、`tests/updater.test.mjs`）：一键生成 `hot-patch-*.json.gz`、`update-manifest.json` 与 `SHA256SUMS.txt`，补充 SemVer、SHA-256 篡改拒绝与路径穿越拦截单元测试。
- 原因：免除后续版本更新每次手动重新下载安装包的麻烦，实现后台静默推送与 1 秒热更新生效。
- 文件：`src/main/boot.js`、`src/main/semver.js`、`src/main/hot-apply.js`、`src/main/update-download.js`、`src/main/updater.js`、`src/renderer/updater-ui.js`、`scripts/make-hot-patch.mjs`、`tests/updater.test.mjs`、`src/main/config.js`、`src/main/store.js`、`src/main/window.js`、`src/main/index.js`、`src/main/ipc.js`、`src/main/tray-menu.js`、`src/preload.js`、`src/index.html`、`src/styles/titlebar-controls.css`、`src/renderer/settings.js`、`src/renderer/app.js`、`package.json`
- 验证：`npm run check`、`npm test`（7/7 通过）、v2.2.0 打包态实机冒烟测试与热更清单发布核验通过。

---

## 2.1.0 — 2026-11-26

### [2026-11-26 17:25:00] style: 全新极光渐变立体桌面图标 + 全局更名为「客服在线平台」

- 变更：
  1. **全新高精度桌面图标**：新增矢量源文件 `assets/icon-master.svg` 与 Electron 离屏渲染脚本 `scripts/render-icon.js`，采用青翠极光渐变圆角方框 + 柔光磨砂对话气泡 + 立体白玉耳麦 + 悬浮在线状态珠，并生成含 256/128/64/48/32/16 六种清晰分辨率的 `assets/icon-v2.ico` 与 `assets/icon-v2.png`。
  2. **品牌与名称统一为「客服在线平台」**：同步更新应用标题、标题栏品牌名、托盘提示与菜单、桌面快捷方式名称、NSIS 安装向导名称及打包产物名（`客服在线平台-2.1.0-Setup-x64.exe` / `客服在线平台-2.1.0-Portable-x64.exe`），同时保留原有 `%APPDATA%\clink-wechat` 本地数据目录以确保老用户账号与登录态无缝继承。
- 原因：提升桌面视觉识别度与美观度，统一品牌名称为「客服在线平台」并发布更新。
- 文件：`assets/icon-master.svg`、`assets/icon-v2.png`、`assets/icon-v2.ico`、`scripts/render-icon.js`、`package.json`、`src/index.html`、`src/main/window.js`、`src/main/tray.js`、`src/main/tray-menu.js`、`src/main/shortcut.js`、`src/renderer/core.js`、`src/renderer/status.js`、`README.md`、`CHANGELOG.md`
- 验证：`npm run check`、`npm test`、新图标成图视觉审阅及打包版实机冒烟测试通过。

---

## 2.0.0 — 2026-11-26

### [2026-11-26 15:06:00] feat: 全新渐变美学 UI 重构 + 低内存防泄漏模块化架构

- 变更：
  1. **模块化架构重构**：将原 1635 行单文件 `src/main.js` 拆分为 `src/main/`、`src/renderer/`、`src/styles/` 等高内聚小模块，所有源码文件严格控制在 100 行以内。
  2. **渐变美学前端 UI**：新增 4 套渐变主题（极光翠绿 / 暮光靛紫 / 晴空蔚蓝 / 暖阳琥珀），全新渐变侧栏、柔光渐变标题栏、实时内存胶囊、可重置缩放徽章、滑动开关设置弹层与渐变卡片快捷账号弹窗。
  3. **内存与 CPU 深度优化 / 防泄漏**：
     - 彻底移除 `activity-hook.js` 中的两个常驻 `setInterval`（标题检测迁至主进程 `page-title-updated` 事件，登录捕获改为纯事件驱动 + FNV-1a 摘要去重，移除 `innerText` 同步重排并立即清除明文密码）；
     - 主进程所有定时器纳入 `state.js` 集中追踪与销毁，修复 SPA 多次加载导致的 `autofill`/`cookie` 定时器重叠与 `will-download` 监听重复绑定；
     - 为 Chromium 配置磁盘/媒体缓存上限与 V8 堆上限，新增标题栏一键释放内存与后台闲置自动裁剪缓存守护；
     - 渲染进程全部 IPC 与 DOM 监听在 `beforeunload`/`unload` 自动解绑，内存统计仅在窗口可见时采样，窗口隐藏即停止轮询。
  4. **100% 保留原有功能**：兼容 `%APPDATA%\clink-wechat` 本地数据与 DPAPI 加密账号、图片右键防盗链另存为（新增 50MB 安全上限与异步写盘）、托盘管理、新消息闪烁角标、快捷登录与多屏坐标校验。
- 原因：重新设计程序界面并采用渐变色美化，保留全部原有功能的同时降低长期运行的 CPU 与内存占用，消除内存泄漏风险。
- 文件：`src/main/*`、`src/renderer/*`、`src/styles/*`、`src/index.html`、`src/preload.js`、`src/site-preload.js`、`src/inject/activity-hook.js`、`scripts/check-syntax.mjs`、`tests/core.test.mjs`、`package.json`
- 验证：`npm run check`、`npm test` 及 Electron 实机运行截图与内存自检验证。

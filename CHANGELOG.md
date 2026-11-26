# 变更记录

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

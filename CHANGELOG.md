# 变更记录

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

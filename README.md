# 客服在线平台（ClinkWeChat 2.1）· 渐变美学客服工作台客户端

基于原 `ClinkWeChat` 完整重构的 Windows 桌面客户端「客服在线平台」，将 Clink「客户联络中心」在线客服工作台（`agent-bj.clink.cn`）封装为轻量、高颜值的桌面应用，100% 保留原版全部实用功能，并重点解决长时间运行导致的 CPU 抖动与内存泄漏问题。

## 核心升级

### 1. 渐变美学 UI 重设计
- **4 套精选渐变主题**（支持左侧栏一键轮换或设置面板色卡直选，配置持久化）：
  - **极光翠绿（默认）**：深邃夜蓝绿渐变侧栏 + 翡翠青渐变主色 + 柔光微透标题栏
  - **暮光靛紫**：暗夜靛紫渐变侧栏 + 紫粉极光渐变强调色
  - **晴空蔚蓝**：深海蓝渐变侧栏 + 天蓝青碧渐变强调色
  - **暖阳琥珀**：暖梅褐渐变侧栏 + 珊瑚橙粉渐变强调色
- **精致交互组件**：滑动渐变开关、标题栏缩放比例徽章（点击可一键重置 100%）、标题栏实时内存胶囊、全新渐变卡片加载/错误页与快捷账号弹窗。
- **零额外前端框架**：纯模块化原生 HTML/CSS/JS，无 React/Vue 打包体积与虚拟 DOM 内存开销，纯静态 CSS 渐变零 GPU 轮询。

### 2. 内存与 CPU 深度优化 / 防内存泄漏
- **彻底清除页面常驻轮询**：移除原版 `activity-hook.js` 内永久运行的 2 个 `setInterval`（标题轮询已迁至主进程原生 `page-title-updated` 事件；登录捕获改为纯事件驱动，不再每秒全量扫 DOM）。
- **消除点击同步重排（Forced Reflow）**：点击检测从 `innerText` 改为 `textContent`，且仅在存在密码输入框的登录页执行，同时捕获后立即清空闭包明文密码并使用 FNV-1a 摘要去重。
- **主进程定时器与监听全托管**：
  - `src/main/state.js` 集中追踪全部 `setTimeout`/`setInterval`，窗口关闭与退出时统一清空；
  - `autofill` 与 `cookies` 调度前自动取消旧定时器，彻底避免 SPA 多次加载造成重试链叠加；
  - `session-setup.js` 单次初始化守护，防止 `will-download` 监听重复挂载泄漏；
  - `resize` 布局更新使用 16ms 节流，降低拖拽窗口时的 CPU 占用；
  - 渲染进程 `preload.js` 与 `core.js` 全量托管 `ipcRenderer` / DOM 监听，并在 `unload` 时自动解绑；内存面板仅在窗口可见时每 12 秒轮询，最小化/进托盘自动暂停。
- **Chromium 内存治理与一键/自动释放**：
  - 启动参数限制磁盘缓存（100MB）、媒体缓存（50MB）与 V8 老生代上限（512MB）；
  - 标题栏内存胶囊、左侧栏闪电按钮、设置与托盘菜单均支持**一键清理 HTTP/V8 代码缓存释放内存**（保留登录态与 Cookie）；
  - 后台闲置自动释放内存守护（收起至托盘超过 5 分钟或总内存达 520MB 时自动温和裁剪缓存）。

## 保留的全部原版功能
- 单实例锁与二次唤起、多显示器窗口坐标越界保护、窗口位置/大小记忆
- 内嵌工作台会话持久化（兼容原有 `%APPDATA%\clink-wechat` 数据目录）
- 多账号管理（Windows DPAPI 本地加密）、手动登录自动记住、登录页自动填充（不绕过滑块验证码）、会话 Cookie 30 天固化
- 图片右键另存为（支持 `http(s):` 带会话 Cookie 防盗链抓取、`data:`、`blob:` 及 CSS 背景图坐标探测，限制 50MB 防 OOM + 异步写盘不卡主线程）、复制图片/地址、附件下载另存为
- 新消息任务栏闪烁 + 红点角标（提示音 / 桌面通知 / 标题未读数三路触发）
- 窗口置顶、页面缩放（A− / 100% / A+）、F5 刷新、F12 开发者工具、系统托盘与点 × 收起托盘

## 目录结构（所有源码文件严格 ≤ 100 行）
```text
src/
  main/             主进程模块化目录（config / state / store / crypto / accounts / bounds /
                    attention / cookies / fill-script / autofill / image-fetch / image-save /
                    context-menu / memory / session-setup / tray-menu / tray / view-events /
                    view / window / ipc-window / ipc-accounts / ipc / shortcut / diag / index）
  renderer/         外壳前端模块化目录（core / theme / status / toolbar / memory-ui /
                    settings / accounts-list / accounts / app）
  styles/           渐变主题与组件模块化样式表（tokens / layout / rail / titlebar /
                    titlebar-controls / overlay / popup / swatches / modal / modal-form）
  inject/           零轮询页面注入钩子（activity-hook.js）
  preload.js        外壳安全桥接（带自动解绑清理）
  site-preload.js   工作台安全桥接
  index.html        外壳页面骨架
scripts/            语法与百行规范检查脚本、图标/角标生成脚本
tests/              核心模块单元测试
```

## 常用命令
```bash
npm start            # 启动客户端
npm run check        # 检查全部源码 JS 语法与 ≤100 行拆分规范
npm test             # 运行单元测试
npm run build        # 打包 Windows 安装版 (Setup.exe) 与便携单文件版 (Portable.exe)
npm run shortcut     # 在桌面创建启动快捷方式
```

## 下载预编译安装包
可直接前往本仓库 [Releases](https://github.com/zsiri026-del/ClinkWeChat/releases/latest) 页面下载：
- `客服在线平台-2.1.0-Setup-x64.exe`：Windows 安装向导版（支持自定义目录与桌面/开始菜单快捷方式）
- `客服在线平台-2.1.0-Portable-x64.exe`：Windows 绿色便携单文件版（双击即用、免安装）
- `SHA256SUMS.txt`：安装包 SHA-256 完整性校验值

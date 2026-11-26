'use strict';

const { app, Menu } = require('electron');
const { ctx, send } = require('./state');
const { optimizeMemory } = require('./memory');
const { checkForUpdates } = require('./updater');

function buildTrayMenu({ showFn, refreshFn }) {
  const onTop = !!(ctx.win && !ctx.win.isDestroyed() && ctx.win.isAlwaysOnTop());
  return {
    onTop,
    menu: Menu.buildFromTemplate([
      { label: '打开客服在线平台', click: () => showFn() },
      {
        label: '窗口置顶',
        type: 'checkbox',
        checked: onTop,
        click: (item) => {
          if (!ctx.win || ctx.win.isDestroyed()) return;
          ctx.win.setAlwaysOnTop(item.checked, 'floating');
          send('app:state', { alwaysOnTop: item.checked });
          refreshFn(true);
        },
      },
      { label: '立即释放内存', click: () => optimizeMemory('tray').catch(() => {}) },
      { label: '检查更新', click: () => { showFn(); checkForUpdates(true).catch(() => {}); } },
      { type: 'separator' },
      {
        label: '重启客户端',
        click: () => {
          ctx.quitting = true;
          app.relaunch();
          app.exit(0);
        },
      },
      {
        label: '退出',
        click: () => {
          ctx.quitting = true;
          app.quit();
        },
      },
    ]),
  };
}

module.exports = { buildTrayMenu };

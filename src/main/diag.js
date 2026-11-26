'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { dbg } = require('./config');
const { ctx, setTrackedTimeout } = require('./state');
const { getMemoryStats, optimizeMemory } = require('./memory');
const { showMainWindow } = require('./tray');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runDiagIfNeeded(createWinFn) {
  const dir = process.env.SHOT;
  if (!dir) return;

  setTrackedTimeout(async () => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const win = ctx.win;
      const wc = ctx.view && ctx.view.webContents;
      if (!win || win.isDestroyed() || !wc || wc.isDestroyed()) return;

      const ui = process.env.SHOT_UI || '';
      if (ui === 'settings') {
        await win.webContents.executeJavaScript("document.getElementById('settingsBtn').click()");
        await sleep(350);
      } else if (ui === 'login') {
        await win.webContents.executeJavaScript("document.getElementById('loginBtn').click()");
        await sleep(350);
      } else if (ui === 'themes') {
        for (const t of ['aurora', 'twilight', 'ocean', 'sunset']) {
          await win.webContents.executeJavaScript(`window.Shell.theme.apply('${t}')`);
          await sleep(250);
          const img = await win.webContents.capturePage();
          fs.writeFileSync(path.join(dir, `shot-theme-${t}.png`), img.toPNG());
        }
      }

      if (process.env.SHOT_TEST) {
        dbg('ctx-listeners=' + wc.listenerCount('context-menu'));
        dbg('mem-before=' + JSON.stringify(getMemoryStats()));
        const opt = await optimizeMemory('diag');
        dbg('mem-after=' + JSON.stringify(opt.stats));

        win.close();
        await sleep(500);
        dbg(`after-close alive=${!win.isDestroyed()} visible=${win.isVisible()}`);
        showMainWindow(createWinFn);
        await sleep(400);
        dbg(`after-show visible=${win.isVisible()}`);
      }

      const shellImg = await win.webContents.capturePage();
      fs.writeFileSync(path.join(dir, 'shot-shell.png'), shellImg.toPNG());
      if (wc && !wc.isDestroyed()) {
        const siteImg = await wc.capturePage();
        fs.writeFileSync(path.join(dir, 'shot-site.png'), siteImg.toPNG());
      }
    } catch (err) {
      dbg('diag-err:' + err);
    } finally {
      ctx.quitting = true;
      app.quit();
    }
  }, Number(process.env.SHOT_DELAY_MS || 4500));
}

module.exports = { runDiagIfNeeded };

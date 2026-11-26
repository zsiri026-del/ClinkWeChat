'use strict';

const { ipcMain } = require('electron');
const { dbg } = require('./config');
const { ctx, send } = require('./state');
const { settings, saveSettings } = require('./store');
const {
  listAccounts,
  upsertAccount,
  removeAccount,
  getAccountById,
  decSecret,
} = require('./accounts');
const { fillIntoView } = require('./autofill');

function registerAccountIpc() {
  ipcMain.handle('acc:list', () => listAccounts());

  ipcMain.handle('acc:save', (_e, data) => upsertAccount(data || {}));

  ipcMain.handle('acc:remove', (_e, id) => removeAccount(id));

  ipcMain.handle('acc:login', async (_e, id) => {
    const rec = getAccountById(id);
    if (!rec) return { ok: false, reason: 'not-found' };
    const pwd = decSecret(rec.secret);
    if (!pwd) return { ok: false, reason: 'no-password' };
    settings.lastAccountId = rec.id;
    saveSettings();
    const r = await fillIntoView(rec.cno, rec.account, pwd, true);
    if (r && r.ok) ctx.autoFillDone = true;
    return r;
  });

  ipcMain.on('site:login-capture', (e, data) => {
    if (!ctx.view || ctx.view.webContents.isDestroyed()) return;
    if (e.sender !== ctx.view.webContents || !settings.autoFill) return;
    const account = String((data && data.account) || '').trim();
    const cno = String((data && data.cno) || '').trim();
    const pwd = String((data && data.password) || '');
    if (!account || !pwd) return;

    const saved = upsertAccount({ account, cno, pwd });
    if (!saved || !saved.ok) return;
    settings.lastAccountId = saved.id;
    saveSettings();
    dbg('login-captured ' + account);
    send('acc:remembered', { account, cno });
  });
}

module.exports = { registerAccountIpc };

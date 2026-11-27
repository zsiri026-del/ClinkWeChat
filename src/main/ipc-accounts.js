'use strict';

const { ipcMain } = require('electron');
const { dbg } = require('./config');
const { isShellSender, isTrustedSiteFrame } = require('./security');
const { ctx, send } = require('./state');
const { settings, saveSettings } = require('./store');
const {
  listAccounts,
  upsertAccount,
  removeAccount,
  getAccountById,
  decSecret,
} = require('./accounts');
const { fillIntoView, cancelAutoFill } = require('./autofill');

const CAPTURE_TTL_MS = 2 * 60 * 1000;
let pendingCapture = null;

function clearPendingCapture() {
  pendingCapture = null;
}

function commitPendingCapture() {
  if (!pendingCapture || !settings.autoFill) {
    pendingCapture = null;
    return false;
  }
  const stale = Date.now() - pendingCapture.capturedAt > CAPTURE_TTL_MS;
  const { account, cno, pwd } = pendingCapture;
  pendingCapture = null;
  if (stale) return false;
  const saved = upsertAccount({ account, cno, pwd });
  if (!saved || !saved.ok) return false;
  settings.lastAccountId = saved.id;
  saveSettings();
  dbg('login-captured-confirmed ' + account);
  send('acc:remembered', { account, cno });
  return true;
}

function registerAccountIpc() {
  ipcMain.handle('acc:list', (e) => (isShellSender(e) ? listAccounts() : []));

  ipcMain.handle('acc:save', (e, data) => {
    if (!isShellSender(e)) return { ok: false, reason: 'unauthorized' };
    return upsertAccount(data || {});
  });

  ipcMain.handle('acc:remove', (e, id) => {
    if (!isShellSender(e)) return { ok: false, reason: 'unauthorized' };
    return removeAccount(id);
  });

  ipcMain.handle('acc:login', async (e, id) => {
    if (!isShellSender(e)) return { ok: false, reason: 'unauthorized' };
    cancelAutoFill();
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
    if (!isTrustedSiteFrame(e) || !settings.autoFill) return;
    const account = String((data && data.account) || '').trim();
    const cno = String((data && data.cno) || '').trim();
    const pwd = String((data && data.password) || '');
    if (!account || !pwd) return;
    // Stage captured credentials in memory only; persist after verified login success.
    pendingCapture = { account, cno, pwd, capturedAt: Date.now() };
    dbg('login-capture-staged ' + account);
    try {
      const { scheduleCookieCheck } = require('./cookies');
      scheduleCookieCheck();
    } catch {}
  });
}

module.exports = { registerAccountIpc, commitPendingCapture, clearPendingCapture };

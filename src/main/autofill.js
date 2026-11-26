'use strict';

const { dbg } = require('./config');
const { ctx, send, setTrackedTimeout, clearTrackedTimeout } = require('./state');
const { settings, saveSettings } = require('./store');
const { loadAccounts, getLastAccount, decSecret } = require('./accounts');
const { buildFillScript } = require('./fill-script');

let fillTimer = null;
let fillRound = 0;

function cancelAutoFill() {
  clearTrackedTimeout(fillTimer);
  fillTimer = null;
  fillRound = 0;
}

async function fillIntoView(cno, account, password, force) {
  if (!ctx.view || ctx.view.webContents.isDestroyed()) return { ok: false, reason: 'no-view' };
  const wc = ctx.view.webContents;
  const code = buildFillScript(cno, account, password, force);
  const frames = [];
  try {
    frames.push(wc.mainFrame);
    for (const f of wc.mainFrame.frames || []) frames.push(f);
  } catch {
    /* ignore */
  }
  for (const f of frames) {
    try {
      const r = await f.executeJavaScript(code, true);
      if (r && r.ok) {
        if (!ctx.overlayOpen) ctx.view.setVisible(true);
        return r;
      }
    } catch {
      /* cross-origin or destroyed frame */
    }
  }
  return { ok: false, reason: 'no-password' };
}

async function tryAutoFill() {
  if (!settings.autoFill || ctx.autoFillDone) return true;
  const list = loadAccounts();
  if (!list.length) return true;

  const rec = getLastAccount(settings.lastAccountId);
  if (!rec) return true;
  const pwd = decSecret(rec.secret);
  if (!pwd) return true;

  const r = await fillIntoView(rec.cno, rec.account, pwd, false);
  if (r && r.ok) {
    ctx.autoFillDone = true;
    dbg(`autofill-ok ${rec.account} ${JSON.stringify(r.filled)}`);
    settings.lastAccountId = rec.id;
    saveSettings();
    send('acc:auto-filled', { account: rec.account, label: rec.label || '', cno: rec.cno || '' });
    return true;
  }
  dbg('autofill-miss ' + ((r && r.reason) || '?'));
  return false;
}

function scheduleAutoFill() {
  if (!settings.autoFill || ctx.autoFillDone || !loadAccounts().length) return;
  cancelAutoFill();
  const tick = async () => {
    fillTimer = null;
    if (ctx.autoFillDone || !settings.autoFill) return;
    const ok = await tryAutoFill();
    if (ok || ++fillRound > 14) return;
    fillTimer = setTrackedTimeout(tick, 1500);
  };
  fillTimer = setTrackedTimeout(tick, 1000);
}

module.exports = { fillIntoView, scheduleAutoFill, cancelAutoFill };

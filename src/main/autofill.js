'use strict';

const { isTrusted, dbg } = require('./config');
const { ctx, send, setTrackedTimeout, clearTrackedTimeout } = require('./state');
const { settings, saveSettings } = require('./store');
const { loadAccounts, getLastAccount, decSecret } = require('./accounts');
const { buildFillScript } = require('./fill-script');

let fillTimer = null;
let fillRound = 0;
let fillGen = 0;

function cancelAutoFill() {
  fillGen += 1;
  clearTrackedTimeout(fillTimer);
  fillTimer = null;
  fillRound = 0;
}

function collectTrustedFrames(wc) {
  const out = [];
  const seen = new Set();
  const walk = (frame) => {
    if (!frame || seen.has(frame)) return;
    seen.add(frame);
    let url = '';
    try { url = frame.url || ''; } catch { url = ''; }
    if (isTrusted(url)) out.push({ frame, url });
    let children = [];
    try { children = frame.frames || []; } catch { children = []; }
    for (const child of children) walk(child);
  };
  try { walk(wc.mainFrame); } catch {}
  return out;
}

async function fillIntoView(cno, account, password, force, expectedGen) {
  if (!ctx.view || ctx.view.webContents.isDestroyed()) return { ok: false, reason: 'no-view' };
  const wc = ctx.view.webContents;
  if (!isTrusted(wc.getURL())) return { ok: false, reason: 'untrusted-origin' };
  const frames = collectTrustedFrames(wc);
  if (!frames.length) return { ok: false, reason: 'untrusted-origin' };

  const code = buildFillScript(cno, account, password, force);
  let lastReason = 'no-password';
  for (const { frame, url } of frames) {
    if (expectedGen !== undefined && expectedGen !== fillGen) return { ok: false, reason: 'cancelled' };
    try {
      if (!isTrusted(frame.url) || frame.url !== url) continue;
      const r = await frame.executeJavaScript(code, true);
      if (expectedGen !== undefined && expectedGen !== fillGen) return { ok: false, reason: 'cancelled' };
      if (r && r.ok) {
        if (!ctx.overlayOpen && ctx.view && !ctx.view.webContents.isDestroyed()) ctx.view.setVisible(true);
        return r;
      }
      if (r && r.reason) lastReason = r.reason;
    } catch {
      /* cross-origin or destroyed frame */
    }
  }
  return { ok: false, reason: lastReason };
}

async function tryAutoFill(gen) {
  if (gen !== fillGen || !settings.autoFill || ctx.autoFillDone) return true;
  const list = loadAccounts();
  if (!list.length) return true;

  const rec = getLastAccount(settings.lastAccountId);
  if (!rec) return true;
  const pwd = decSecret(rec.secret);
  if (!pwd) return true;

  const r = await fillIntoView(rec.cno, rec.account, pwd, false, gen);
  if (gen !== fillGen || !settings.autoFill) return true;
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
  const gen = fillGen;
  const tick = async () => {
    fillTimer = null;
    if (gen !== fillGen || ctx.autoFillDone || !settings.autoFill) return;
    const ok = await tryAutoFill(gen);
    if (gen !== fillGen || ok || ++fillRound > 14) return;
    fillTimer = setTrackedTimeout(tick, 1500);
  };
  fillTimer = setTrackedTimeout(tick, 1000);
}

module.exports = { fillIntoView, scheduleAutoFill, cancelAutoFill };

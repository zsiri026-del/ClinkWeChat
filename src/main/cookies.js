'use strict';

const { session } = require('electron');
const { PARTITION, dbg } = require('./config');
const { ctx, setTrackedTimeout, clearTrackedTimeout } = require('./state');

let checkTimer = null;

async function persistSessionCookies() {
  try {
    const sess = session.fromPartition(PARTITION);
    const all = await sess.cookies.get({});
    const sessionOnes = all.filter((c) => c.session);
    if (!sessionOnes.length) return 0;

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    for (const c of sessionOnes) {
      try {
        await sess.cookies.set({
          url: `${c.secure ? 'https' : 'http'}://${String(c.domain).replace(/^\./, '')}${c.path || '/'}`,
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          expirationDate: exp,
          sameSite: c.sameSite,
        });
      } catch {
        /* single cookie failure does not block others */
      }
    }
    ctx.cookiePatched = true;
    dbg('persist-session-cookies=' + sessionOnes.length);
    return sessionOnes.length;
  } catch (err) {
    dbg('persist-cookies-failed:' + err);
    return 0;
  }
}

async function checkLoggedIn() {
  if (!ctx.view || ctx.view.webContents.isDestroyed() || ctx.cookiePatched) return;
  try {
    const hasPwd = await ctx.view.webContents.executeJavaScript(
      "Boolean(document.querySelector('input[type=password]'))",
      true,
    );
    if (!hasPwd) await persistSessionCookies();
  } catch {
    /* ignore */
  }
}

function cancelCookieCheck() {
  clearTrackedTimeout(checkTimer);
  checkTimer = null;
}

function scheduleCookieCheck() {
  if (ctx.cookiePatched) return;
  cancelCookieCheck();
  checkTimer = setTrackedTimeout(() => {
    checkTimer = null;
    checkLoggedIn();
  }, 6000);
}

module.exports = { persistSessionCookies, scheduleCookieCheck, cancelCookieCheck };

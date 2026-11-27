'use strict';

const { session } = require('electron');
const { PARTITION, TRUSTED_HOSTS, isTrusted, dbg } = require('./config');
const { ctx, setTrackedTimeout, clearTrackedTimeout } = require('./state');

let checkTimer = null;
let cookieGen = 0;
let opChain = Promise.resolve();

function enqueue(fn) {
  const next = opChain.then(fn, fn);
  opChain = next.catch(() => {});
  return next;
}

function isTrustedCookieDomain(domain) {
  const host = String(domain || '').replace(/^\./, '').toLowerCase();
  if (!host) return false;
  return TRUSTED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

function buildCookieDetails(c, exp) {
  const host = String(c.domain || '').replace(/^\./, '');
  const details = {
    url: `${c.secure ? 'https' : 'http'}://${host}${c.path || '/'}`,
    name: c.name,
    value: c.value,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    expirationDate: exp,
    sameSite: c.sameSite,
  };
  // Preserve hostOnly semantics: omitting `domain` keeps host-only cookies bound to exact host.
  if (!c.hostOnly && c.domain) {
    details.domain = c.domain;
  }
  return details;
}

function persistSessionCookies(expectedGen = cookieGen) {
  return enqueue(async () => {
    if (expectedGen !== cookieGen) return 0;
    try {
      const sess = session.fromPartition(PARTITION);
      const all = await sess.cookies.get({});
      if (expectedGen !== cookieGen) return 0;
      const sessionOnes = all.filter((c) => c.session && isTrustedCookieDomain(c.domain));
      if (!sessionOnes.length) return 0;

      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
      let count = 0;
      for (const c of sessionOnes) {
        if (expectedGen !== cookieGen) return count;
        try {
          await sess.cookies.set(buildCookieDetails(c, exp));
          count += 1;
        } catch {
          /* single cookie failure does not block others */
        }
      }
      if (expectedGen === cookieGen) {
        ctx.cookiePatched = true;
        dbg('persist-session-cookies=' + count);
      }
      return count;
    } catch (err) {
      dbg('persist-cookies-failed:' + err);
      return 0;
    }
  });
}

function clearSessionDataSafe() {
  cookieGen += 1;
  cancelCookieCheck();
  return enqueue(async () => {
    const sess = session.fromPartition(PARTITION);
    await sess.clearStorageData();
    await sess.clearCache();
    ctx.cookiePatched = false;
  });
}

async function checkLoggedIn(expectedGen) {
  if (expectedGen !== cookieGen || !ctx.view || ctx.view.webContents.isDestroyed()) return;
  const curUrl = ctx.view.webContents.getURL();
  if (!isTrusted(curUrl)) return;
  try {
    const hasPwd = await ctx.view.webContents.executeJavaScript(
      "Boolean(document.querySelector('input[type=password]'))",
      true,
    );
    if (expectedGen !== cookieGen || hasPwd) return;
    try {
      const { commitPendingCapture } = require('./ipc-accounts');
      commitPendingCapture();
    } catch {}
    if (!ctx.cookiePatched) await persistSessionCookies(expectedGen);
  } catch {
    /* ignore */
  }
}

function cancelCookieCheck() {
  clearTrackedTimeout(checkTimer);
  checkTimer = null;
}

function scheduleCookieCheck() {
  cancelCookieCheck();
  const gen = cookieGen;
  checkTimer = setTrackedTimeout(() => {
    checkTimer = null;
    checkLoggedIn(gen);
  }, 6000);
}

module.exports = {
  isTrustedCookieDomain,
  buildCookieDetails,
  persistSessionCookies,
  clearSessionDataSafe,
  scheduleCookieCheck,
  cancelCookieCheck,
};

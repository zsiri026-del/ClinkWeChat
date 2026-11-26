'use strict';

const { TARGET_URL } = require('./config');

const timers = new Set();
const intervals = new Set();

const ctx = {
  win: null,
  view: null,
  tray: null,
  quitting: false,
  overlayOpen: false,
  hiddenAt: 0,
  autoFillDone: false,
  cookiePatched: false,
  lastStatus: { state: 'loading', url: TARGET_URL },
};

function send(channel, payload) {
  if (channel === 'site-status') ctx.lastStatus = payload;
  if (ctx.win && !ctx.win.isDestroyed()) {
    try {
      ctx.win.webContents.send(channel, payload);
    } catch {
      /* window closing */
    }
  }
}

function setTrackedTimeout(fn, ms) {
  const id = setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
  return id;
}

function clearTrackedTimeout(id) {
  if (!id) return;
  clearTimeout(id);
  timers.delete(id);
}

function setTrackedInterval(fn, ms) {
  const id = setInterval(fn, ms);
  intervals.add(id);
  return id;
}

function clearTrackedInterval(id) {
  if (!id) return;
  clearInterval(id);
  intervals.delete(id);
}

function clearAllTimers() {
  for (const id of timers) clearTimeout(id);
  timers.clear();
  for (const id of intervals) clearInterval(id);
  intervals.clear();
}

module.exports = {
  ctx,
  send,
  setTrackedTimeout,
  clearTrackedTimeout,
  setTrackedInterval,
  clearTrackedInterval,
  clearAllTimers,
};

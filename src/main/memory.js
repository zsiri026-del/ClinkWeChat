'use strict';

const { app, session } = require('electron');
const { PARTITION, dbg } = require('./config');
const { ctx, send, setTrackedInterval, clearTrackedInterval } = require('./state');
const { settings } = require('./store');

const GUARD_INTERVAL_MS = 15 * 60 * 1000;
const HIDDEN_TRIM_MS = 5 * 60 * 1000;
const AUTO_TRIM_MB = 450;
let guardTimer = null;
let inFlightOptimize = null;

function applyChromiumFlags() {
  app.commandLine.appendSwitch('disk-cache-size', String(100 * 1024 * 1024));
  app.commandLine.appendSwitch('media-cache-size', String(50 * 1024 * 1024));
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
}

function getMemoryStats() {
  let totalKB = 0;
  let mainKB = 0;
  let rendererKB = 0;
  let gpuKB = 0;
  const metrics = app.getAppMetrics();
  for (const m of metrics) {
    const kb = (m.memory && (m.memory.privateBytes || m.memory.workingSetSize)) || 0;
    totalKB += kb;
    if (m.type === 'Browser') mainKB += kb;
    else if (m.type === 'Tab') rendererKB += kb;
    else if (m.type === 'GPU') gpuKB += kb;
  }
  return {
    totalMB: Math.round(totalKB / 1024),
    mainMB: Math.round(mainKB / 1024),
    rendererMB: Math.round(rendererKB / 1024),
    gpuMB: Math.round(gpuKB / 1024),
    processCount: metrics.length,
  };
}

async function runOptimizeOnce(reason) {
  const before = getMemoryStats();
  const errors = [];
  let succeeded = 0;

  const tryStep = async (label, fn) => {
    try {
      await fn();
      succeeded += 1;
    } catch (err) {
      errors.push(`${label}: ${String((err && err.message) || err)}`);
    }
  };

  const sess = session.fromPartition(PARTITION);
  await tryStep('clearCache', () => sess.clearCache());
  if (typeof sess.clearCodeCaches === 'function') {
    await tryStep('clearCodeCaches', () => sess.clearCodeCaches({}));
  }
  if (typeof sess.clearHostResolverCache === 'function') {
    await tryStep('clearHostResolverCache', () => sess.clearHostResolverCache());
  }
  if (ctx.view && !ctx.view.webContents.isDestroyed()) {
    await tryStep('navigationHistory', () => {
      const nav = ctx.view.webContents.navigationHistory;
      if (nav && typeof nav.length === 'function' && nav.length() > 30) nav.clear();
    });
  }

  const after = getMemoryStats();
  const freedMB = Math.max(0, before.totalMB - after.totalMB);
  const ok = errors.length === 0;
  const partial = errors.length > 0 && succeeded > 0;
  dbg(`mem-opt:${reason} ok=${ok} ${before.totalMB}MB->${after.totalMB}MB`);
  const result = {
    ok,
    partial,
    errors,
    reason,
    beforeMB: before.totalMB,
    afterMB: after.totalMB,
    freedMB,
    stats: after,
  };
  send('app:memory-optimized', result);
  return result;
}

function optimizeMemory(reason = 'manual') {
  if (inFlightOptimize) return inFlightOptimize;
  inFlightOptimize = runOptimizeOnce(reason).finally(() => {
    inFlightOptimize = null;
  });
  return inFlightOptimize;
}

function startMemoryGuard() {
  stopMemoryGuard();
  guardTimer = setTrackedInterval(() => {
    if (!settings.autoOptimizeMem || ctx.quitting) return;
    const stats = getMemoryStats();
    const hiddenLong = ctx.hiddenAt > 0 && Date.now() - ctx.hiddenAt >= HIDDEN_TRIM_MS;
    if (hiddenLong || stats.totalMB >= AUTO_TRIM_MB) {
      optimizeMemory(hiddenLong ? 'idle-tray' : 'threshold').catch(() => {});
    }
  }, GUARD_INTERVAL_MS);
}

function stopMemoryGuard() {
  clearTrackedInterval(guardTimer);
  guardTimer = null;
}

module.exports = {
  applyChromiumFlags,
  getMemoryStats,
  optimizeMemory,
  startMemoryGuard,
  stopMemoryGuard,
};

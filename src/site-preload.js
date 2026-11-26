'use strict';

const { ipcRenderer, contextBridge } = require('electron');

const MIN_GAP_MS = 2500;
let lastPing = 0;

contextBridge.exposeInMainWorld('__cwRememberLogin', (payload) => {
  try {
    if (!payload || !payload.password || !payload.account) return;
    ipcRenderer.send('site:login-capture', {
      cno: String(payload.cno || ''),
      account: String(payload.account || ''),
      password: String(payload.password || ''),
    });
  } catch {
    /* ignore */
  }
});

contextBridge.exposeInMainWorld('__cwPing', (reason) => {
  const now = Date.now();
  if (now - lastPing < MIN_GAP_MS) return;
  lastPing = now;
  try {
    ipcRenderer.send('site:activity', String(reason || 'unknown'));
  } catch {
    /* ignore */
  }
});

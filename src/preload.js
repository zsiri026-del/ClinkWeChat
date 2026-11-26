'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const disposers = new Set();

function subscribe(channel, cb) {
  if (typeof cb !== 'function') return () => {};
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  const off = () => {
    ipcRenderer.removeListener(channel, handler);
    disposers.delete(off);
  };
  disposers.add(off);
  return off;
}

window.addEventListener('unload', () => {
  for (const off of Array.from(disposers)) off();
  disposers.clear();
});

contextBridge.exposeInMainWorld('app', {
  window: (action) => ipcRenderer.send('app:window', action),
  setOverlay: (open) => ipcRenderer.send('app:overlay', !!open),
  zoom: (delta) => ipcRenderer.send('app:zoom', delta),
  zoomReset: () => ipcRenderer.send('app:zoom-reset'),
  reload: () => ipcRenderer.send('app:reload'),
  devtools: () => ipcRenderer.send('app:devtools'),
  external: () => ipcRenderer.send('app:external'),
  clear: () => ipcRenderer.invoke('app:clear'),
  state: () => ipcRenderer.invoke('app:state'),
  siteState: () => ipcRenderer.invoke('site:state'),
  memoryStats: () => ipcRenderer.invoke('app:memory-stats'),
  memoryOptimize: () => ipcRenderer.invoke('app:memory-optimize'),
  onStatus: (cb) => subscribe('site-status', cb),
  onTitle: (cb) => subscribe('site-title', cb),
  onState: (cb) => subscribe('app:state', cb),
  onHostInfo: (cb) => subscribe('host-info', cb),
  onNewMessage: (cb) => subscribe('app:new-message', cb),
  onSaved: (cb) => subscribe('app:saved', cb),
  onAutoFilled: (cb) => subscribe('acc:auto-filled', cb),
  onRemembered: (cb) => subscribe('acc:remembered', cb),
  onMemoryOptimized: (cb) => subscribe('app:memory-optimized', cb),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  accounts: {
    list: () => ipcRenderer.invoke('acc:list'),
    save: (data) => ipcRenderer.invoke('acc:save', data),
    remove: (id) => ipcRenderer.invoke('acc:remove', id),
    login: (id) => ipcRenderer.invoke('acc:login', id),
  },
});

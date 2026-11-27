'use strict';

const { shell } = require('electron');
const { isTrusted } = require('./config');
const { ctx } = require('./state');

const SAFE_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

function isSafeExternalUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const u = new URL(url);
    return SAFE_EXTERNAL_PROTOCOLS.has(u.protocol);
  } catch {
    return false;
  }
}

function openSafeExternal(url) {
  if (!isSafeExternalUrl(url)) return false;
  shell.openExternal(url).catch(() => {});
  return true;
}

function isShellSender(event) {
  if (!event || !ctx.win || ctx.win.isDestroyed()) return false;
  const wc = ctx.win.webContents;
  if (event.sender !== wc) return false;
  const frame = event.senderFrame;
  if (frame && frame !== wc.mainFrame) return false;
  const url = (frame && frame.url) || wc.getURL() || '';
  return /^file:\/\/\/.*\/index\.html(?:[?#]|$)/i.test(url.replace(/\\/g, '/'));
}

function isTrustedSiteFrame(event) {
  if (!event || !ctx.view || ctx.view.webContents.isDestroyed()) return false;
  const wc = ctx.view.webContents;
  if (event.sender !== wc) return false;
  const url = (event.senderFrame && event.senderFrame.url) || wc.getURL() || '';
  return isTrusted(url);
}

module.exports = {
  isSafeExternalUrl,
  openSafeExternal,
  isShellSender,
  isTrustedSiteFrame,
};

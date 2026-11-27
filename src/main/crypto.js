'use strict';

const { safeStorage } = require('electron');

function isEncryptionAvailable() {
  try {
    return Boolean(safeStorage && safeStorage.isEncryptionAvailable());
  } catch {
    return false;
  }
}

function encSecret(plain) {
  if (!isEncryptionAvailable()) {
    throw new Error('系统安全加密不可用，已拒绝明文保存密码');
  }
  try {
    return { enc: true, v: safeStorage.encryptString(String(plain)).toString('base64') };
  } catch (err) {
    throw new Error('密码加密失败：' + String((err && err.message) || err));
  }
}

function isLegacyPlain(obj) {
  return Boolean(obj && obj.enc === false && typeof obj.v === 'string' && obj.v.length > 0);
}

function decSecret(obj) {
  try {
    if (!obj || !obj.v) return '';
    if (obj.enc) return safeStorage.decryptString(Buffer.from(obj.v, 'base64'));
    return Buffer.from(obj.v, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

module.exports = { isEncryptionAvailable, encSecret, isLegacyPlain, decSecret };

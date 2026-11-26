'use strict';

const { safeStorage } = require('electron');

function encSecret(plain) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return { enc: true, v: safeStorage.encryptString(plain).toString('base64') };
    }
  } catch {
    /* fallback */
  }
  return { enc: false, v: Buffer.from(plain, 'utf8').toString('base64') };
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

module.exports = { encSecret, decSecret };

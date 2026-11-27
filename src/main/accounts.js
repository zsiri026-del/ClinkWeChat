'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { isEncryptionAvailable, encSecret, isLegacyPlain, decSecret } = require('./crypto');

let cache = null;

const accPath = () => path.join(app.getPath('userData'), 'accounts.json');

function persistList(list) {
  const file = accPath();
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    return false;
  }
}

function migrateLegacyRecords(list) {
  if (!isEncryptionAvailable()) return list;
  let changed = false;
  const next = list.map((item) => {
    if (!item || !isLegacyPlain(item.secret)) return item;
    const plain = decSecret(item.secret);
    if (!plain) return item;
    try {
      changed = true;
      return { ...item, secret: encSecret(plain) };
    } catch {
      return item;
    }
  });
  if (changed && persistList(next)) return next;
  return list;
}

function loadAccounts() {
  if (cache !== null) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(accPath(), 'utf8'));
    cache = migrateLegacyRecords(Array.isArray(raw) ? raw : []);
  } catch {
    cache = [];
  }
  return cache;
}

function toPublic(a) {
  return {
    id: a.id,
    label: a.label || '',
    cno: a.cno || '',
    account: a.account || '',
    unencrypted: isLegacyPlain(a.secret),
  };
}

function listAccounts() {
  return loadAccounts().map(toPublic);
}

function upsertAccount({ id, label, cno, account, pwd }) {
  const cleanAcc = String(account || '').trim();
  const cleanLabel = String(label || '').trim();
  const cleanCno = String(cno || '').trim();
  const cleanPwd = String(pwd || '');
  if (!cleanAcc) return { ok: false, reason: 'empty-account' };

  let secret = null;
  if (cleanPwd) {
    try {
      secret = encSecret(cleanPwd);
    } catch (err) {
      return { ok: false, reason: 'crypto-unavailable', error: String((err && err.message) || err) };
    }
  }

  const list = loadAccounts();
  const nextList = list.map((item) => ({ ...item }));
  let rec = id
    ? nextList.find((a) => a.id === id)
    : nextList.find((a) => a.account === cleanAcc && String(a.cno || '').trim() === cleanCno);

  if (rec) {
    rec.account = cleanAcc;
    rec.cno = cleanCno || rec.cno || '';
    if (cleanLabel) rec.label = cleanLabel;
    if (secret) rec.secret = secret;
  } else {
    if (!secret) return { ok: false, reason: 'empty-password' };
    rec = {
      id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      label: cleanLabel || cleanAcc,
      cno: cleanCno,
      account: cleanAcc,
      secret,
    };
    nextList.push(rec);
  }

  if (!persistList(nextList)) {
    return { ok: false, reason: 'persist-failed', error: '账号文件写入失败，未保存修改' };
  }
  cache = nextList;
  return { ok: true, ...toPublic(rec) };
}

function removeAccount(id) {
  const nextList = loadAccounts().filter((a) => a.id !== id);
  if (!persistList(nextList)) {
    return { ok: false, reason: 'persist-failed', error: '账号文件写入失败，未删除账号' };
  }
  cache = nextList;
  return { ok: true };
}

function getAccountById(id) {
  return loadAccounts().find((a) => a.id === id) || null;
}

function getLastAccount(lastId) {
  const list = loadAccounts();
  return (lastId && list.find((a) => a.id === lastId)) || list[0] || null;
}

function resetAccountCache() {
  cache = null;
}

module.exports = {
  loadAccounts,
  listAccounts,
  upsertAccount,
  removeAccount,
  getAccountById,
  getLastAccount,
  decSecret,
  resetAccountCache,
};

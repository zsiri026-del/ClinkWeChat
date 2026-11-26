'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { encSecret, decSecret } = require('./crypto');

let cache = null;

const accPath = () => path.join(app.getPath('userData'), 'accounts.json');

function loadAccounts() {
  if (cache !== null) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(accPath(), 'utf8'));
    cache = Array.isArray(raw) ? raw : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persistAccounts() {
  if (!cache) return;
  try {
    const file = accPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
    fs.renameSync(tmp, file);
  } catch {
    /* ignore */
  }
}

function toPublic(a) {
  return { id: a.id, label: a.label || '', cno: a.cno || '', account: a.account || '' };
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

  const list = loadAccounts();
  const secret = cleanPwd ? encSecret(cleanPwd) : null;
  let rec = id ? list.find((a) => a.id === id) : list.find((a) => a.account === cleanAcc);

  if (rec) {
    rec.account = cleanAcc;
    rec.cno = cleanCno || rec.cno || '';
    if (cleanLabel) rec.label = cleanLabel;
    if (secret) rec.secret = secret;
  } else {
    rec = {
      id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      label: cleanLabel || cleanAcc,
      cno: cleanCno,
      account: cleanAcc,
      secret: secret || { enc: false, v: '' },
    };
    list.push(rec);
  }
  persistAccounts();
  return { ok: true, ...toPublic(rec) };
}

function removeAccount(id) {
  cache = loadAccounts().filter((a) => a.id !== id);
  persistAccounts();
  return { ok: true };
}

function getAccountById(id) {
  return loadAccounts().find((a) => a.id === id) || null;
}

function getLastAccount(lastId) {
  const list = loadAccounts();
  return (lastId && list.find((a) => a.id === lastId)) || list[0] || null;
}

module.exports = {
  loadAccounts,
  listAccounts,
  upsertAccount,
  removeAccount,
  getAccountById,
  getLastAccount,
  decSecret,
};

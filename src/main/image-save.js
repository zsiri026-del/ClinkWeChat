'use strict';

const { app, dialog } = require('electron');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { dbg } = require('./config');
const { ctx, send } = require('./state');
const { extOf, stamp, guessFileName, fetchBytes } = require('./image-fetch');

const IMG_FILTERS = [
  { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
  { name: '所有文件', extensions: ['*'] },
];

function notifySaved(filePath) {
  send('app:saved', { path: filePath, name: path.basename(filePath) });
}

async function writeImage(buf, mime, suggestedName) {
  if (!buf || !buf.length) throw new Error('图片内容为空');
  const dir = (() => {
    try { return app.getPath('pictures'); } catch { return app.getPath('downloads'); }
  })();
  const { canceled, filePath } = await dialog.showSaveDialog(ctx.win, {
    title: '图片另存为',
    defaultPath: path.join(dir, suggestedName || `image-${stamp()}.${extOf(mime)}`),
    filters: IMG_FILTERS,
  });
  if (canceled || !filePath) return false;
  await fsp.writeFile(filePath, buf);
  notifySaved(filePath);
  return true;
}

async function saveImageFromUrl(url, suggestedName) {
  if (!ctx.view || ctx.view.webContents.isDestroyed() || !url) return false;
  try {
    if (url.startsWith('data:')) {
      const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(url);
      if (!m) throw new Error('无法解析内联图片数据');
      const mime = m[1] || 'image/png';
      const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'binary');
      return await writeImage(buf, mime, suggestedName || `image-${stamp()}.${extOf(mime)}`);
    }
    if (url.startsWith('blob:')) {
      const dataUrl = await ctx.view.webContents.executeJavaScript(
        `(async()=>{try{const r=await fetch(${JSON.stringify(url)});const b=await r.blob();return await new Promise(s=>{const f=new FileReader();f.onload=()=>s(f.result);f.onerror=()=>s('');f.readAsDataURL(b);});}catch{return '';}})()`,
        true,
      );
      if (!dataUrl) throw new Error('该临时图片无法提取原图');
      return await saveImageFromUrl(dataUrl, suggestedName);
    }
    if (/^(https?|chrome-extension):/i.test(url)) {
      const { buf, mime } = await fetchBytes(url);
      return await writeImage(buf, mime, suggestedName || guessFileName(url, mime));
    }
    throw new Error('不支持的图片地址');
  } catch (err) {
    dbg('save-image-failed:' + err);
    dialog.showMessageBox(ctx.win, {
      type: 'warning', title: '保存失败',
      message: '这张图片没能取到原图，可以试试「复制图片」后在别处粘贴。',
      detail: String((err && err.message) || err), buttons: ['知道了'], noLink: true,
    }).catch(() => {});
    return false;
  }
}

module.exports = { guessFileName, fetchBytes, notifySaved, saveImageFromUrl };

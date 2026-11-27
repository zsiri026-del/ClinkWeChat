'use strict';

const { Menu, MenuItem, clipboard } = require('electron');
const { isTrusted } = require('./config');
const { isSafeExternalUrl, openSafeExternal } = require('./security');
const { ctx } = require('./state');
const { guessFileName, saveImageFromUrl } = require('./image-save');

function probeImageAt(wc, x, y) {
  const code = `(function(x,y){
    function pick(el){
      if(!el||!el.tagName) return '';
      if(el.tagName==='IMG') return el.currentSrc||el.src||'';
      if(el.tagName==='VIDEO') return el.poster||'';
      var bg='';
      try{ bg=getComputedStyle(el).backgroundImage||''; }catch(e){}
      var m=/url\\((["']?)(.+?)\\1\\)/.exec(bg);
      return m&&m[2]&&m[2]!=='none'?m[2]:'';
    }
    var el=null;
    try{ el=document.elementFromPoint(x,y); }catch(e){}
    for(var i=0;i<6&&el;i++){ var u=pick(el); if(u) return u; el=el.parentElement; }
    return '';
  })(${Number(x) || 0},${Number(y) || 0})`;
  return wc.executeJavaScript(code, true).catch(() => '');
}

async function showContextMenu(wc, params) {
  if (!ctx.win || ctx.win.isDestroyed()) return;
  const menu = new Menu();

  let imgUrl = params.mediaType === 'image' && params.srcURL ? params.srcURL : '';
  if (!imgUrl && !params.isEditable) {
    const probed = await probeImageAt(wc, params.x, params.y);
    if (probed && /^(https?:|data:image|blob:)/i.test(probed)) imgUrl = probed;
  }

  if (imgUrl) {
    menu.append(new MenuItem({
      label: '图片另存为…',
      click: () => saveImageFromUrl(imgUrl, guessFileName(imgUrl, '')),
    }));
    menu.append(new MenuItem({
      label: '复制图片',
      enabled: params.mediaType === 'image',
      click: () => { try { wc.copyImageAt(params.x, params.y); } catch {} },
    }));
    menu.append(new MenuItem({ label: '复制图片地址', click: () => clipboard.writeText(imgUrl) }));
    menu.append(new MenuItem({
      label: '在浏览器中打开图片',
      enabled: isSafeExternalUrl(imgUrl),
      click: () => openSafeExternal(imgUrl),
    }));
    menu.append(new MenuItem({ type: 'separator' }));
  }

  if (params.linkURL) {
    const canOpen = isTrusted(params.linkURL) || isSafeExternalUrl(params.linkURL);
    menu.append(new MenuItem({
      label: '打开链接',
      enabled: canOpen,
      click: () => (isTrusted(params.linkURL) ? wc.loadURL(params.linkURL) : openSafeExternal(params.linkURL)),
    }));
    menu.append(new MenuItem({ label: '复制链接地址', click: () => clipboard.writeText(params.linkURL) }));
    menu.append(new MenuItem({ type: 'separator' }));
  }

  if (params.isEditable) {
    const f = params.editFlags || {};
    menu.append(new MenuItem({ label: '剪切', role: 'cut', enabled: !!f.canCut }));
    menu.append(new MenuItem({ label: '复制', role: 'copy', enabled: !!f.canCopy }));
    menu.append(new MenuItem({ label: '粘贴', role: 'paste', enabled: !!f.canPaste }));
    menu.append(new MenuItem({ label: '全选', role: 'selectAll' }));
    menu.append(new MenuItem({ type: 'separator' }));
  } else if (params.selectionText) {
    menu.append(new MenuItem({ label: '复制', role: 'copy' }));
    menu.append(new MenuItem({ type: 'separator' }));
  }

  menu.append(new MenuItem({ label: '刷新 (F5)', click: () => wc.reload() }));
  menu.append(new MenuItem({ label: '开发者工具 (F12)', click: () => wc.toggleDevTools() }));
  menu.popup({ window: ctx.win });
}

module.exports = { probeImageAt, showContextMenu };

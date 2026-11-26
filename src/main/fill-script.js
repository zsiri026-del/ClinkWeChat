'use strict';

function buildFillScript(cno, account, password, force) {
  const C = JSON.stringify(cno || '');
  const A = JSON.stringify(account || '');
  const P = JSON.stringify(password || '');
  const F = force ? 'true' : 'false';
  return `(function(){
  try {
    var C=${C}, A=${A}, P=${P}, FORCE=${F};
    function vis(el){
      if(!el) return false;
      var r=el.getBoundingClientRect(), s=getComputedStyle(el);
      return el.offsetParent!==null && r.width>2 && r.height>2 &&
        s.visibility!=='hidden' && s.display!=='none' && !el.disabled && !el.readOnly;
    }
    function setVal(el,val){
      if(!el) return false;
      var d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');
      if(d&&d.set){ d.set.call(el,val); } else { el.value=val; }
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }
    function pick(sels){
      for(var i=0;i<sels.length;i++){
        var els=document.querySelectorAll(sels[i]);
        for(var j=0;j<els.length;j++){ if(vis(els[j])) return els[j]; }
      }
      return null;
    }

    var pwdEl = pick(['input[type=password]']);
    if(!pwdEl) return {ok:false, reason:'no-password'};

    var ae=document.activeElement;
    if(!FORCE && ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.type!=='hidden' && ae!==pwdEl && ae.value){
      return {ok:false, reason:'user-typing'};
    }

    var cnoEl = pick(['input[name=cno]','input#cno','input[name=companyNo]','input[name=companyno]',
      'input[placeholder*="企业"]','input[placeholder*="公司"]']);
    var userEl = pick(['input[name=identifier]','input#identifier','input[type=email]',
      'input[name=username]','input[name=userName]','input[name=account]','input[name=loginName]',
      'input[placeholder*="账号"]','input[placeholder*="用户"]','input[placeholder*="工号"]']);

    if(!cnoEl || !userEl || userEl===cnoEl){
      var texts=[], all=document.querySelectorAll('input');
      for(var k=0;k<all.length;k++){
        var el=all[k];
        if(el===pwdEl || !vis(el)) continue;
        var t=(el.type||'text').toLowerCase();
        if(/^(checkbox|radio|hidden|submit|button|file|search)$/.test(t)) continue;
        texts.push(el);
      }
      if(!userEl) userEl = texts.filter(function(x){ return x!==cnoEl; })[0] || null;
      if(!cnoEl && texts.length>=2 && userEl) cnoEl = texts.filter(function(x){ return x!==userEl; })[0] || null;
    }
    if(userEl===cnoEl) userEl=null;

    var filled={cno:false, user:false, pwd:false};
    if(cnoEl && C) filled.cno = setVal(cnoEl, C);
    if(userEl && A) filled.user = setVal(userEl, A);
    filled.pwd = setVal(pwdEl, P);
    try{ if(userEl){ userEl.focus(); userEl.blur(); } pwdEl.focus(); pwdEl.blur(); }catch(e){}
    return {ok:true, filled:filled, hasCno:!!cnoEl, hasUser:!!userEl, url:location.href};
  } catch(e){ return {ok:false, reason:String((e&&e.message)||e)}; }
})()`;
}

module.exports = { buildFillScript };

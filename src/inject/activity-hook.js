(function () {
  if (window.__cwHooked) return 'already-hooked';
  window.__cwHooked = true;
  function ping(reason) {
    try { if (typeof window.__cwPing === 'function') window.__cwPing(reason); } catch (e) {}
  }
  function fnv1a(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }
  /* 1. 提示音拦截（零轮询） */
  try {
    var proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    if (proto && typeof proto.play === 'function' && !proto.__cwPatched) {
      var origPlay = proto.play;
      proto.play = function patchedPlay() {
        try { if (!this.muted && this.volume > 0) ping('audio'); } catch (e) {}
        return origPlay.apply(this, arguments);
      };
      proto.__cwPatched = true;
    }
  } catch (e) {}
  /* 2. 桌面通知拦截（零轮询） */
  try {
    var Native = window.Notification;
    if (typeof Native === 'function' && !Native.__cwPatched) {
      var Patched = function Notification(title, options) {
        ping('notification');
        return new Native(title, options);
      };
      Patched.__cwPatched = true;
      Patched.permission = Native.permission;
      Patched.maxActions = Native.maxActions;
      Patched.requestPermission = Native.requestPermission
        ? Native.requestPermission.bind(Native)
        : function () { return Promise.resolve('default'); };
      window.Notification = Patched;
    }
  } catch (e) {}
  /* 3. 登录表单事件捕获（零 setInterval、无 innerText 重排、不滞留明文密码） */
  try {
    var lastDigest = '';
    var LOGIN_BTN_RE = /^(登录|登录系统|立即登录|登入|提交|login|signin)$/i;
    function readLoginForm() {
      var pwd = document.querySelector('input[type=password]');
      if (!pwd || !pwd.value) return null;
      var cnoEl = document.querySelector('input[name=cno], input#cno');
      var userEl = document.querySelector('input[name=identifier], input#identifier, input[type=email]');
      if (!userEl) {
        var all = document.querySelectorAll('input');
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          if (el === pwd || el.type === 'password') continue;
          var t = (el.type || 'text').toLowerCase();
          if (/^(checkbox|radio|hidden|submit|button|file)$/.test(t)) continue;
          if (el.value) { userEl = el; break; }
        }
      }
      if (!userEl || !userEl.value) return null;
      return { cno: cnoEl ? cnoEl.value : '', account: userEl.value, password: pwd.value };
    }
    function captureNow() {
      var v = readLoginForm();
      if (!v || !v.account || !v.password) return;
      var digest = fnv1a(v.cno + '|' + v.account + '|' + v.password);
      if (digest === lastDigest) { v.password = ''; return; }
      lastDigest = digest;
      try { if (typeof window.__cwRememberLogin === 'function') window.__cwRememberLogin(v); } catch (e) {}
      v.password = '';
    }
    document.addEventListener('focusout', function (ev) {
      if (ev.target && ev.target.type === 'password') captureNow();
    }, true);
    document.addEventListener('submit', captureNow, true);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && ev.target && ev.target.type === 'password') captureNow();
    }, true);
    document.addEventListener('click', function (ev) {
      if (!document.querySelector('input[type=password]')) return;
      var el = ev.target;
      for (var d = 0; d < 6 && el && el !== document.body; d++, el = el.parentElement) {
        var txt = String(el.textContent || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, '');
        if (txt.length <= 12 && LOGIN_BTN_RE.test(txt)) { captureNow(); return; }
      }
    }, true);
    window.addEventListener('pagehide', captureNow, { once: true });
  } catch (e) {}
  return 'ok';
})();

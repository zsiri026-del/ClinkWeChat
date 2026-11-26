'use strict';

(function () {
  const Shell = window.Shell;
  const { $, onCleanup, flashToast, setPageTitle } = Shell;

  function applyStatus({ state, desc }) {
    const dot = $('statusDot');
    const overlay = $('overlay');
    const loadingView = $('loadingView');
    const errorView = $('errorView');
    if (dot) dot.dataset.state = state;

    if (state === 'loading') {
      if (!Shell.hasLoadedOnce) {
        overlay.classList.remove('hidden');
        loadingView.classList.remove('hidden');
        errorView.classList.add('hidden');
      }
    } else if (state === 'ready') {
      Shell.hasLoadedOnce = true;
      overlay.classList.add('hidden');
    } else if (state === 'error') {
      overlay.classList.remove('hidden');
      loadingView.classList.add('hidden');
      errorView.classList.remove('hidden');
      $('errDesc').textContent = desc || '请检查网络后重试';
    }
  }

  function init() {
    onCleanup(window.app.onStatus(applyStatus));
    window.app.siteState().then((s) => s && applyStatus(s)).catch(() => {});

    onCleanup(window.app.onTitle((title) => {
      const clean = (title || '').replace(/客户联络中心|Clink/gi, '').trim();
      setPageTitle(clean);
    }));

    onCleanup(window.app.onHostInfo(({ version, target }) => {
      $('verText').textContent = 'v' + version;
      try { $('ovSub').textContent = new URL(target).hostname; } catch {}
    }));

    onCleanup(window.app.onSaved(({ name }) => flashToast('已保存：' + name, 5000)));
    onCleanup(window.app.onRemembered(({ account, cno }) => {
      flashToast('已记住账号 ' + (cno ? cno + ' / ' : '') + account + '，下次自动填入', 9000);
    }));
    onCleanup(window.app.onAutoFilled(({ account, label }) => {
      flashToast('已填入账号 ' + (label || account) + '，完成滑块验证后点击登录', 10000);
    }));
  }

  window.Shell.status = { init, applyStatus };
})();

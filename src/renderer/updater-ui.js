'use strict';

(function () {
  const Shell = window.Shell;
  const { $, onCleanup, flashToast } = Shell;
  let lastState = null;
  let announcedReadyVer = '';

  function render(st) {
    if (!st) return;
    lastState = st;
    const pill = $('updatePill');
    const menuTxt = $('checkUpdateText');

    if (st.status === 'ready') {
      const label = st.mode === 'hot' ? `↑ 热更 v${st.latestVersion} · 重启生效` : `↑ 新版 v${st.latestVersion} · 点击安装`;
      if (pill) { pill.textContent = label; pill.classList.remove('hidden'); }
      if (menuTxt) menuTxt.textContent = `立即应用更新 (v${st.latestVersion})`;
      if (announcedReadyVer !== st.latestVersion) {
        announcedReadyVer = st.latestVersion;
        flashToast(`新版本 v${st.latestVersion} 已在后台准备就绪，点击右上角即可生效`, 10000);
      }
      return;
    }

    if (pill) pill.classList.add('hidden');
    if (!menuTxt) return;
    if (st.status === 'checking') menuTxt.textContent = '正在检查更新…';
    else if (st.status === 'downloading') menuTxt.textContent = `正在后台下载 v${st.latestVersion}…`;
    else menuTxt.textContent = '检查更新…';
  }

  async function onCheckClick() {
    $('popup').classList.add('hidden');
    Shell.syncOverlay();
    if (lastState && lastState.status === 'ready') {
      await window.app.update.apply();
      return;
    }
    flashToast('正在检查新版本…', 3000);
    const st = await window.app.update.check().catch(() => null);
    if (!st) return;
    render(st);
    if (st.status === 'up-to-date') flashToast(`当前已是最新版本 (v${st.currentVersion})`, 4000);
    else if (st.status === 'error') flashToast('检查更新失败：' + (st.error || '网络异常'), 5000);
  }

  function init() {
    const pill = $('updatePill');
    const menuBtn = $('miCheckUpdate');
    const onApply = () => window.app.update.apply();
    if (pill) pill.addEventListener('click', onApply);
    if (menuBtn) menuBtn.addEventListener('click', onCheckClick);

    onCleanup(window.app.update.onState(render));
    onCleanup(() => {
      if (pill) pill.removeEventListener('click', onApply);
      if (menuBtn) menuBtn.removeEventListener('click', onCheckClick);
    });

    window.app.update.state().then(render).catch(() => {});
  }

  window.Shell.updater = { init };
})();

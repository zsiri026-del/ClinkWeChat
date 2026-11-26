'use strict';

(function () {
  const { $, onCleanup, flashToast } = window.Shell;
  let timer = null;
  let busy = false;

  function renderMem(stats) {
    if (!stats || typeof stats.totalMB !== 'number') return;
    const pill = $('memPill');
    const text = $('memText');
    if (!pill || !text) return;
    text.textContent = stats.totalMB + ' MB';
    pill.classList.toggle('warn', stats.totalMB >= 360 && stats.totalMB < 520);
    pill.classList.toggle('high', stats.totalMB >= 520);
    pill.title = `总内存 ${stats.totalMB} MB（主进程 ${stats.mainMB} / 页面 ${stats.rendererMB} / GPU ${stats.gpuMB}）· 点击立即释放`;
  }

  async function pollOnce() {
    if (document.visibilityState !== 'visible') return;
    try {
      renderMem(await window.app.memoryStats());
    } catch {}
  }

  function startPoll() {
    stopPoll();
    pollOnce();
    timer = setInterval(pollOnce, 12000);
  }

  function stopPoll() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function runOptimize() {
    if (busy) return;
    busy = true;
    try {
      const r = await window.app.memoryOptimize();
      if (r && r.stats) renderMem(r.stats);
      const msg = r && r.freedMB > 0
        ? `缓存已清理，释放约 ${r.freedMB} MB（当前 ${r.afterMB} MB）`
        : `缓存已清理，内存保持轻量（${(r && r.afterMB) || '--'} MB）`;
      flashToast(msg, 4500);
    } catch {
      flashToast('内存清理失败', 3000);
    } finally {
      busy = false;
    }
  }

  function init() {
    const onVis = () => (document.visibilityState === 'visible' ? startPoll() : stopPoll());
    document.addEventListener('visibilitychange', onVis);
    const pill = $('memPill');
    const railBtn = $('railBoostBtn');
    if (pill) pill.addEventListener('click', runOptimize);
    if (railBtn) railBtn.addEventListener('click', runOptimize);

    onCleanup(window.app.onMemoryOptimized((r) => r && r.stats && renderMem(r.stats)));
    onCleanup(() => {
      stopPoll();
      document.removeEventListener('visibilitychange', onVis);
      if (pill) pill.removeEventListener('click', runOptimize);
      if (railBtn) railBtn.removeEventListener('click', runOptimize);
    });

    if (document.visibilityState === 'visible') startPoll();
  }

  window.Shell.memory = { init, runOptimize };
})();

'use strict';

(function () {
  const { $, onCleanup, flashToast } = window.Shell;
  const THEMES = ['aurora', 'twilight', 'ocean', 'sunset'];
  const LABELS = {
    aurora: '极光翠绿',
    twilight: '暮光靛紫',
    ocean: '晴空蔚蓝',
    sunset: '暖阳琥珀',
  };

  let current = 'aurora';

  function apply(name) {
    current = THEMES.includes(name) ? name : 'aurora';
    document.documentElement.setAttribute('data-theme', current);
    const bar = $('themeBar');
    if (bar) {
      bar.querySelectorAll('.swatch').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.themePick === current);
      });
    }
  }

  async function select(name, notify) {
    apply(name);
    try {
      await window.app.settings.set({ theme: current });
    } catch {}
    if (notify) flashToast('已切换主题：' + (LABELS[current] || current), 2600);
  }

  function init() {
    const cycleBtn = $('themeCycleBtn');
    const onCycle = () => {
      const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
      select(next, true);
    };
    if (cycleBtn) cycleBtn.addEventListener('click', onCycle);

    const bar = $('themeBar');
    const onPick = (e) => {
      const btn = e.target.closest('[data-theme-pick]');
      if (btn) select(btn.dataset.themePick, true);
    };
    if (bar) bar.addEventListener('click', onPick);

    onCleanup(() => {
      if (cycleBtn) cycleBtn.removeEventListener('click', onCycle);
      if (bar) bar.removeEventListener('click', onPick);
    });
  }

  window.Shell.theme = { init, apply, select };
})();

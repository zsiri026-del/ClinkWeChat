'use strict';

(function () {
  const Shell = window.Shell;
  const { $, onCleanup } = Shell;
  let closeTimer = null;

  function tip(msg, cls) {
    const el = $('accTip');
    el.textContent = msg || '';
    el.className = 'acc-tip' + (cls ? ' ' + cls : '');
  }

  function closeLogin() { $('loginModal').classList.add('hidden'); Shell.syncOverlay(); }

  async function doLogin(id) {
    tip('正在定位登录框并填充…');
    let r = null;
    try { r = await window.app.accounts.login(id); } catch (err) { r = { ok: false, reason: String(err) }; }
    if (r && r.ok) {
      tip('已填入账号密码，拖动滑块验证后点「登录系统」', 'ok');
      clearTimeout(closeTimer);
      closeTimer = setTimeout(closeLogin, 1100);
    } else {
      const map = { 'no-password': '未找到密码框，请等登录页加载完成后再试', 'not-found': '账号记录不存在', 'no-view': '工作台页面未就绪' };
      tip(map[r && r.reason] || '填充失败：' + ((r && r.reason) || '未知错误'), 'err');
    }
  }

  async function saveAccount(withLogin) {
    const label = $('accLabel').value.trim();
    const cno = $('accCno').value.trim();
    const account = $('accUser').value.trim();
    const pwd = $('accPwd').value;
    if (!account) return tip('请先填账号 / 工号', 'err');
    if (!pwd) return tip('请先填密码', 'err');
    const saved = await window.app.accounts.save({ label, cno, account, pwd });
    $('accPwd').value = '';
    await Shell.renderAccountList();
    if (!saved || !saved.ok) return tip('保存失败', 'err');
    tip('已加密保存到本机', 'ok');
    if (withLogin) doLogin(saved.id);
  }

  function openLogin() {
    $('popup').classList.add('hidden');
    $('loginModal').classList.remove('hidden');
    Shell.syncOverlay();
    tip('账号密码仅加密保存在本机，填好滑块验证后点「登录系统」即可。');
    Shell.renderAccountList();
    $('accUser').focus();
    window.app.accounts.list().then((list) => {
      const first = list && list[0];
      if (!first) return;
      if (!$('accCno').value) $('accCno').value = first.cno || '';
      if (!$('accUser').value) $('accUser').value = first.account || '';
      if (!$('accLabel').value) $('accLabel').value = first.label || '';
    }).catch(() => {});
  }

  function init() {
    const listEl = $('accList');
    const onListClick = async (e) => {
      const del = e.target.closest('[data-del-id]');
      if (del) {
        e.stopPropagation();
        await window.app.accounts.remove(del.dataset.delId);
        await Shell.renderAccountList();
        tip('已删除账号', 'ok');
        return;
      }
      const row = e.target.closest('.acc-row');
      if (row && row.dataset.id) doLogin(row.dataset.id);
    };
    listEl.addEventListener('click', onListClick);

    const bind = (id, fn) => { const el = $(id); if (el) { el.addEventListener('click', fn); onCleanup(() => el.removeEventListener('click', fn)); } };
    bind('loginBtn', (e) => { e.stopPropagation(); openLogin(); });
    bind('miLogin', openLogin);
    bind('loginClose', closeLogin);
    bind('loginMask', closeLogin);
    bind('accSaveLogin', () => saveAccount(true));
    bind('accSaveOnly', () => saveAccount(false));

    const pwdEl = $('accPwd');
    const onEnter = (e) => { if (e.key === 'Enter') saveAccount(true); };
    pwdEl.addEventListener('keydown', onEnter);

    onCleanup(() => {
      clearTimeout(closeTimer);
      listEl.removeEventListener('click', onListClick);
      pwdEl.removeEventListener('keydown', onEnter);
    });
  }

  window.Shell.accounts = { init };
})();

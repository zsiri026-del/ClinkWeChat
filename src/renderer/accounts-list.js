'use strict';

(function () {
  const { $ } = window.Shell;

  async function renderAccountList() {
    let list = [];
    try { list = (await window.app.accounts.list()) || []; } catch {}
    const box = $('accList');
    box.textContent = '';

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'acc-empty';
      empty.textContent = '还没有保存的账号，填下方表单即可保存';
      box.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const acc of list) {
      const row = document.createElement('div');
      row.className = 'acc-row';
      row.dataset.id = acc.id;
      row.title = '点击自动填入账号密码';

      const ava = document.createElement('div');
      ava.className = 'acc-ava';
      ava.textContent = String(acc.label || acc.account || '?').slice(0, 1).toUpperCase();

      const meta = document.createElement('div');
      meta.className = 'acc-meta';
      const name = document.createElement('div');
      name.className = 'acc-name';
      name.textContent = acc.label || acc.account;
      const sub = document.createElement('div');
      sub.className = 'acc-sub';
      sub.textContent = acc.cno ? `${acc.cno} · ${acc.account}` : acc.account;
      meta.append(name, sub);

      const del = document.createElement('button');
      del.className = 'acc-del';
      del.dataset.delId = acc.id;
      del.title = '删除账号';
      del.textContent = '×';

      row.append(ava, meta, del);
      frag.appendChild(row);
    }
    box.appendChild(frag);
  }

  window.Shell.renderAccountList = renderAccountList;
})();

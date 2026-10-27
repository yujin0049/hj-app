/* 내일 할 일 (#/todo, #/tomorrow→todo): data/todo.json 한 장 리스트.
   구글검색형·피드형 금지. 봇이 json만 갈아끼우면 갱신. 타 문서시스템명 금지 · 코러스만. */
(function (root) {
  'use strict';
  var data = null;
  var CSS = [
    '.td-wrap{max-width:680px;margin:0 auto;padding:0 12px 48px;box-sizing:border-box}',
    '.td-head{padding:8px 2px 4px}.td-head h1{margin:0 0 4px;font-size:1.35rem;letter-spacing:-.02em}',
    '.td-head .td-date{font-size:.9rem;color:var(--muted);font-weight:700}',
    '.td-head .td-note{font-size:.8rem;color:var(--muted);margin:4px 0 0;line-height:1.4}',
    '.td-item{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:0 0 8px;text-align:left;width:100%;box-sizing:border-box}',
    '.td-num{flex:0 0 1.6rem;font-weight:800;color:var(--muted);font-size:.9rem;padding-top:2px}',
    '.td-body{min-width:0;flex:1}',
    '.td-body b{display:block;font-size:.98rem;line-height:1.35;margin:0 0 4px}',
    '.td-meta{font-size:.82rem;color:var(--ink-2);line-height:1.4;margin:2px 0}',
    '.td-path{font-size:.76rem;color:var(--muted);line-height:1.35;word-break:break-all;margin:4px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
    '.td-badge{flex:0 0 auto;font-size:.72rem;font-weight:700;border-radius:8px;padding:3px 8px;white-space:nowrap;background:var(--soft);color:var(--ink-2)}',
    '.td-badge.ok{background:var(--okbg);color:var(--ok)}',
    '.td-empty{text-align:center;padding:24px 8px;color:var(--muted)}'
  ].join('\n');

  function style() {
    if (document.getElementById('td-style')) return;
    var s = document.createElement('style');
    s.id = 'td-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function load() {
    return fetch(new URL('data/todo.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('todo'); return r.json(); })
      .then(function (j) { data = j; return j; })
      .catch(function () { data = null; return null; });
  }
  function fmtDate(d) {
    if (!d || typeof d !== 'string') return '';
    var m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return d;
    return Number(m[2]) + '.' + Number(m[3]) + '.';
  }
  function paint(el, api) {
    var esc = api.esc;
    var items = (data && data.items) || [];
    var title = (data && data.title) || '내일 할 일';
    var dateLabel = fmtDate(data && data.date);
    var h = '<div class="td-wrap"><section class="td-head"><h1>' + esc(title) + '</h1>' +
      (dateLabel ? '<div class="td-date">' + esc(dateLabel) + ' 시드 · ' + items.length + '건</div>' : '') +
      '<p class="td-note">한 장 체크리스트. 자료는 data/todo.json (봇이 갈아끼움).</p></section>';
    if (!items.length) {
      h += '<section class="card td-empty">할 일이 없어요.</section></div>';
      el.innerHTML = h;
      return;
    }
    items.forEach(function (it, i) {
      var done = !!it.done;
      h += '<div class="td-item" data-id="' + esc(it.id || ('t' + (i + 1))) + '">' +
        '<span class="td-num">' + (i + 1) + '</span>' +
        '<div class="td-body"><b>' + esc(it.title || '') + '</b>' +
        (it.note ? '<div class="td-meta">' + esc(it.note) + '</div>' : '') +
        (it.path ? '<div class="td-path">' + esc(it.path) + '</div>' : '') +
        '</div>' +
        '<span class="td-badge' + (done ? ' ok' : '') + '">' + (done ? '끝' : '할 일') + '</span>' +
        '</div>';
    });
    h += '</div>';
    el.innerHTML = h;
  }
  function render(el, api) {
    style();
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    load().then(function (d) {
      if (!d) {
        el.innerHTML = '<section class="card"><p>⚠ 자료(data/todo.json)를 못 불러왔어요. 새로고침해 주세요.</p></section>';
        return;
      }
      paint(el, api);
    });
  }
  if (root.ShellModules) root.ShellModules.todo = { id: 'todo', tab: '내일', icon: '', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

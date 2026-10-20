/* 확인 필요: 스크립트 대조 결과(data/checks.json) 중 불일치·판단 불가만 사람에게 보여요.
   누른 결과(맞음/고침)는 이 기기 localStorage 에만 저장해요. 이름·연락처 없음. */
(function () {
  'use strict';
  var KEY = 'hj-check-marks';
  var STALE_MS = 24 * 3600 * 1000;
  var showAll = false;
  var cache = null;

  function marks() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function setMark(id, v) {
    var m = marks();
    m[id] = { v: v, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(m)); return true; } catch (e) { return false; }
  }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return String(iso || '');
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getMonth() + 1) + '.' + p(d.getDate()) + '. ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function stale(iso) {
    var t = new Date(iso).getTime();
    return isNaN(t) || Date.now() - t > STALE_MS;
  }
  function load() {
    if (cache) return Promise.resolve(cache);
    return fetch(new URL('data/checks.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('checks.json'); return r.json(); })
      .then(function (j) { cache = Array.isArray(j) ? j : []; return cache; });
  }

  function badge(res) {
    if (res === '일치') return '<span class="badge ok">일치</span>';
    if (res === '불일치') return '<span class="badge no">불일치</span>';
    return '<span class="badge warn">판단 불가</span>';
  }

  function card(api, c, m) {
    var mk = m[c.id];
    var h = '<article class="card check-item" data-item="' + api.esc(c.id) + '">' +
      '<div class="row">' + badge(c['결과']) + (stale(c.computed_at) ? ' <span class="badge ref" data-stale>오래됨</span>' : '') +
      (c.sample ? ' <span class="badge ref">예시 데이터</span>' : '') + '</div>' +
      '<h2 style="margin:8px 0 4px">' + api.esc(c['항목']) + '</h2>' +
      '<p style="margin:4px 0"><b>' + api.esc(c['값']) + '</b> <span class="muted">vs ' + api.esc(c['비교값']) + '</span></p>' +
      '<p class="item-meta">근거: ' + api.esc(c['근거']) + '</p>' +
      '<p class="item-meta">계산 ' + api.esc(when(c.computed_at)) + ' · ' + api.esc(c.source || '') + '</p>';
    if (mk) h += '<p class="' + (mk.v === '맞음' ? 'okbox' : 'warnbox') + '" style="margin:8px 0" data-mark>' + api.esc(mk.v) + ' 눌렀어요 · ' + api.esc(when(mk.at)) + '</p>';
    h += '<div class="row" style="margin-top:8px">' +
      '<button class="btn small" type="button" data-ok="' + api.esc(c.id) + '" style="flex:1">맞음</button>' +
      '<button class="btn-ghost small" type="button" data-fix="' + api.esc(c.id) + '" style="flex:1">고침</button></div></article>';
    return h;
  }

  function paint(el, api, list) {
    var m = marks();
    var need = list.filter(function (c) { return c['결과'] !== '일치'; });
    var shown = showAll ? list : need;
    var rate = list.length ? Math.round((list.length - need.length) / list.length * 100) : 0;
    var anySample = list.some(function (c) { return c.sample; });
    var h = '<button class="linkish" id="back" type="button">← 업무현황표</button>' +
      '<section class="card"><h1>확인 필요</h1>' +
      '<p class="muted">스크립트가 숫자를 대조했어요. 불일치·판단 불가만 여기 올라와요.</p>' +
      (anySample ? '<div class="warnbox">예시 데이터예요. 실제 값이 아니에요.</div>' : '') +
      '<div class="statgrid" style="margin-top:12px"><div><b id="n-all">' + list.length + '</b><span>전체</span></div>' +
      '<div><b id="n-need">' + need.length + '</b><span>확인 필요</span></div>' +
      '<div><b id="n-rate">' + rate + '%</b><span>자동 확정률</span></div>' +
      '<div><b>' + Object.keys(m).filter(function (k) { return list.some(function (c) { return c.id === k; }); }).length + '</b><span>내가 누름</span></div></div>' +
      '<p class="muted" style="margin-top:10px">전체 ' + list.length + '건 중 확인 필요 ' + need.length + '건</p>' +
      '<label class="opt"><input type="checkbox" id="show-all"' + (showAll ? ' checked' : '') + '> 일치도 보기</label></section>';
    if (!shown.length) h += '<section class="card"><p>확인할 게 없어요.</p></section>';
    shown.forEach(function (c) { h += card(api, c, m); });
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/board'); };
    el.querySelector('#show-all').onchange = function (e) { showAll = e.target.checked; paint(el, api, list); };
    function press(attr, v) {
      el.querySelectorAll('[' + attr + ']').forEach(function (b) {
        b.onclick = function () {
          var ok = setMark(b.getAttribute(attr), v);
          api.toast(ok ? v + '(으)로 저장했어요.' : '저장하지 못했어요.');
          paint(el, api, list);
        };
      });
    }
    press('data-ok', '맞음');
    press('data-fix', '고침');
  }

  function render(el, api) {
    var tb = document.querySelector('.tabs [data-tab="board"]'); /* 업무 탭 밑 화면 (app.js 안 건드림) */
    if (tb) tb.classList.add('on');
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    load().then(function (list) { paint(el, api, list); }).catch(function () {
      el.innerHTML = '<section class="card"><h1>확인 필요</h1><p>대조 결과 파일을 불러오지 못했어요.</p></section>';
    });
  }

  window.ShellModules = window.ShellModules || {};
  window.ShellModules.check = { id: 'check', tab: '확인 필요', render: render, count: function () {
    return load().then(function (l) { return l.filter(function (c) { return c['결과'] !== '일치'; }).length; });
  } };
})();

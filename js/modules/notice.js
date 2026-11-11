/* 남해캠 공지사항 (#/notice) — 261111 춘식이 kv(대장 전달 「앱에 적용해」). 국립창원대 남해캠퍼스 공지 게시판 공개 글 목록.
   화면: #/notice?q=&y=&dept= · 검색(제목·부서·첨부 이름·요약) · 연도/부서 거르기 · 최신순 · 원문 링크(새 창).
   자료: data/notices.json(목차) + data/notices/YYYY.json(연도별, 필요한 해만 받음). 생성기 tools/make_notices.py(refresh_all 에서 갱신).
   본문 전문 없음: 앞부분 짧게만. 개인정보 꼴 있는 글은 「개인정보 포함·원문 링크만」, 이미지 본문은 「본문 이미지·원문 보기」. 자료 없으면 「데이터 없음」. */
(function (root) {
  'use strict';
  var NODATA = '데이터 없음';
  var PAGE = 20;
  var CSS = [
    '.nt-wrap{max-width:760px;margin:0 auto;padding:0 0 48px;box-sizing:border-box}',
    '.nt-head{padding:8px 0 6px}.nt-head h1{margin:0 0 4px;font-size:1.35rem;letter-spacing:-.02em}',
    '.nt-head p{margin:0;font-size:.86rem;color:var(--muted);line-height:1.45}',
    '.nt-bar{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 0 4px}',
    '.nt-bar .nt-q{grid-column:1/-1}',
    '.nt-bar input,.nt-bar select{width:100%;box-sizing:border-box;border:1px solid var(--line) !important;border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;background-color:#fff !important;min-height:44px}',
    '.nt-bar input:focus,.nt-bar select:focus{border-color:var(--navy) !important;outline:0}',
    '.nt-count{font-size:.82rem;color:var(--muted);margin:6px 0 8px}',
    '.nt-list{list-style:none;margin:0;padding:0}',
    '.nt-item{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:9px 13px;margin:0 0 6px}',
    '.nt-top{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:.8rem;color:var(--ink-2);margin:0 0 4px}',
    '.nt-dept{font-weight:800;color:var(--ink)}',
    '.nt-date{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--muted);font-weight:600}',
    '.nt-t{display:block;font-size:.94rem;font-weight:700;line-height:1.4;color:var(--ink);text-decoration:none;word-break:keep-all;overflow-wrap:anywhere;min-height:24px}',
    '.nt-t:hover{text-decoration:underline}',
    '.nt-s{font-size:.86rem;color:var(--ink-2);line-height:1.45;margin:4px 0 0;overflow-wrap:anywhere}',
    '.nt-tag{display:inline-block;border-radius:6px;padding:2px 7px;font-size:.78rem;font-weight:700;background:var(--soft);color:var(--ink-2)}',
    '.nt-tag.pii{background:var(--warnbg);color:var(--warn)}',
    '.nt-f{font-size:.8rem;color:var(--muted);margin:4px 0 0;overflow-wrap:anywhere}',
    '.nt-more{width:100%;min-height:44px;margin-top:8px;border:1px solid var(--line);background:#fff;border-radius:12px;font:inherit;font-weight:700;color:var(--navy);cursor:pointer}',
    '.nt-empty{text-align:center;padding:24px 8px;color:var(--muted);background:var(--card);border-radius:14px;border:1px solid var(--line)}',
    '.nt-foot{font-size:.8rem;color:var(--muted);margin:12px 0 0;line-height:1.5}'
  ].join('\n');
  var st = { index: null, years: {}, q: '', y: '', dept: '', shown: PAGE };

  function style() {
    if (document.getElementById('nt-style')) return;
    var s = document.createElement('style'); s.id = 'nt-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function getJson(f) {
    return fetch(new URL(f, document.baseURI).href, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(f); return r.json(); });
  }
  function core() {
    if (root.HJNotice) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = new URL('js/notice-core.js?v=1', document.baseURI).href;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('js/notice-core.js')); };
      document.body.appendChild(s);
    });
  }
  function loadYears(list) {
    return Promise.all(list.map(function (y) {
      if (st.years[y.y]) return st.years[y.y];
      return getJson(y.file).then(function (j) { st.years[y.y] = (j && j.rows) || []; return st.years[y.y]; });
    }));
  }
  function md(d) { var p = String(d || '').split('-'); return p.length === 3 ? p[0].slice(2) + '.' + Number(p[1]) + '.' + Number(p[2]) + '.' : ''; }
  function ymd(d) { var p = String(d || '').split('-'); return p.length === 3 ? p[0] + '.' + Number(p[1]) + '.' + Number(p[2]) + '.' : ''; }
  function fmtN(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function qparse(q) {
    var o = {};
    String(q || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1);
      try { o[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { o[k] = v; }
    });
    return o;
  }
  function syncHash() {
    var p = [];
    if (st.q) p.push('q=' + encodeURIComponent(st.q));
    if (st.y) p.push('y=' + encodeURIComponent(st.y));
    if (st.dept) p.push('dept=' + encodeURIComponent(st.dept));
    var h = '#/notice' + (p.length ? '?' + p.join('&') : '');
    if (location.hash !== h && root.history && history.replaceState) history.replaceState(null, '', h);
  }
  function item(esc, r) {
    var N = root.HJNotice, u = N.url(st.index, r.id), lab = N.kindLabel(r.k);
    var f = r.f || [];
    return '<li class="nt-item"><div class="nt-top"><span class="nt-dept">' + esc(r.dept || NODATA) + '</span>' +
      (r.no != null ? '<span>No.' + esc(String(r.no)) + '</span>' : '') +
      (r.v != null ? '<span>조회 ' + fmtN(r.v) + '</span>' : '') +
      '<span class="nt-date">' + esc(md(r.d)) + '</span></div>' +
      (u ? '<a class="nt-t" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(r.t) + ' <span aria-hidden="true">↗</span></a>' : '<b class="nt-t">' + esc(r.t) + '</b>') +
      '<p class="nt-s">' + (r.k === 'ok' && r.s ? esc(r.s) : '<span class="nt-tag' + (r.k === 'pii' ? ' pii' : '') + '">' + esc(lab || NODATA) + '</span>') + '</p>' +
      (f.length ? '<p class="nt-f">📎 ' + esc(f.slice(0, 2).join(' · ')) + (f.length > 2 ? ' 외 ' + (f.length - 2) + '개' : '') + '</p>' : '') + '</li>';
  }
  function head(esc) {
    var ix = st.index, c = ix.counts || {};
    return '<div class="nt-head"><h1>남해캠 공지사항</h1><p>국립창원대 남해캠퍼스 공지 게시판 공개 글 <b id="nt-total">' + fmtN(ix.n) + '</b>건 · ' +
      esc(ymd(ix.date_min)) + '~' + esc(ymd(ix.date_max)) + ' · 본문은 앞부분만, 전문은 원문에서</p>' +
      '<p>개인정보 포함 ' + fmtN(c.pii) + ' · 본문 이미지 ' + fmtN(c.img) + ' · 본문 못 받음 ' + fmtN(c.fail) + ' (요약 대신 원문 링크)</p></div>';
  }
  function bar(esc) {
    var ix = st.index;
    var ys = '<option value="">연도 전체</option>' + (ix.years || []).map(function (y) {
      return '<option value="' + esc(y.y) + '"' + (st.y === y.y ? ' selected' : '') + '>' + esc(y.y) + '년 (' + fmtN(y.n) + ')</option>';
    }).join('');
    var ds = '<option value="">부서 전체</option>' + (ix.depts || []).map(function (d) {
      return '<option value="' + esc(d[0]) + '"' + (st.dept === d[0] ? ' selected' : '') + '>' + esc(d[0]) + ' (' + fmtN(d[1]) + ')</option>';
    }).join('');
    return '<form class="nt-bar" role="search" onsubmit="return false">' +
      '<input class="nt-q" id="nt-q" type="search" enterkeyhint="search" placeholder="제목·부서·첨부 이름 검색" aria-label="공지 검색" value="' + esc(st.q) + '">' +
      '<select id="nt-y" aria-label="연도">' + ys + '</select><select id="nt-dept" aria-label="부서">' + ds + '</select></form>';
  }
  function paintList(box, api) {
    var N = root.HJNotice, esc = api.esc, o = { q: st.q, y: st.y, dept: st.dept };
    var need = N.yearsFor(st.index, o, st.shown + 1);
    var missing = need.filter(function (y) { return !st.years[y.y]; });
    if (missing.length) {
      box.setAttribute('aria-busy', 'true');
      box.innerHTML = '<p class="nt-count">불러오는 중…</p>';
      loadYears(missing).then(function () { if (box.isConnected) paintList(box, api); })
        .catch(function () { box.removeAttribute('aria-busy'); box.innerHTML = '<p class="nt-empty">' + NODATA + ' (인터넷 연결을 확인해 주세요)</p>'; });
      return;
    }
    box.removeAttribute('aria-busy');
    var rows = [];
    need.forEach(function (y) { rows = rows.concat(st.years[y.y] || []); });
    var hit = N.sortRows(N.filter(rows, o));
    var filtered = !!(st.q || st.y || st.dept);
    var total = filtered ? hit.length : st.index.n;
    var h = '<p class="nt-count" id="nt-count">' + (filtered ? '찾은 글 ' : '전체 ') + fmtN(total) + '건 · 최신순</p>';
    if (!hit.length) h += '<p class="nt-empty">' + NODATA + '</p>';
    else h += '<ul class="nt-list">' + hit.slice(0, st.shown).map(function (r) { return item(esc, r); }).join('') + '</ul>';
    if (total > st.shown) h += '<button type="button" class="nt-more" id="nt-more">' + PAGE + '건 더 보기 (' + fmtN(Math.min(st.shown, total)) + ' / ' + fmtN(total) + ')</button>';
    box.innerHTML = h;
    var mo = box.querySelector('#nt-more');
    if (mo) mo.onclick = function () { st.shown += PAGE; paintList(box, api); };
  }
  function paint(el, api) {
    var esc = api.esc;
    var src = st.index.source && st.index.source.indexOf('https://www.namhae.ac.kr/') === 0 ? st.index.source : '';
    el.innerHTML = '<div class="nt-wrap" id="nt">' + head(esc) + bar(esc) + '<div id="nt-list" aria-live="polite"></div>' +
      '<p class="nt-foot">출처: ' + (src ? '<a href="' + esc(src) + '" target="_blank" rel="noopener">남해캠퍼스 공지사항 게시판 ↗</a>' : NODATA) +
      ' · 첨부파일은 이름만(내려받지 않음) · 조회수는 모은 때 기준</p></div>';
    var box = el.querySelector('#nt-list');
    var t = null;
    function again() { st.shown = PAGE; syncHash(); paintList(box, api); }
    el.querySelector('#nt-q').oninput = function (e) { clearTimeout(t); var v = e.target.value; t = setTimeout(function () { st.q = v.trim(); again(); }, 200); };
    el.querySelector('#nt-y').onchange = function (e) { st.y = e.target.value; again(); };
    el.querySelector('#nt-dept').onchange = function (e) { st.dept = e.target.value; again(); };
    paintList(box, api);
  }
  function render(el, api) {
    style();
    var q = qparse(api.route().query);
    st.q = q.q || ''; st.y = /^\d{4}$/.test(q.y || '') ? q.y : ''; st.dept = q.dept || ''; st.shown = PAGE;
    if (st.index) return paint(el, api);
    el.innerHTML = '<section class="card sk" aria-busy="true"><p class="muted">불러오는 중…</p><i></i><i></i><i></i></section>';
    Promise.all([core(), getJson('data/notices.json')]).then(function (a) {
      if (!a[1] || !a[1].n || !(a[1].years || []).length) throw new Error('empty');
      st.index = a[1];
      if (el.isConnected) paint(el, api);
    }).catch(function () {
      el.innerHTML = '<section class="card"><h2>남해캠 공지사항</h2><p class="muted">' + NODATA + '</p></section>';
    });
  }
  if (root.ShellModules) root.ShellModules.notice = { id: 'notice', tab: '공지', icon: '', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

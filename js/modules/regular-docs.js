/* 정례 문서 달력 (#/regular-docs): 문서등록대장 2026.3~10월에서 반복된 문서를 달(3월~2월) 격자로 보여 줘요.
   출처: 유진님 10.22. 「옛다 이거 스프레드 시트로 디자인 좋게 해서 올려봐라」「그리고 사이트에도 넣으라 전해라」(대장 전달).
   자료 data/regular_docs.json(tools/make_regular_docs.py 가 볼트 xlsx 에서 만듦, 사람 이름 없음).
   ● = 그 달에 기록 있음, ○ = 11~2월 예상(매월 문서만). 이번 달 열은 진하게, 다가오는 달의 ○ 는 주황으로.
   화면: #/regular-docs(격자) · #/regular-docs?cat=분류 · #/regular-docs/month/11 */
(function (root) {
  'use strict';
  var data = null;
  var CSS = [
    '.rd-head{padding:4px 2px 0}.rd-head h1{margin:0 0 2px}.rd-head p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45}',
    '.rd-card{background:var(--card);border-radius:20px;padding:16px;margin:12px 0}',
    '.rd-card h2{font-size:1.02rem;margin:0 0 6px;display:flex;justify-content:space-between;align-items:baseline}.rd-card h2 small{font-size:.8rem;color:var(--muted);font-weight:500}',
    '.rd-why{font-size:.78rem;color:var(--muted);margin:0 0 8px;line-height:1.45}',
    '.rd-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 0 4px;scrollbar-width:none}.rd-chips::-webkit-scrollbar{display:none}',
    '.rd-chips button{flex:0 0 auto;border:0;border-radius:999px;padding:7px 12px;background:var(--soft);color:var(--ink-2);font-size:.84rem;font-weight:600;cursor:pointer}',
    '.rd-chips button.on{background:var(--ink);color:#fff}',
    '.rd-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:.76rem;color:var(--ink-2);margin:4px 0 10px}.rd-legend span{display:inline-flex;align-items:center;gap:4px}',
    '.rd-dot{display:inline-block;width:14px;height:14px;border-radius:4px}.rd-dot.rec{background:var(--navy)}.rd-dot.soon{background:var(--warnbg);border:2px solid var(--warn);box-sizing:border-box}.rd-dot.now{background:var(--blue-soft);border:2px solid var(--navy);box-sizing:border-box}',
    '.rd-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -16px;padding:0 16px}',
    '.rd-grid{border-collapse:separate;border-spacing:0;width:100%;min-width:640px;font-size:.8rem}',
    '.rd-grid th,.rd-grid td{padding:0;text-align:center;border-bottom:1px solid var(--line);height:34px}',
    '.rd-grid thead th{font-size:.74rem;color:var(--muted);font-weight:600;position:sticky;top:0;background:var(--card);z-index:1}',
    '.rd-grid thead th button{border:0;background:none;color:inherit;font:inherit;padding:6px 0;width:100%;cursor:pointer}',
    '.rd-grid th.now,.rd-grid td.now{background:var(--blue-soft)}.rd-grid thead th.now{color:var(--navy-2);font-weight:800}',
    '.rd-grid th.doc{position:sticky;left:0;background:var(--card);z-index:2;text-align:left;font-weight:500;color:var(--ink);padding:6px 8px 6px 0;min-width:150px;max-width:44vw;line-height:1.3}',
    '.rd-grid thead th.doc{z-index:3}',
    '.rd-grid th.doc small{display:block;font-size:.68rem;color:var(--muted);font-weight:500}',
    '.rd-grid td i{display:inline-block;width:18px;height:18px;border-radius:5px;vertical-align:middle}',
    '.rd-grid td.rec i{background:var(--navy)}',
    '.rd-grid td.exp i{background:var(--soft);border:2px dashed var(--muted);box-sizing:border-box}',
    '.rd-grid td.soon i{background:var(--warnbg);border:2px solid var(--warn)}',
    '.rd-grid tfoot td{font-size:.72rem;color:var(--muted);font-weight:700;border-bottom:0}.rd-grid tfoot th{font-size:.74rem;color:var(--muted);text-align:left;font-weight:600}',
    '.rd-sep td,.rd-sep th{background:var(--soft)!important;font-size:.72rem;font-weight:700;color:var(--ink-2);text-align:left;height:26px;padding-left:8px}',
    '.rd-up{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}',
    '.rd-mo{background:var(--warnbg);border-radius:14px;padding:12px}.rd-mo b{color:var(--warn);font-size:.95rem}.rd-mo ul{margin:6px 0 0;padding-left:18px;font-size:.82rem;line-height:1.5;color:var(--ink)}',
    '.rd-tag{display:inline-block;font-size:.68rem;font-weight:700;border-radius:6px;padding:1px 6px;margin-right:4px;background:var(--blue-soft);color:var(--navy-2)}',
    '.rd-tag.exp{background:var(--warnbg);color:var(--warn)}',
    '.rd-row{padding:10px 0;border-top:1px solid var(--line);font-size:.88rem;line-height:1.4}.rd-row:first-of-type{border-top:0}.rd-row .m{display:block;font-size:.74rem;color:var(--muted);margin-top:2px}',
    '.rd-mnav{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 6px}.rd-mnav::-webkit-scrollbar{display:none}',
    '.rd-mnav a{flex:0 0 auto;text-decoration:none;border-radius:999px;padding:7px 11px;background:var(--soft);color:var(--ink-2);font-size:.82rem;font-weight:600}.rd-mnav a.on{background:var(--ink);color:#fff}.rd-mnav a.now{box-shadow:inset 0 0 0 2px var(--navy)}',
    '.rd-foot{font-size:.76rem;color:var(--muted);padding:4px 4px 20px;line-height:1.5}',
    '@media (max-width:520px){.rd-grid{font-size:.74rem;min-width:560px}.rd-grid th.doc{min-width:120px}.rd-grid td i{width:14px;height:14px}}'
  ].join('\n');
  function style() {
    if (document.getElementById('rd-style')) return;
    var s = document.createElement('style'); s.id = 'rd-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function load() {
    if (data) return Promise.resolve(data);
    return fetch(new URL('data/regular_docs.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('regular_docs'); return r.json(); })
      .then(function (j) { data = j; return j; }).catch(function () { return null; });
  }
  function qcat(route) {
    var m = /(?:^|&)cat=([^&]*)/.exec(route.query || '');
    try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
  }
  function nowMonth() { return new Date().getMonth() + 1; }
  function grid(el, api, cat) {
    var R = root.HJRegularDocs, esc = api.esc, now = nowMonth();
    var docs = R.filter(data.docs, cat), cnt = R.countByCat(data.docs), mc = R.monthCounts(docs);
    var chips = '<button type="button" data-cat="" class="' + (cat ? '' : 'on') + '">전체 ' + data.docs.length + '</button>' +
      data.cats.map(function (c) { return '<button type="button" data-cat="' + esc(c) + '" class="' + (cat === c ? 'on' : '') + '">' + esc(c) + ' ' + (cnt[c] || 0) + '</button>'; }).join('');
    var head = '<tr><th class="doc">문서</th>' + R.ORDER.map(function (m) {
      return '<th class="' + (m === now ? 'now' : '') + '" data-mh="' + m + '"><button type="button" data-month="' + m + '" aria-label="' + m + '월 목록">' + m + '월</button></th>';
    }).join('') + '</tr>';
    var body = '', lastCycle = null;
    docs.forEach(function (d) {
      var cyc = /^연 1회/.test(d.cycle) ? '연 1회' : d.cycle;
      if (cyc !== lastCycle) { body += '<tr class="rd-sep"><th class="doc">' + esc(cyc) + '</th><td colspan="12"></td></tr>'; lastCycle = cyc; }
      body += '<tr><th class="doc" scope="row">' + esc(d.name) + '<small>' + esc(cat ? d.cycle : d.cat + ' · ' + d.cycle) + ' · ' + d.n + '회</small></th>' +
        R.ORDER.map(function (m) {
          var mk = (d.marks || {})[String(m)] || '';
          var cl = R.cellClass(mk, m, now);
          return '<td class="' + cl + '"' + (mk ? ' title="' + m + '월 ' + (mk === '●' ? '기록 있음' : '예상') + '"' : '') + '>' + (mk ? '<i aria-label="' + mk + '"></i>' : '') + '</td>';
        }).join('') + '</tr>';
    });
    var foot = '<tr><th class="doc">그 달 건수</th>' + R.ORDER.map(function (m) {
      var c = mc[m]; return '<td class="' + (m === now ? 'now' : '') + '">' + (c.rec || (c.exp ? '○' + c.exp : '·')) + '</td>';
    }).join('') + '</tr>';
    var up = R.upcoming(docs, now);
    var upHtml = up.length ? '<section class="rd-card" id="rd-upcoming"><h2>다가오는 달 예상 <small>' + up.map(function (x) { return x.m + '월'; }).join('·') + '</small></h2>' +
      '<p class="rd-why">기록은 없지만 매월 나오던 문서라 이맘때 올 거라고 본 것(○)이에요. 미리 양식과 지난 문서를 찾아 두면 돼요.</p><div class="rd-up">' +
      R.upcomingGroups(docs, now).map(function (x) { return '<div class="rd-mo" data-up="' + x.ms.join(',') + '"><b>' + x.ms.map(function (m) { return m + '월'; }).join('·') + (x.ms.length > 1 ? ' 매달' : '') + ' · ' + x.docs.length + '건</b><ul>' + x.docs.map(function (d) { return '<li>' + esc(d.name) + '</li>'; }).join('') + '</ul></div>'; }).join('') +
      '</div></section>' : '';
    el.innerHTML =
      '<div class="rd-head"><h1>정례 문서 달력</h1><p>' + esc(data.source) + ' ' + data.docs.length + '개를 달별로 모았어요. 자료 ' + esc(data.refreshed_at || '') + ' 기준.</p></div>' +
      upHtml +
      '<section class="rd-card" id="rd-gridcard"><h2>달 격자 <small>' + (cat ? esc(cat) + ' ' : '') + docs.length + '개</small></h2>' +
      '<div class="rd-chips" id="rd-cats">' + chips + '</div>' +
      '<div class="rd-legend"><span><i class="rd-dot rec"></i>기록 있음 ●</span><span><i class="rd-dot soon"></i>다가오는 예상 ○</span><span><i class="rd-dot now"></i>이번 달(' + now + '월)</span></div>' +
      '<div class="rd-scroll"><table class="rd-grid" id="rd-grid"><thead>' + head + '</thead><tbody>' + body + '</tbody><tfoot>' + foot + '</tfoot></table></div>' +
      '<p class="rd-why" style="margin-top:8px">달 이름을 누르면 그 달 문서 목록이 나와요. 휴대폰은 표를 옆으로 밀어 보세요.</p></section>' +
      '<p class="rd-foot">자료: 볼트 10 업무/정례문서 xlsx → tools/make_regular_docs.py. 사람 이름은 넣지 않았어요.<br>' +
      '왜 이렇게: 「이번 달에 뭐가 오나, 다음 달엔 뭘 준비하나」를 한 화면에서 보려고 달 격자로 두고, 다가오는 달만 주황으로 따로 모았어요.</p>';
    /* 휴대폰: 표를 옆으로 밀어 이번 달 열이 보이게 */
    var sc = el.querySelector('.rd-scroll'), nh = el.querySelector('thead th.now'), dh = el.querySelector('thead th.doc');
    if (sc && nh && dh && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = Math.max(0, nh.offsetLeft - dh.offsetWidth - nh.offsetWidth * 2);
    el.querySelectorAll('[data-cat]').forEach(function (b) {
      b.onclick = function () { var c = b.getAttribute('data-cat'); api.go('#/regular-docs' + (c ? '?cat=' + encodeURIComponent(c) : '')); };
    });
    el.querySelectorAll('[data-month]').forEach(function (b) {
      b.onclick = function () { api.go('#/regular-docs/month/' + b.getAttribute('data-month') + (cat ? '?cat=' + encodeURIComponent(cat) : '')); };
    });
  }
  function month(el, api, m, cat) {
    var R = root.HJRegularDocs, esc = api.esc, now = nowMonth();
    if (R.ORDER.indexOf(m) < 0) { api.go('#/regular-docs'); return; }
    var list = R.monthList(R.filter(data.docs, cat), m), q = cat ? '?cat=' + encodeURIComponent(cat) : '';
    var nav = R.ORDER.map(function (x) { return '<a href="#/regular-docs/month/' + x + q + '" class="' + (x === m ? 'on ' : '') + (x === now ? 'now' : '') + '">' + x + '월</a>'; }).join('');
    el.innerHTML = '<div class="rd-head"><p><a href="#/regular-docs' + q + '">‹ 정례 문서 달력</a></p><h1>' + m + '월 정례 문서</h1><p>' + (cat ? esc(cat) + ' · ' : '') + list.length + '건' + (m === now ? ' · 이번 달' : '') + '</p></div>' +
      '<section class="rd-card" id="rd-month"><div class="rd-mnav">' + nav + '</div>' +
      (list.length ? list.map(function (x) {
        return '<div class="rd-row"><span class="rd-tag' + (x.mark === '○' ? ' exp' : '') + '">' + (x.mark === '○' ? '예상' : '기록') + '</span><b>' + esc(x.doc.name) + '</b><span class="m">' + esc(x.doc.cat) + ' · ' + esc(x.doc.cycle) + ' · 3~10월 ' + x.doc.n + '회</span></div>';
      }).join('') : '<p class="muted">이 달에는 정례 문서가 없어요.</p>') + '</section>';
    var on = el.querySelector('.rd-mnav a.on');
    if (on && on.parentNode.scrollWidth > on.parentNode.clientWidth) on.parentNode.scrollLeft = Math.max(0, on.offsetLeft - 60);
  }
  function render(el, api) {
    style();
    el.classList.add('wide');
    var route = api.route();
    function go() {
      var cat = qcat(route);
      if (cat && data.cats.indexOf(cat) < 0) cat = '';
      if (route.parts[1] === 'month') return month(el, api, +route.parts[2], cat);
      return grid(el, api, cat);
    }
    if (data) return go();
    el.innerHTML = '<section class="card sk" aria-busy="true"><p class="muted">불러오는 중…</p><i></i><i></i><i></i></section>';
    load().then(function (d) { if (!d) { el.innerHTML = '<section class="card"><p>⚠ 자료(data/regular_docs.json)를 못 불러왔어요. 새로고침해 주세요.</p></section>'; return; } go(); });
  }
  if (root.ShellModules) root.ShellModules['regular-docs'] = { id: 'regular-docs', tab: '정례 문서', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

/* 문서등록대장 달력 (#/docreg/cal): 항공정비과 문서등록대장 3.4.~10.6. — 월별 추세 막대 + 업무 달력, 날짜 누르면 그날 문서.
   출처: 유진님 261030 「앱에 적용해서 넣어놈」(대장·춘식이 전달).
   자료 data/docreg_calendar.json 하나 — #/docreg/cal 을 처음 열 때만 불러옴(이 파일도 그때 docreg.js 가 붙임 → 홈 무게 그대로).
   이름은 people_roles.json 에 있는 이름만 그대로, 나머지는 김*수 꼴로 가린 자료만 씀. 예시 숫자 없음: 자료 없으면 「데이터 없음」. */
(function (root) {
  'use strict';
  var A = '#1B64DA';
  var HEAT = ['#F2F4F6', '#DCE7F8', '#B5CDF1', '#7FA8E6', '#4A83DB', '#1B64DA'];
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var cache = null, pending = null, view = { ym: '', day: '' };
  var CSS = [
    '.dc-head{padding:4px 2px 0}.dc-head h1{margin:0 0 2px}.dc-head p{margin:0;color:var(--muted);font-size:var(--fs-sm);line-height:1.45}',
    '.dc-card{background:var(--card);border-radius:var(--r-lg);padding:var(--sp-4);margin:var(--sp-3) 0;box-shadow:var(--shadow-card)}',
    '.dc-card h2{font-size:var(--fs-lg);margin:0 0 2px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
    '.dc-card h2 small{font-size:var(--fs-sm);color:var(--muted);font-weight:500;white-space:nowrap}',
    '.dc-unit{font-size:var(--fs-sm);color:var(--muted);margin:0 0 var(--sp-2)}',
    '.dc-svg{width:100%;height:auto;display:block;overflow:visible}',
    '.dc-svg .bar{cursor:pointer}.dc-svg .bar:hover rect.b{opacity:.85}',
    '.dc-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 var(--sp-2)}',
    '.dc-nav b{font-size:var(--fs-lg)}.dc-nav b small{font-size:var(--fs-sm);color:var(--muted);font-weight:500;margin-left:6px}',
    '.dc-nav button{border:0;background:var(--soft);color:var(--ink-2);border-radius:var(--r-pill);width:36px;height:36px;font-size:1.1rem;cursor:pointer}',
    '.dc-nav button[disabled]{opacity:.35;cursor:default}',
    '.dc-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}',
    '.dc-wd{font-size:var(--fs-xs);color:var(--muted);text-align:center;padding:2px 0 4px}.dc-wd.sun{color:var(--no)}',
    '.dc-day{border:0;border-radius:var(--r-sm);min-height:46px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font:inherit;color:var(--ink);cursor:pointer;font-variant-numeric:tabular-nums}',
    '.dc-day .d{font-size:var(--fs-xs);color:var(--ink-2)}.dc-day .n{font-size:var(--fs-sm);font-weight:700}',
    '.dc-day.hot .d,.dc-day.hot .n{color:#fff}',
    '.dc-day.zero{cursor:default;background:transparent}.dc-day.zero .n{color:var(--g-400);font-weight:500}',
    '.dc-day.out{visibility:hidden}',
    '.dc-day.on{box-shadow:0 0 0 2px var(--ink) inset}',
    '.dc-legend{display:flex;flex-wrap:wrap;gap:4px 8px;font-size:var(--fs-xs);color:var(--ink-2);margin:var(--sp-2) 0 0;align-items:center}',
    '.dc-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;vertical-align:-1px}',
    '.dc-list{list-style:none;margin:0;padding:0}',
    '.dc-list li{padding:10px 0;border-top:1px solid var(--line)}.dc-list li:first-child{border-top:0}',
    '.dc-list .t{display:block;font-size:var(--fs-md);color:var(--ink);line-height:1.4;word-break:keep-all;overflow-wrap:anywhere}',
    '.dc-list .m{display:flex;gap:8px;flex-wrap:wrap;font-size:var(--fs-xs);color:var(--muted);margin-top:3px;font-variant-numeric:tabular-nums}',
    '.dc-empty{padding:22px 8px;text-align:center;color:var(--muted);font-weight:700;background:var(--soft);border-radius:var(--r-md)}',
    '.dc-src{font-size:var(--fs-xs);color:var(--muted);margin:var(--sp-2) 2px 0;line-height:1.45}',
    '@media (min-width:900px){.dc-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--sp-3);align-items:start}.dc-two .dc-card{margin:0}.dc-two #dc-day{position:sticky;top:12px;max-height:calc(100vh - 120px);overflow:auto}.dc-day{min-height:58px}}'
  ].join('');
  function style() {
    if (document.getElementById('dc-style')) return;
    var s = document.createElement('style'); s.id = 'dc-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function pick(o, keys) { for (var i = 0; i < keys.length; i++) if (o && o[keys[i]] != null) return o[keys[i]]; return null; }
  function iso(s) {
    var m = String(s || '').match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
  }
  function ymOf(s) { var m = String(s || '').match(/(\d{4})\D?(\d{1,2})/); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : ''; }
  function doc(x) {
    if (!x || typeof x !== 'object') return null;
    return { no: String(pick(x, ['no', 'doc_no', '문서번호', 'num']) || ''), t: String(pick(x, ['t', 'title', '제목']) || ''), who: String(pick(x, ['who', 'owner', '담당자', 'person']) || ''), kind: String(pick(x, ['kind', '문서종류']) || '') };
  }
  /* 자료 모양: 월별 건수 · 날짜별 건수 · 날짜별 문서 목록(문서번호·제목·담당자). 키 이름이 조금 달라도 읽음. */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.meta && typeof raw.meta === 'object') raw = Object.assign({}, raw.meta, raw);
    var out = { months: [], days: {}, docs: {}, total: 0, from: '', to: '', title: '', source: '', masked: null };
    var mon = pick(raw, ['months', 'monthly', 'by_month', '월별']);
    if (Array.isArray(mon)) mon.forEach(function (m) { var k = ymOf(pick(m, ['ym', 'm', 'month', '월'])), n = +pick(m, ['n', 'count', 'cnt', '건수']) || 0; if (k) out.months.push({ ym: k, n: n }); });
    else if (mon && typeof mon === 'object') Object.keys(mon).forEach(function (k) { var v = mon[k]; out.months.push({ ym: ymOf(k), n: +(typeof v === 'object' ? pick(v, ['n', 'count']) : v) || 0 }); });
    var day = pick(raw, ['days', 'daily', 'by_date', 'dates', '날짜별']);
    function addDay(k, v) {
      var d = iso(k); if (!d) return;
      if (Array.isArray(v)) { out.docs[d] = v.map(doc).filter(Boolean); out.days[d] = v.length; return; }
      if (v && typeof v === 'object') {
        var ls = pick(v, ['docs', 'list', 'items', '문서']);
        if (Array.isArray(ls)) out.docs[d] = ls.map(doc).filter(Boolean);
        out.days[d] = +pick(v, ['n', 'count', 'cnt', '건수']) || (out.docs[d] ? out.docs[d].length : 0);
        return;
      }
      out.days[d] = +v || 0;
    }
    if (Array.isArray(day)) day.forEach(function (x) { addDay(pick(x, ['d', 'date', '날짜']), x); });
    else if (day && typeof day === 'object') Object.keys(day).forEach(function (k) { addDay(k, day[k]); });
    var dl = pick(raw, ['docs_by_day', 'docs', 'documents', 'docs_by_date', 'lists']);
    if (Array.isArray(dl)) dl.forEach(function (x) { var d = iso(pick(x, ['d', 'date', '등록일자'])); var o = doc(x); if (d && o) (out.docs[d] = out.docs[d] || []).push(o); });
    else if (dl && typeof dl === 'object') Object.keys(dl).forEach(function (k) { var d = iso(k); if (d && Array.isArray(dl[k])) out.docs[d] = dl[k].map(doc).filter(Boolean); });
    Object.keys(out.docs).forEach(function (d) { if (out.days[d] == null) out.days[d] = out.docs[d].length; });
    if (!out.months.length) {
      var acc = {}; Object.keys(out.days).forEach(function (d) { var k = d.slice(0, 7); acc[k] = (acc[k] || 0) + out.days[d]; });
      Object.keys(acc).forEach(function (k) { out.months.push({ ym: k, n: acc[k] }); });
    }
    out.months.sort(function (a, b) { return a.ym < b.ym ? -1 : 1; });
    var ds = Object.keys(out.days).sort();
    var rg = pick(raw, ['range', 'period']) || {};
    out.from = iso(pick(raw, ['from', 'start', 'first_date']) || pick(rg, ['from', 'start']) || ds[0]);
    out.to = iso(pick(raw, ['to', 'end', 'last_date']) || pick(rg, ['to', 'end']) || ds[ds.length - 1]);
    var t = pick(raw, ['total', 'n', 'count']);
    out.total = t != null ? +t : out.months.reduce(function (s, m) { return s + m.n; }, 0);
    out.title = String(pick(raw, ['dept']) || '').replace(/^.*학부/, '');
    out.basis = String(pick(raw, ['basis']) || '');
    out.source = String(pick(raw, ['source', 'src', '출처']) || '');
    var mk = pick(raw, ['masked_new_names', 'masked_names', 'masked', 'masked_count']);
    out.masked = mk == null ? null : mk;
    if (!out.months.length && !ds.length) return null;
    return out;
  }
  function load() {
    if (cache) return Promise.resolve(cache);
    if (pending) return pending;
    pending = fetch(new URL('data/docreg_calendar.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { cache = normalize(j); pending = null; return cache; })
      .catch(function () { pending = null; return null; });
    return pending;
  }
  function md(d) { var p = d.split('-'); return +p[1] + '.' + (+p[2]) + '.'; }
  function wdOf(d) { var p = d.split('-'); return WD[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function heat(n, max) { if (!n) return HEAT[0]; return HEAT[Math.min(5, 1 + Math.floor((n - 1) / Math.max(1, max) * 5))]; }
  function trend(c) {
    var ms = c.months, n = ms.length; if (!n) return '<div class="dc-empty">데이터 없음</div>';
    var wide = window.innerWidth >= 900, W = wide ? 760 : 340, H = wide ? 190 : 168, L = 8, R = 8, T = 22, B = 24;
    var mx = Math.max.apply(null, ms.map(function (m) { return m.n; }).concat([1]));
    var bw = (W - L - R) / n, pk = 0; ms.forEach(function (m, i) { if (m.n > ms[pk].n) pk = i; });
    var o = '<svg class="dc-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="월별 문서 건수 막대 그래프">';
    o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="#E5E8EB"/>';
    ms.forEach(function (m, i) {
      var h = (H - T - B) * m.n / mx, x = L + i * bw + bw * 0.18, w = bw * 0.64, y = H - B - h;
      var part = (i === 0 && c.from.slice(8) !== '01') || (i === n - 1 && c.to && c.to.slice(0, 7) === m.ym);
      var on = m.ym === view.ym;
      o += '<g class="bar" data-ym="' + m.ym + '"><title>' + (+m.ym.slice(5)) + '월 ' + m.n + '건' + (part ? ' (달 일부)' : '') + '</title>';
      o += '<rect x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" fill="transparent"/>';
      o += '<rect class="b ch-grow" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4" fill="' + (i === pk || on ? A : '#B0B8C1') + '"' + (part ? ' fill-opacity=".55"' : '') + '/>';
      o += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" font-size="10" text-anchor="middle" fill="' + (i === pk ? A : '#4E5968') + '" font-weight="700">' + m.n + '</text>';
      o += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 8) + '" font-size="10" text-anchor="middle" fill="' + (on ? '#191F28' : '#646F7C') + '"' + (on ? ' font-weight="700"' : '') + '>' + (+m.ym.slice(5)) + '월</text></g>';
    });
    return o + '</svg>';
  }
  function cal(c, esc) {
    var y = +view.ym.slice(0, 4), m = +view.ym.slice(5);
    var first = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate();
    var mx = 1; Object.keys(c.days).forEach(function (d) { if (c.days[d] > mx) mx = c.days[d]; });
    var sum = 0;
    var g = WD.map(function (w, i) { return '<div class="dc-wd' + (i === 0 ? ' sun' : '') + '">' + w + '</div>'; }).join('');
    for (var i = 0; i < first; i++) g += '<div class="dc-day out" aria-hidden="true"></div>';
    for (var d = 1; d <= last; d++) {
      var k = view.ym + '-' + ('0' + d).slice(-2), n = c.days[k] || 0; sum += n;
      var inR = (!c.from || k >= c.from) && (!c.to || k <= c.to);
      var bg = heat(n, mx), hot = n && HEAT.indexOf(bg) >= 4;
      g += n ? '<button type="button" class="dc-day' + (hot ? ' hot' : '') + (k === view.day ? ' on' : '') + '" data-d="' + k + '" style="background:' + bg + '" aria-label="' + md(k) + ' ' + n + '건"><span class="d">' + d + '</span><span class="n">' + n + '</span></button>'
        : '<div class="dc-day zero"' + (inR ? '' : ' style="opacity:.45"') + '><span class="d">' + d + '</span><span class="n">' + (inR ? '0' : '·') + '</span></div>';
    }
    var yms = c.months.map(function (x) { return x.ym; }), ix = yms.indexOf(view.ym);
    var nav = '<div class="dc-nav"><button type="button" id="dc-prev" aria-label="이전 달"' + (ix <= 0 ? ' disabled' : '') + '>‹</button><b>' + y + '. ' + m + '월<small>' + sum + '건</small></b><button type="button" id="dc-next" aria-label="다음 달"' + (ix < 0 || ix >= yms.length - 1 ? ' disabled' : '') + '>›</button></div>';
    var leg = '<div class="dc-legend"><span>적음</span>' + HEAT.slice(1).map(function (c2) { return '<i style="background:' + c2 + '"></i>'; }).join('') + '<span>많음 (하루 최대 ' + mx + '건)</span></div>';
    return nav + '<div class="dc-grid" id="dc-grid">' + g + '</div>' + leg;
  }
  function list(c, esc) {
    if (!view.day) return '<h2>날짜를 눌러 보세요</h2><p class="dc-unit">달력에서 날짜를 누르면 그날 등록된 문서가 여기 나와요.</p>';
    var ls = c.docs[view.day] || [], n = c.days[view.day] || ls.length;
    var h = '<h2>' + md(view.day) + '(' + wdOf(view.day) + ') 문서<small>' + n + '건</small></h2>';
    if (!ls.length) return h + '<div class="dc-empty">목록 없음</div>';
    return h + '<ul class="dc-list" id="dc-list">' + ls.map(function (x) {
      var no = x.no.replace(/^.*?-(\d+)$/, '$1');
      return '<li><span class="t">' + esc(x.t || '(제목 없음)') + '</span><span class="m"><span title="' + esc(x.no) + '">' + esc(no ? '-' + no : '') + '</span>' + (x.kind ? '<span>' + esc(x.kind) + '</span>' : '') + (x.who ? '<span>담당 ' + esc(x.who) + '</span>' : '') + '</span></li>';
    }).join('') + '</ul>';
  }
  function paint(el, api, c) {
    var esc = api.esc;
    var head = '<div class="dc-head"><h1>문서등록대장 달력</h1><p>' + esc(c.title || '항공정비과') + ' · ' + (c.from ? md(c.from) : '') + '~' + (c.to ? md(c.to) : '') + ' · <b id="dc-total">문서대장 원본 기준 ' + c.total.toLocaleString('ko-KR') + '건</b>' + (c.basis ? ' (' + esc(c.basis) + ')' : '') + '</p></div>';
    el.innerHTML = head +
      '<section class="dc-card" id="dc-trend"><h2>월별 추세<small>막대를 누르면 그 달 달력</small></h2><p class="dc-unit">단위: 건/월 · 흐린 막대 = 달 일부만</p>' + trend(c) + '</section>' +
      '<div class="dc-two"><section class="dc-card" id="dc-cal">' + cal(c, esc) + '</section><section class="dc-card" id="dc-day">' + list(c, esc) + '</section></div>' +
      '<p class="dc-src">출처: ' + esc(c.source || '항공정비과 문서등록대장') + ' · 사람 이름은 공개된 담당자만, 나머지는 가림</p>';
    el.querySelectorAll('#dc-trend .bar').forEach(function (b) { b.onclick = function () { view.ym = b.getAttribute('data-ym'); view.day = ''; paint(el, api, c); }; });
    var yms = c.months.map(function (x) { return x.ym; });
    function step(k) { var i = yms.indexOf(view.ym) + k; if (i >= 0 && i < yms.length) { view.ym = yms[i]; view.day = ''; paint(el, api, c); } }
    var p = el.querySelector('#dc-prev'), nx = el.querySelector('#dc-next');
    if (p) p.onclick = function () { step(-1); };
    if (nx) nx.onclick = function () { step(1); };
    el.querySelectorAll('.dc-day[data-d]').forEach(function (b) {
      b.onclick = function () {
        view.day = b.getAttribute('data-d');
        el.querySelectorAll('.dc-day.on').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var box = el.querySelector('#dc-day'); box.innerHTML = list(c, esc);
        if (window.innerWidth < 900 && box.scrollIntoView) box.scrollIntoView({ block: 'start', behavior: 'smooth' });
      };
    });
  }
  function render(el, api) {
    style();
    el.classList.add('wide'); /* PC 는 달력·목록 두 칸, 폰(390)은 한 줄. 다른 화면 가면 app.js 가 뗌 */
    el.innerHTML = '<section class="card sk" aria-busy="true"><p class="muted">불러오는 중…</p><i></i><i></i><i></i></section>';
    load().then(function (c) {
      if (!c) { el.innerHTML = '<section class="card"><div class="dc-empty" id="dc-err">데이터 없음<br><small style="font-weight:500">data/docreg_calendar.json 을 불러오지 못했어요. 새로고침해 주세요.</small></div></section>'; return; }
      if (!view.ym || !c.months.some(function (m) { return m.ym === view.ym; })) view.ym = c.months.length ? c.months[c.months.length - 1].ym : (c.to || '').slice(0, 7);
      paint(el, api, c);
    });
  }
  root.HJDocregCal = { render: render, normalize: normalize };
  if (typeof module !== 'undefined' && module.exports) module.exports = { normalize: normalize };
})(typeof window !== 'undefined' ? window : globalThis);

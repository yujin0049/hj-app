/* 공공데이터 (#/pubdata): 261102 유진님 16:27 「그리고 이거 붙여봐.」 (대장·춘식이 전달, 춘식이2).
   공공데이터포털 파일데이터 5셋 → 셋마다 표 + 간단 그래프 + 출처 링크. 자료 = data/pubdata.json (tools/make_pubdata.py).
   브랜드C: 검정 바탕 · 강조색 #4CC3FF 하나 · Hahmlet. 외부 라이브러리 없이 SVG 직접.
   숫자는 CSV 그대로. 교육원 수료생 수치는 볼트에 없어 「자료 필요」(지어내지 않음). 합격률은 공개 CSV에 없음. */
(function (root) {
  'use strict';
  var A = '#4CC3FF', BG = '#000', INK = '#F5F7FA', SUB = '#A9B2BC', LINE = '#2A2F35', GRAY = '#6B7580';
  var CSS = [
    '.pd-wrap{background:' + BG + ';color:' + INK + ';font-family:Hahmlet,"Pretendard",serif;border-radius:20px;padding:18px 14px 40px;margin:0 auto;box-sizing:border-box;max-width:1180px}',
    '.pd-wrap *{box-sizing:border-box}',
    '.pd-wrap h1,.pd-wrap h2{color:' + INK + '}',
    '.pd-cmp th{white-space:normal;line-height:1.3;min-width:4.2em}',
    '.pd-hint{display:none;font-size:.76rem;color:' + SUB + ';margin:4px 0 0}',
    '@media (max-width:600px){.pd-hint{display:block}}',
    '.pd-head h1{margin:0 0 6px;font-size:1.45rem;font-weight:800;letter-spacing:-.02em}',
    '.pd-head p{margin:0;color:' + SUB + ';font-size:.88rem;line-height:1.55}',
    '.pd-key{display:inline-block;margin-top:8px;font-size:.78rem;color:' + BG + ';background:' + A + ';border-radius:999px;padding:3px 10px;font-weight:700}',
    '.pd-sec{border-top:1px solid ' + LINE + ';margin-top:22px;padding-top:16px}',
    '.pd-sec h2{margin:0 0 4px;font-size:1.08rem;font-weight:700}',
    '.pd-meta{margin:0 0 10px;font-size:.8rem;color:' + SUB + ';line-height:1.5}',
    '.pd-meta b{color:' + A + ';font-weight:700}',
    '.pd-grid{display:grid;grid-template-columns:1fr;gap:14px}',
    '@media (min-width:900px){.pd-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}',
    '.pd-svg{width:100%;height:auto;display:block}',
    '.pd-leg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.8rem;color:' + SUB + ';margin:6px 0 0}',
    '.pd-leg i{display:inline-block;width:12px;height:3px;border-radius:2px;margin-right:5px;vertical-align:3px}',
    '.pd-tw{overflow:auto;max-height:340px;border:1px solid ' + LINE + ';border-radius:12px;-webkit-overflow-scrolling:touch}',
    '.pd-tw:focus{outline:2px solid ' + A + ';outline-offset:2px}',
    '.pd-t{border-collapse:collapse;width:100%;font-size:.82rem;font-variant-numeric:tabular-nums}',
    '.pd-t th,.pd-t td{padding:7px 9px;border-bottom:1px solid ' + LINE + ';text-align:left;white-space:nowrap}',
    '.pd-t th{position:sticky;top:0;background:#111418;color:' + SUB + ';font-weight:600;z-index:1}',
    '.pd-t td.n{text-align:right}',
    '.pd-t tr.hl td{color:' + A + ';font-weight:700}',
    '.pd-need{color:' + BG + ';background:#FFD166;border-radius:6px;padding:1px 6px;font-weight:700;font-size:.76rem}',
    '.pd-src{margin:8px 0 0;font-size:.8rem;color:' + SUB + ';word-break:break-all}',
    '.pd-src a{color:' + A + '}',
    '.pd-concl{margin:10px 0 0;padding:0;list-style:none;counter-reset:c}',
    '.pd-concl li{position:relative;padding:6px 0 6px 26px;font-size:.9rem;line-height:1.5;border-bottom:1px dashed ' + LINE + '}',
    '.pd-concl li:before{counter-increment:c;content:counter(c);position:absolute;left:0;top:7px;width:18px;height:18px;border-radius:50%;background:' + A + ';color:' + BG + ';font-size:.72rem;font-weight:800;text-align:center;line-height:18px}',
    '.pd-link{display:block;border:1px solid ' + A + ';border-radius:14px;padding:14px;color:' + INK + ';text-decoration:none}',
    '.pd-link b{color:' + A + '}',
    '.pd-empty{padding:18px;text-align:center;color:' + SUB + ';border:1px dashed ' + LINE + ';border-radius:12px}'
  ].join('\n');

  function style() {
    if (!document.getElementById('pd-font')) {
      var l = document.createElement('link'); l.id = 'pd-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@400;600;700;800&display=swap';
      document.head.appendChild(l);
    }
    if (document.getElementById('pd-style')) return;
    var s = document.createElement('style'); s.id = 'pd-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function fmt(n) { return typeof n === 'number' ? n.toLocaleString('ko-KR') : (n == null ? '' : String(n)); }
  function pct(a, b) { return Math.round((a - b) / b * 1000) / 10; }

  /* 꺾은선: xs=라벨, series=[{name,v:[],c}] */
  function line(xs, series, esc, label) {
    var W = 420, H = 220, L = 46, R = 14, T = 16, B = 28;
    var all = []; series.forEach(function (s) { s.v.forEach(function (v) { if (typeof v === 'number') all.push(v); }); });
    if (!all.length) return '<div class="pd-empty">데이터 없음</div>';
    var max = Math.max.apply(null, all), step = Math.pow(10, Math.floor(Math.log10(max || 1)));
    max = Math.ceil(max / step) * step;
    var x = function (i) { return L + (xs.length < 2 ? 0 : i * (W - L - R) / (xs.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var o = '<svg class="pd-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">';
    for (var g = 0; g <= 4; g++) {
      var gv = max * g / 4;
      o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(gv) + '" y2="' + y(gv) + '" stroke="' + LINE + '"/>' +
        '<text x="' + (L - 6) + '" y="' + (y(gv) + 4) + '" text-anchor="end" font-size="11" fill="' + SUB + '">' + fmt(Math.round(gv)) + '</text>';
    }
    var every = Math.ceil(xs.length / 9);
    xs.forEach(function (t, i) { if ((i % every === 0 && i <= xs.length - 1 - Math.ceil(every / 2)) || i === xs.length - 1) o += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="' + SUB + '">' + esc(t) + '</text>'; });
    series.forEach(function (s) {
      var pts = s.v.map(function (v, i) { return typeof v === 'number' ? x(i) + ',' + y(v) : null; }).filter(Boolean);
      o += '<polyline fill="none" stroke="' + s.c + '" stroke-width="2.5" stroke-linejoin="round" points="' + pts.join(' ') + '"/>';
      s.v.forEach(function (v, i) { if (typeof v === 'number') o += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.5" fill="' + s.c + '"><title>' + esc(xs[i] + ' ' + s.name + ' ' + fmt(v)) + '</title></circle>'; });
      var li = s.v.length - 1;
      if (typeof s.v[li] === 'number') o += '<text x="' + (x(li) - 4) + '" y="' + (y(s.v[li]) - 8) + '" text-anchor="end" font-size="11" font-weight="700" fill="' + s.c + '">' + fmt(s.v[li]) + '</text>';
    });
    o += '</svg><div class="pd-leg">' + series.map(function (s) { return '<span><i style="background:' + s.c + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
    return o;
  }
  /* 가로 막대: items=[[라벨,값]] 값 큰 것 하나만 강조색 */
  function bars(items, esc, label) {
    if (!items.length) return '<div class="pd-empty">데이터 없음</div>';
    var W = 380, rowH = 26, L = 118, R = 50, H = items.length * rowH + 8;
    var max = Math.max.apply(null, items.map(function (r) { return r[1]; })) || 1;
    var o = '<svg class="pd-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">';
    items.forEach(function (r, i) {
      var w = (W - L - R) * r[1] / max, yy = 4 + i * rowH;
      o += '<text x="' + (L - 8) + '" y="' + (yy + 16) + '" text-anchor="end" font-size="12" fill="' + INK + '">' + esc(r[0]) + '</text>' +
        '<rect x="' + L + '" y="' + (yy + 4) + '" width="' + Math.max(2, w) + '" height="16" rx="4" fill="' + (i === 0 ? A : GRAY) + '"><title>' + esc(r[0] + ' ' + fmt(r[1])) + '</title></rect>' +
        '<text x="' + (L + Math.max(2, w) + 6) + '" y="' + (yy + 16) + '" font-size="12" fill="' + (i === 0 ? A : SUB) + '">' + fmt(r[1]) + '</text>';
    });
    return o + '</svg>';
  }
  function table(cols, rows, esc, hl, cap) {
    var yc = cols.map(function (c) { return /연도|기간/.test(c); }); /* 연도는 쉼표 없이 */
    var h = '<div class="pd-tw" tabindex="0" role="region" aria-label="' + esc(cap) + '"><table class="pd-t"><thead><tr>' +
      cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr' + (hl && hl(r) ? ' class="hl"' : '') + '>' + r.map(function (v, i) { return '<td' + (typeof v === 'number' && !yc[i] ? ' class="n"' : '') + '>' + esc(yc[i] ? String(v) : fmt(v)) + '</td>'; }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  function meta(s, esc) {
    return '<p class="pd-meta">' + esc(s.org) + (s.updated ? ' · 수정 <b>' + esc(s.updated) + '</b>' : '') + (s.cycle ? ' · 갱신 ' + esc(s.cycle) : '') +
      (s.kind === 'file' ? ' · <b>' + s.count + '행</b>' : '') + '<br>' + esc(s.note || '') + '</p>';
  }
  function src(s, esc) {
    return '<p class="pd-src">출처: <a href="' + esc(s.page) + '" target="_blank" rel="noopener noreferrer">공공데이터포털 ' + esc(s.id) + '</a>' +
      (s.file ? ' · ' + esc(s.file) : '') + '</p>';
  }
  function col(s, name) { return s.columns.indexOf(name); }

  function compare(c, esc) {
    if (!c || !c.rows.length) return '<div class="pd-empty">데이터 없음</div>';
    var need = '<span class="pd-need">자료 필요</span>';
    var h = '<div class="pd-tw" tabindex="0" role="region" aria-label="전국 대 교육원 대조표"><table class="pd-t pd-cmp"><thead><tr><th scope="col">연도</th><th scope="col">전국<br>학과 응시</th><th scope="col">전국<br>실기 응시</th><th scope="col">전국<br>취득</th><th scope="col">교육원<br>수료생 응시</th><th scope="col">교육원<br>수료생 취득</th><th scope="col">교육원<br>비중</th></tr></thead><tbody>';
    c.rows.forEach(function (r) {
      h += '<tr><td>' + r.y + '</td><td class="n">' + fmt(r.written) + '</td><td class="n">' + fmt(r.practical) + '</td><td class="n">' + fmt(r.licensed) + '</td>' +
        '<td>' + (r.our_exam == null ? need : fmt(r.our_exam)) + '</td><td>' + (r.our_licensed == null ? need : fmt(r.our_licensed)) + '</td><td>' + (r.our_licensed == null ? need : '') + '</td></tr>';
    });
    h += '</tbody></table></div><p class="pd-hint">표를 옆으로 밀면 교육원 칸이 보여요 ›</p>';
    var f = c.rows[0], l = c.rows[c.rows.length - 1];
    var lo = c.rows.reduce(function (m, r) { return r.licensed < m.licensed ? r : m; }, f);
    h += '<ol class="pd-concl">' +
      '<li>전국 항공정비사 학과 응시 ' + fmt(f.written) + '명(' + f.y + ') → ' + fmt(l.written) + '명(' + l.y + '), ' + pct(l.written, f.written) + '%. 실기 응시 ' + fmt(f.practical) + ' → ' + fmt(l.practical) + '명(' + pct(l.practical, f.practical) + '%).</li>' +
      '<li>전국 항공정비사 자격 취득 ' + fmt(f.licensed) + '명(' + f.y + ') → ' + fmt(l.licensed) + '명(' + l.y + '), ' + pct(l.licensed, f.licensed) + '%. 가장 적은 해 ' + lo.y + '년 ' + fmt(lo.licensed) + '명.</li>' +
      '<li>교육원 수료생 응시·취득 수치는 아직 없어 비교 칸은 「자료 필요」예요. 합격률은 공개 자료에 없어요(응시·취득 수만 있음).</li></ol>';
    return h;
  }

  function section(s, esc) {
    var h = '<section class="pd-sec" id="pd-' + esc(s.id) + '"><h2>' + esc(s.title) + '</h2>' + meta(s, esc);
    if (s.kind === 'link') {
      return h + '<a class="pd-link" href="' + esc(s.link) + '" target="_blank" rel="noopener noreferrer"><b>국토부 사이트에서 보기 ›</b><br><small>' + esc(s.link) + '</small></a>' + src(s, esc) + '</section>';
    }
    if (s.kind !== 'file') return h + '<div class="pd-empty">데이터 없음 (파일을 아직 못 받았어요)</div>' + src(s, esc) + '</section>';
    var chart = '';
    if (s.id === '15174838') {
      var ys = [], w = {}, p = {};
      s.rows.forEach(function (r) { if (r[1] !== '항공정비사') return; if (ys.indexOf(r[0]) < 0) ys.push(r[0]); (r[2] === '학과' ? w : p)[r[0]] = r[5]; });
      chart = line(ys, [{ name: '정비사 학과 응시', v: ys.map(function (y) { return w[y]; }), c: A }, { name: '정비사 실기 응시', v: ys.map(function (y) { return p[y]; }), c: INK }], esc, '항공정비사 응시자 수 추이');
      h += '<div class="pd-grid"><div>' + chart + '</div>' + table(s.columns, s.rows, esc, function (r) { return r[1] === '항공정비사'; }, '응시현황 전체 표') + '</div>';
    } else if (s.id === '3043749') {
      var ci = col(s, '항공정비사'), rs = s.rows.filter(function (r) { return typeof r[0] === 'number'; });
      chart = line(rs.map(function (r) { return r[0]; }), [{ name: '항공정비사 취득자', v: rs.map(function (r) { return r[ci]; }), c: A }], esc, '항공정비사 자격 취득자 추이');
      h += '<div class="pd-grid"><div>' + chart + '</div>' + table(s.columns, s.rows, esc, null, '취득자 전체 표') + '</div>';
    } else if (s.id === '15119468') {
      var sum = {};
      s.rows.forEach(function (r) { if (String(r[0]).indexOf('항공종사자') === 0) sum[r[1]] = (sum[r[1]] || 0) + r[4]; });
      var it = Object.keys(sum).map(function (k) { return [k, sum[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
      h += '<div class="pd-grid"><div>' + bars(it, esc, '자격별 실기 원서 접수자') + '<p class="pd-meta">항공종사자 자격만 자격명별로 더함(초경량·한정심사 제외).</p></div>' +
        table(s.columns, s.rows, esc, function (r) { return r[1] === '항공정비사'; }, '실기원서접수 전체 표') + '</div>';
    } else {
      var k = col(s, '교육종류'), cnt = {};
      s.rows.forEach(function (r) { cnt[r[k]] = (cnt[r[k]] || 0) + 1; });
      var it2 = Object.keys(cnt).map(function (x) { return [x, cnt[x]]; }).sort(function (a, b) { return b[1] - a[1]; });
      h += '<div class="pd-grid"><div>' + bars(it2, esc, '교육 종류별 건수') + '<p class="pd-meta">교육 종류별 건수(2025년 종료 교육).</p></div>' + table(s.columns, s.rows, esc, null, '정비사 교육 전체 표') + '</div>';
    }
    return h + src(s, esc) + '</section>';
  }

  function render(el, api) {
    var esc = api.esc;
    style();
    el.classList.add('wide');
    el.innerHTML = '<section class="card sk" aria-busy="true"><p class="muted">불러오는 중…</p><i></i><i></i><i></i></section>';
    fetch(new URL('data/pubdata.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('pubdata'); return r.json(); })
      .then(function (d) {
        var h = '<div class="pd-wrap"><section class="pd-head"><h1>공공데이터 · 항공정비</h1>' +
          '<p>공공데이터포털에서 키·로그인 없이 받은 파일 그대로예요. 셋마다 표·그래프·출처를 붙였어요. 숫자는 원본 그대로, 없는 건 「자료 필요」.</p>' +
          '<span class="pd-key">' + d.sets.length + '개 셋 · ' + esc(d.built) + ' 받음</span></section>';
        h += '<section class="pd-sec" id="pd-compare"><h2>전국 vs 교육원 수료생 대조</h2><p class="pd-meta">전국 = 15174838(응시)·3043749(취득). ' + esc(d.compare ? d.compare.our_note : '') + '</p>' + compare(d.compare, esc) + '</section>';
        d.sets.forEach(function (s) { h += section(s, esc); });
        el.innerHTML = h + '</div>';
      })
      .catch(function () { el.innerHTML = '<section class="card"><p class="muted">데이터 없음 · data/pubdata.json 을 못 불러왔어요</p></section>'; });
  }
  if (root.ShellModules) root.ShellModules.pubdata = { id: 'pubdata', tab: '공공데이터', icon: '', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

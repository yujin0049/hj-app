/* 업무 차트 (#/charts): 참고 그림(차트 9종) 스타일 — 흰 카드 · 강조색 하나(#1B64DA) · 나머지 회색 · 카드 아래 이름+한 줄 설명.
   그리는 것(실제 자료 있는 것만): 08 캘린더 히트맵 · 01 라인(주별 일정 건수) · 04 계단형(글로컬 잔액) · 막대(주머니별 강사료)
   · 05 스파크라인 표 · 07 범프(부서별 문서 순위) · 02 영역(외부기관 중요문서 월별).
   자료 = data/charts.json 하나 (tools/make_charts.py). 새 자료 파일 없음: 라인·범프·영역은 이 파일에서 JS로 계산. 외부 라이브러리 없이 SVG 직접.
   예시 데이터 금지: empty 이면 「데이터 없음」. 돈 주머니(어학연수·글로컬·대학회계)는 주머니마다 따로 그리고(쌓지 않음) 합계 숫자는 안 씀.
   강사료 집행=진한 강조색 칸, 예정·추정=빗금+점선(춘식이 261029: 이 구분이 색 통일보다 중요). 누적 영역·스트림은 주머니를 쌓게 되므로 안 씀. */
(function (root) {
  'use strict';
  var A = '#1B64DA'; /* 강조색 하나 */
  var C = { ink: '#191F28', ink2: '#4E5968', muted: '#8B95A1', axis: '#646F7C', line: '#E5E8EB', gray: '#B0B8C1', soft: '#F2F4F6', blue: A };
  var HEAT = ['#F2F4F6', '#DCE7F8', '#B5CDF1', '#7FA8E6', '#4A83DB', '#1B64DA'];
  var CSS = [
    '.ch-wrap{margin:0 auto;padding:0 0 48px;box-sizing:border-box}',
    '.ch-head{padding:8px 2px 10px}.ch-head h1{margin:0 0 4px;font-size:1.35rem;letter-spacing:-.02em}',
    '.ch-head p{margin:0;font-size:.86rem;color:var(--muted);line-height:1.45}',
    '.ch-grid{display:grid;grid-template-columns:1fr;gap:18px}',
    '@media (min-width:760px){.ch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media (min-width:1080px){.ch-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}',
    '.ch-fig{margin:0;min-width:0}',
    '.ch-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 14px 12px;margin:0;box-shadow:0 1px 2px rgba(0,0,0,.03)}',
    '.ch-card h2{margin:0 0 2px;font-size:1rem;letter-spacing:-.01em}',
    '.ch-unit{font-size:.8rem;color:var(--muted);margin:0 0 10px;line-height:1.4}',
    '.ch-cap{display:flex;align-items:baseline;gap:8px;margin:8px 4px 0;font-size:.86rem;color:var(--ink-2);line-height:1.4}',
    '.ch-cap b{color:var(--ink);font-size:.9rem;white-space:nowrap}.ch-cap b i{font-style:normal;color:' + A + ';margin-right:5px;font-variant-numeric:tabular-nums}',
    '.ch-sub{font-size:.84rem;color:var(--ink-2);margin:8px 0 0;line-height:1.4}',
    '.ch-src{font-size:.8rem;color:var(--muted);margin:8px 0 0;line-height:1.4;word-break:keep-all}',
    '.ch-svg{width:100%;height:auto;display:block;overflow:visible}',
    '.ch-empty{padding:22px 8px;text-align:center;color:var(--muted);font-weight:700;background:var(--soft);border-radius:12px}',
    '.ch-legend{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:.8rem;color:var(--ink-2);margin:8px 0 0;align-items:center}',
    '.ch-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}',
    '.ch-tip{font-size:.84rem;color:var(--ink);min-height:1.2em;margin:6px 0 0;font-weight:600}',
    '.ch-tbl{width:100%;border-collapse:collapse;font-size:.82rem}',
    '.ch-tbl td{padding:7px 4px;border-top:1px solid var(--line);vertical-align:middle}',
    '.ch-tbl tr:first-child td{border-top:0}',
    '.ch-tbl td.n{white-space:nowrap;max-width:9.5rem;overflow:hidden;text-overflow:ellipsis}',
    '.ch-tbl td.v{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}',
    '.ch-tbl td.d{text-align:right;font-size:.8rem;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.ch-pk{margin:10px 0 0}.ch-pk:first-of-type{margin-top:4px}.ch-pk h3{margin:0 0 4px;font-size:.86rem;color:var(--ink)}',
    '.ch-pk .ch-empty{padding:12px 8px}.ch-pk .ch-sub{margin:2px 0 0}',
    '.ch-up{color:' + A + ';font-weight:700}.ch-dn{color:var(--ink-2)}.ch-eq{color:var(--muted)}'
  ].join('\n');

  function style() {
    if (document.getElementById('ch-style')) return;
    var s = document.createElement('style'); s.id = 'ch-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function won(n) { return (n == null ? '' : Math.round(n).toLocaleString('ko-KR')) + '원'; }
  function man(n) { return Math.round(n / 10000).toLocaleString('ko-KR') + '만'; }
  function md(d) { var p = String(d).split('-'); return Number(p[1]) + '.' + Number(p[2]) + '.'; }
  function empty(msg) { return '<div class="ch-empty">데이터 없음' + (msg ? '<br><small style="font-weight:500">' + msg + '</small>' : '') + '</div>'; }
  /* 흰 카드(제목·단위·그림) + 카드 아래 이름·한 줄 설명 */
  function fig(no, kind, desc, title, unit, body, src, esc) {
    return '<figure class="ch-fig"><section class="ch-card"><h2>' + esc(title) + '</h2>' +
      (unit ? '<p class="ch-unit">' + esc(unit) + '</p>' : '') + body + (src ? '<p class="ch-src">출처: ' + esc(src) + '</p>' : '') + '</section>' +
      '<figcaption class="ch-cap"><b>' + (no ? '<i>' + no + '</i>' : '') + esc(kind) + '</b><span>' + esc(desc) + '</span></figcaption></figure>';
  }
  function iso(dt) { return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2); }
  function todayIso() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }

  /* 08 캘린더 히트맵: 요일(세로) × 주(가로). 칸 색 = 그날 업무 건수(강조색 농도). */
  function heatmap(h, esc) {
    if (!h || h.empty || !h.start || !h.end || !h.days) return empty(h && h.src);
    var start = new Date(h.start + 'T00:00:00'), end = new Date(h.end + 'T00:00:00');
    var s0 = new Date(start); s0.setDate(s0.getDate() - ((s0.getDay() + 6) % 7)); /* 월요일 시작 */
    var cell = 14, gap = 2, top = 18, left = 22;
    var weeks = Math.ceil(((end - s0) / 864e5 + 1) / 7);
    var W = left + weeks * (cell + gap), H = top + 7 * (cell + gap);
    var max = Math.max(1, h.max || 1), today = todayIso();
    var out = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="날짜별 일정 건수">';
    ['월', '', '수', '', '금', '', ''].forEach(function (t, i) { if (t) out += '<text x="0" y="' + (top + i * (cell + gap) + 11) + '" font-size="11" fill="' + C.axis + '">' + t + '</text>'; });
    var lastM = -1;
    for (var w = 0; w < weeks; w++) {
      for (var d = 0; d < 7; d++) {
        var dt = new Date(s0); dt.setDate(s0.getDate() + w * 7 + d);
        if (dt < start || dt > end) continue;
        var k = iso(dt);
        if (dt.getDate() <= 7 && d === 0 || (w === 0 && d === ((start.getDay() + 6) % 7))) {
          if (dt.getMonth() !== lastM) { lastM = dt.getMonth(); out += '<text x="' + (left + w * (cell + gap)) + '" y="12" font-size="11" fill="' + C.ink2 + '">' + (dt.getMonth() + 1) + '월</text>'; }
        }
        var v = (h.days[k] || [0, 0]);
        var lvl = v[0] ? Math.min(5, 1 + Math.floor((v[0] - 1) * 4 / max)) : 0;
        out += '<rect class="hm" data-d="' + k + '" data-w="' + v[0] + '" data-r="' + v[1] + '" x="' + (left + w * (cell + gap)) + '" y="' + (top + d * (cell + gap)) +
          '" width="' + cell + '" height="' + cell + '" rx="3" fill="' + HEAT[lvl] + '"' + (k === today ? ' stroke="' + C.ink + '" stroke-width="1.5"' : '') + '><title>' + md(k) + ' 업무 ' + v[0] + '건 · 참고 ' + v[1] + '건</title></rect>';
      }
    }
    out += '</svg>';
    var leg = '<div class="ch-legend"><span>적음</span>' + HEAT.map(function (c) { return '<span><i style="background:' + c + '"></i></span>'; }).join('') + '<span>많음 (최대 ' + max + '건/일)</span><span>테두리 = 오늘</span></div>';
    return out + leg + '<p class="ch-tip" id="hm-tip">칸을 누르면 그날 건수</p>';
  }

  /* 01 라인: 히트맵과 같은 자료(heatmap.days)를 주(월요일 시작)마다 더함. 업무 = 강조색, 참고 = 회색. */
  function weekly(h) {
    if (!h || h.empty || !h.start || !h.end || !h.days) return null;
    var start = new Date(h.start + 'T00:00:00'), end = new Date(h.end + 'T00:00:00');
    var s0 = new Date(start); s0.setDate(s0.getDate() - ((s0.getDay() + 6) % 7));
    var out = [];
    for (var w0 = new Date(s0); w0 <= end; w0.setDate(w0.getDate() + 7)) {
      var a = 0, b = 0;
      for (var d = 0; d < 7; d++) { var dt = new Date(w0); dt.setDate(w0.getDate() + d); if (dt < start || dt > end) continue; var v = h.days[iso(dt)]; if (v) { a += v[0] || 0; b += v[1] || 0; } }
      out.push({ d: iso(w0), w: a, r: b });
    }
    return out.length > 1 ? out : null;
  }
  function line(h, esc) {
    var ws = weekly(h);
    if (!ws) return empty(h && h.src);
    var W = 340, H = 160, L = 26, R = 34, T = 16, B = 22, n = ws.length;
    var mx = Math.max.apply(null, ws.map(function (x) { return Math.max(x.w, x.r); }).concat([1]));
    var X = function (i) { return L + i * (W - L - R) / (n - 1); }, Y = function (v) { return T + (1 - v / mx) * (H - T - B); };
    var o = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="주별 일정 건수 라인 그래프">';
    [0, 0.5, 1].forEach(function (f) { var v = Math.round(mx * f); o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + C.line + '"/><text x="' + (L - 5) + '" y="' + (Y(v) + 3) + '" font-size="9" text-anchor="end" fill="' + C.axis + '">' + v + '</text>'; });
    var path = function (key) { return ws.map(function (x, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x[key]).toFixed(1); }).join(' '); };
    o += '<path d="' + path('r') + '" fill="none" stroke="' + C.gray + '" stroke-width="1.6" stroke-linejoin="round"/>';
    o += '<path d="' + path('w') + '" fill="none" stroke="' + A + '" stroke-width="2.2" stroke-linejoin="round"/>';
    var lastM = -1;
    ws.forEach(function (x, i) {
      var th = new Date(x.d + 'T00:00:00'); th.setDate(th.getDate() + 3); var m = th.getMonth() + 1; /* 그 주 목요일의 달 */
      if (m !== lastM) { lastM = m; o += '<text x="' + X(i) + '" y="' + (H - 6) + '" font-size="9" text-anchor="middle" fill="' + C.ink2 + '">' + m + '월</text>'; }
    });
    var today = todayIso(), ti = -1;
    ws.forEach(function (x, i) { if (x.d <= today) ti = i; });
    if (ti >= 0) o += '<line x1="' + X(ti) + '" x2="' + X(ti) + '" y1="' + T + '" y2="' + Y(0) + '" stroke="' + C.ink2 + '" stroke-dasharray="2 3"/><text x="' + (X(ti) + 3) + '" y="' + (Y(0) - 4) + '" font-size="9" fill="' + C.ink2 + '">이번 주</text>';
    var pk = 0; ws.forEach(function (x, i) { if (x.w > ws[pk].w) pk = i; });
    o += '<circle cx="' + X(pk) + '" cy="' + Y(ws[pk].w) + '" r="3.5" fill="' + A + '"/><text x="' + Math.min(X(pk) + 6, W - 2) + '" y="' + (Y(ws[pk].w) + 4) + '" font-size="10" font-weight="700" fill="' + A + '">' + ws[pk].w + '건</text>';
    o += '</svg>';
    return o + '<div class="ch-legend"><span><i style="background:' + A + '"></i>업무</span><span><i style="background:' + C.gray + '"></i>참고 일정</span><span>가장 많은 주: ' + md(ws[pk].d) + ' 주 ' + ws[pk].w + '건</span></div>';
  }

  /* 04 계단형 잔액 */
  function step(s, esc) {
    if (!s || s.empty || !s.points || !s.points.length || !(s.start > 0)) return empty(s && s.src);
    var W = 340, H = 170, L = 52, R = 10, T = 14, B = 26;
    var x0 = new Date(s.points[0].d).getTime(), x1 = Math.max(new Date(s.today).getTime(), new Date(s.points[s.points.length - 1].d).getTime()) + 3 * 864e5;
    if (!isFinite(x0) || !isFinite(x1) || x1 <= x0) return empty(s.src);
    var X = function (d) { return L + (new Date(d).getTime() - x0) / (x1 - x0) * (W - L - R); };
    var Y = function (v) { return T + (1 - v / s.start) * (H - T - B); };
    var o = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="글로컬 잔액 계단 그래프">';
    [0, 0.5, 1].forEach(function (f) { var v = s.start * f; o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + C.line + '"/><text x="' + (L - 6) + '" y="' + (Y(v) + 3) + '" font-size="9" text-anchor="end" fill="' + C.axis + '">' + man(v) + '</text>'; });
    var p = 'M' + X(s.points[0].d) + ' ' + Y(s.points[0].bal);
    for (var i = 1; i < s.points.length; i++) p += ' H' + X(s.points[i].d) + ' V' + Y(s.points[i].bal);
    p += ' H' + X(s.today);
    o += '<path d="' + p + ' V' + Y(0) + ' H' + X(s.points[0].d) + ' Z" fill="' + A + '" opacity=".07"/>';
    o += '<path d="' + p + '" fill="none" stroke="' + A + '" stroke-width="2.2"/>';
    s.points.forEach(function (pt, i) {
      o += '<circle cx="' + X(pt.d) + '" cy="' + Y(pt.bal) + '" r="3.5" fill="#fff" stroke="' + A + '" stroke-width="2"><title>' + md(pt.d) + ' ' + esc(pt.what) + ' → 잔액 ' + won(pt.bal) + '</title></circle>';
      o += '<text x="' + X(pt.d) + '" y="' + (H - 8) + '" font-size="9" text-anchor="' + (i ? 'middle' : 'start') + '" fill="' + C.ink2 + '">' + md(pt.d) + '</text>';
    });
    var last = s.points[s.points.length - 1];
    o += '<text x="' + (X(s.today) - 2) + '" y="' + (Y(last.bal) - 6) + '" font-size="10" font-weight="700" text-anchor="end" fill="' + A + '">' + man(last.bal) + '</text>';
    o += '<text x="' + X(s.today) + '" y="' + (H - 8) + '" font-size="9" text-anchor="end" fill="' + C.axis + '">오늘</text>';
    o += '</svg>';
    var list = s.points.slice(1).map(function (pt) { return md(pt.d) + ' −' + won(pt.amt) + ' (' + esc(pt.what) + ')'; }).join('<br>');
    return o + '<p class="ch-tip">지금 잔액 ' + won(last.bal) + ' / 배정 확인분 ' + won(s.start) + '</p>' +
      '<p class="ch-sub" style="margin:4px 0 0">' + list + '</p><p class="ch-src">' + esc(s.note) + '</p>';
  }

  /* 05 스파크라인 표: 선은 회색, 마지막 점만 강조색 */
  function spark(xs, ys) {
    var W = 92, H = 26, n = ys.length;
    if (!n) return '';
    var mx = Math.max.apply(null, ys), mn = Math.min.apply(null, ys), rng = (mx - mn) || 1;
    var pts = ys.map(function (v, i) { return [(n === 1 ? W / 2 : 2 + i * (W - 4) / (n - 1)), 3 + (1 - (v - mn) / rng) * (H - 6)]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var lp = pts[pts.length - 1];
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + C.gray + '" stroke-width="1.6" stroke-linejoin="round"/><circle cx="' + lp[0] + '" cy="' + lp[1] + '" r="2.6" fill="' + A + '"/></svg>';
  }
  function sparks(s, esc) {
    if (!s || s.empty || !s.rows || !s.rows.length) return empty();
    var h = '<table class="ch-tbl"><tbody>';
    var srcs = {};
    s.rows.forEach(function (r) {
      var y = r.y || [], last = y[y.length - 1], prev = y.length > 1 ? y[y.length - 2] : null;
      var df = prev == null ? '' : (last > prev ? '<span class="ch-up">▲' + (last - prev) + '</span>' : (last < prev ? '<span class="ch-dn">▼' + (prev - last) + '</span>' : '<span class="ch-eq">–</span>'));
      h += '<tr><td class="n" title="' + esc(r.name) + '">' + esc(r.name) + '</td><td>' + spark(r.x, y) + '</td><td class="v">' + last + '<small style="color:var(--muted);font-weight:500"> ' + esc(r.unit) + '</small></td><td class="d">' + df + '</td></tr>';
      srcs[r.src] = 1;
    });
    return h + '</tbody></table><p class="ch-src">출처: ' + esc(Object.keys(srcs).join(' · ')) + ' · 부서는 3~10월(10월은 21일까지)</p>';
  }

  /* 07 범프: sparks 의 부서 줄(문서대장, 단위 건/월)만 골라 달마다 순위(건수 많은 순, 같으면 이름순). 지금 1위만 강조색. */
  function deptRows(s) {
    if (!s || s.empty || !s.rows) return [];
    return s.rows.filter(function (r) { return /docreg/.test(r.src || '') && r.unit === '건/월' && r.y && r.y.length > 1; });
  }
  function bump(s, esc) {
    var rows = deptRows(s);
    if (rows.length < 2) return empty();
    var xs = rows[0].x, n = xs.length;
    if (!rows.every(function (r) { return r.y.length === n; })) return empty();
    var rank = rows.map(function () { return []; });
    for (var i = 0; i < n; i++) {
      var ord = rows.map(function (r, k) { return k; }).sort(function (a, b) { return (rows[b].y[i] - rows[a].y[i]) || (rows[a].name < rows[b].name ? -1 : 1); });
      ord.forEach(function (k, rk) { rank[k][i] = rk + 1; });
    }
    var m = rows.length, W = 340, L = 18, R = 112, T = 10, B = 20, H = T + B + (m - 1) * 22 + 8;
    var X = function (i) { return L + i * (W - L - R) / (n - 1); }, Y = function (r) { return T + 4 + (r - 1) * 22; };
    var top = rank.map(function (r) { return r[n - 1]; }).indexOf(1);
    var o = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="부서별 문서 건수 순위 범프 차트">';
    for (var r = 1; r <= m; r++) o += '<text x="0" y="' + (Y(r) + 3) + '" font-size="9" fill="' + C.axis + '">' + r + '위</text>';
    var draw = function (k) {
      var hi = k === top, col = hi ? A : C.gray;
      var d = rank[k].map(function (rk, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(rk); }).join(' ');
      var g = '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (hi ? 2.6 : 1.6) + '" stroke-linejoin="round"/>';
      rank[k].forEach(function (rk, i) { g += '<circle cx="' + X(i) + '" cy="' + Y(rk) + '" r="' + (hi ? 3.4 : 2.6) + '" fill="' + col + '"><title>' + esc(rows[k].name) + ' ' + esc(xs[i]) + ' ' + rows[k].y[i] + '건 · ' + rk + '위</title></circle>'; });
      g += '<text x="' + (X(n - 1) + 7) + '" y="' + (Y(rank[k][n - 1]) + 3) + '" font-size="9.5"' + (hi ? ' font-weight="700"' : '') + ' fill="' + (hi ? A : C.ink2) + '">' + esc(rows[k].name) + '</text>';
      return g;
    };
    rows.forEach(function (r0, k) { if (k !== top) o += draw(k); });
    if (top >= 0) o += draw(top);
    xs.forEach(function (x, i) { o += '<text x="' + X(i) + '" y="' + (H - 4) + '" font-size="9" text-anchor="middle" fill="' + C.ink2 + '">' + esc(String(x).replace(/^0/, '')) + '</text>'; });
    o += '</svg>';
    return o + '<p class="ch-src">출처: ' + esc(rows[0].src) + ' · 10월은 21일까지 · 건수가 같으면 이름순</p>';
  }

  /* 02 영역: sparks 의 「외부기관 중요문서」 줄(건/월) 한 개. 강조색 선 + 옅은 면. */
  function area(s, esc) {
    var r = s && !s.empty && s.rows ? s.rows.filter(function (x) { return x.name === '외부기관 중요문서'; })[0] : null;
    if (!r || !r.y || r.y.length < 2) return empty();
    var ys = r.y, n = ys.length, W = 340, H = 150, L = 24, R = 12, T = 16, B = 22;
    var mx = Math.max.apply(null, ys.concat([1]));
    var X = function (i) { return L + i * (W - L - R) / (n - 1); }, Y = function (v) { return T + (1 - v / mx) * (H - T - B); };
    var o = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="외부기관 중요문서 월별 영역 그래프">';
    [0, 1].forEach(function (f) { var v = Math.round(mx * f); o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + C.line + '"/><text x="' + (L - 5) + '" y="' + (Y(v) + 3) + '" font-size="9" text-anchor="end" fill="' + C.axis + '">' + v + '</text>'; });
    var d = ys.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
    o += '<path d="' + d + ' L' + X(n - 1) + ' ' + Y(0) + ' L' + X(0) + ' ' + Y(0) + ' Z" fill="' + A + '" opacity=".12"/>';
    o += '<path d="' + d + '" fill="none" stroke="' + A + '" stroke-width="2" stroke-linejoin="round"/>';
    var pk = ys.indexOf(mx);
    ys.forEach(function (v, i) {
      o += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="' + (i === pk ? 3.5 : 2.2) + '" fill="' + (i === pk ? A : '#fff') + '" stroke="' + A + '" stroke-width="1.4"><title>' + esc(r.x[i]) + ' ' + v + '건</title></circle>';
      o += '<text x="' + X(i) + '" y="' + (H - 6) + '" font-size="9" text-anchor="middle" fill="' + C.ink2 + '">' + esc(String(r.x[i]).replace(/^0/, '')) + '</text>';
    });
    o += '<text x="' + X(pk) + '" y="' + (Y(mx) - 7) + '" font-size="10" font-weight="700" text-anchor="middle" fill="' + A + '">' + mx + '건</text>';
    o += '</svg>';
    return o + '<p class="ch-src">출처: ' + esc(r.src) + '</p>';
  }

  /* 주머니별 강사료: 주머니마다 작은 막대 차트(각자 y축). 쌓거나 더하지 않음. 집행=진한 강조색 칸, 예정·추정=빗금+점선. */
  function pocketBars(se, months, idx, esc) {
    var ys = se.y || [], n = months.length;
    var mx = Math.max.apply(null, ys.concat([0]));
    if (se.empty || !n || !(mx > 0) || !isFinite(mx)) return empty();
    var W = 340, H = 118, L = 40, R = 6, T = 10, B = 20, slot = (W - L - R) / n, bw = Math.min(30, slot * 0.62);
    var Y = function (v) { return T + (1 - v / mx) * (H - T - B); };
    var pid = 'ch-hatch-' + idx;
    var o = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(se.pocket) + ' 강사료 월별">' +
      '<defs><pattern id="' + pid + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#EEF3FC"/><line x1="0" y1="0" x2="0" y2="6" stroke="' + A + '" stroke-width="1.6" opacity=".6"/></pattern></defs>';
    [0, 1].forEach(function (f) { o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(mx * f) + '" y2="' + Y(mx * f) + '" stroke="' + C.line + '"/><text x="' + (L - 5) + '" y="' + (Y(mx * f) + 3) + '" font-size="9" text-anchor="end" fill="' + C.axis + '">' + man(mx * f) + '</text>'; });
    months.forEach(function (m, i) {
      var v = ys[i] || 0, k = (se.kind || [])[i] || '', cx = L + slot * (i + 0.5);
      if (v > 0) {
        var real = k === '집행';
        o += '<rect x="' + (cx - bw / 2) + '" y="' + Y(v) + '" width="' + bw + '" height="' + (Y(0) - Y(v)) + '" rx="3" fill="' + (real ? A : 'url(#' + pid + ')') + '"' +
          (real ? '' : ' stroke="' + A + '" stroke-width="1" stroke-dasharray="3 2"') + '><title>' + esc(se.pocket) + ' ' + Number(m.slice(5)) + '월 ' + won(v) + ' (' + esc(k) + ')</title></rect>';
      }
      o += '<text x="' + cx + '" y="' + (H - 6) + '" font-size="9" text-anchor="middle" fill="' + C.ink2 + '">' + Number(m.slice(5)) + '월</text>';
    });
    o += '</svg>';
    var list = ys.map(function (v, i) { return v ? Number(months[i].slice(5)) + '월 ' + man(v) + '(' + esc((se.kind || [])[i] || '') + ')' : ''; }).filter(Boolean).join(' · ');
    return o + '<p class="ch-sub">' + list + '</p>';
  }
  function stacked(s, esc) {
    if (!s || s.empty || !s.months || !s.months.length || !s.series) return empty(s && s.src);
    var leg = '<div class="ch-legend" style="margin:0 0 4px"><span><i style="background:' + A + '"></i>집행(진한 칸)</span>' +
      '<span><i style="background:repeating-linear-gradient(45deg,' + A + ' 0 1.5px,#EEF3FC 1.5px 4px);outline:1px dashed ' + A + '"></i>예정·추정(빗금)</span><span>주머니마다 y축 따로 · 더하지 않음</span></div>';
    return leg + s.series.map(function (se, i) {
      return '<div class="ch-pk"><h3>' + esc(se.pocket) + '</h3>' + pocketBars(se, s.months, i, esc) + '</div>';
    }).join('');
  }

  function render(el, api) {
    var esc = api.esc;
    style();
    el.classList.add('wide'); /* 데스크톱에서 카드 2~3열. 폰(390px)은 한 줄. 다른 화면 가면 app.js 가 뗌 */
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    fetch(new URL('data/charts.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('charts'); return r.json(); })
      .then(function (c) {
        var h = '<div class="ch-wrap"><section class="ch-head"><h1>업무 차트</h1><p>실제 자료만 그려요. 자료가 없으면 「데이터 없음」. 돈은 주머니(어학연수·글로컬·대학회계)별로 따로 봐요.</p></section><div class="ch-grid">';
        h += fig('08', '캘린더 히트맵', '요일·주마다 일이 몰리는 때를 한눈에', '일정·업무량 달력', '날짜별 업무 건수 · 9월~2월 · 진할수록 많음', heatmap(c.heatmap, esc), c.heatmap && c.heatmap.src, esc);
        h += fig('01', '라인 그래프', '주마다 일정 건수가 오르내리는 흐름', '주별 일정 건수', '건/주 · 업무와 참고 일정', line(c.heatmap, esc), c.heatmap && !c.heatmap.empty ? '달력 히트맵과 같은 자료를 주마다 더함' : '', esc);
        h += fig('04', '계단형 라인', '지출결의가 나간 날 잔액이 뚝 바뀌는 모양', '글로컬 예산 잔액', c.step && c.step.label, step(c.step, esc), c.step && c.step.src, esc);
        h += fig('', '막대 그래프', '주머니마다 따로, 집행과 예정·추정을 구분', '강사료 월별 · 주머니별', (c.stacked && c.stacked.label) + ' · 합계 아님', stacked(c.stacked, esc), c.stacked && c.stacked.src, esc);
        h += fig('05', '스파크라인', '표 안의 작은 추세와 바로 앞 대비 증감', '할 일·부서 추세', '마지막 값 · 바로 앞 대비', sparks(c.sparks, esc), '', esc);
        h += fig('07', '범프 차트', '부서별 문서 건수 순위가 달마다 바뀌는 흐름', '부서별 문서 순위', '월별 순위 · 지금 1위만 강조', bump(c.sparks, esc), '', esc);
        h += fig('02', '영역 그래프', '외부기관 문서가 달마다 얼마나 오는지', '외부기관 중요문서', '건/월', area(c.sparks, esc), '', esc);
        h += '</div></div>';
        el.innerHTML = h;
        var tip = el.querySelector('#hm-tip');
        el.querySelectorAll('rect.hm').forEach(function (r) {
          r.addEventListener('click', function () { if (tip) tip.textContent = md(r.getAttribute('data-d')) + ' 업무 ' + r.getAttribute('data-w') + '건 · 참고 ' + r.getAttribute('data-r') + '건'; });
        });
      })
      .catch(function () { el.innerHTML = '<section class="card">' + empty('data/charts.json 을 못 불러왔어요') + '</section>'; });
  }
  if (root.ShellModules) root.ShellModules.charts = { id: 'charts', tab: '차트', icon: '', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

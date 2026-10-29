/* 업무 차트 (#/charts): 08 캘린더 히트맵 · 04 계단형(글로컬 잔액) · 05 스파크라인 표 · 03 누적 영역(주머니별 강사료).
   자료 = data/charts.json (tools/make_charts.py, refresh_all 에서 갱신). 외부 라이브러리 없이 SVG 직접.
   예시 데이터 금지: empty 이면 「데이터 없음」. 돈 주머니(어학연수·글로컬·대학회계)는 따로 그리고 합계 숫자는 안 씀. 대장 kv 261029 19:05. */
(function (root) {
  'use strict';
  var C = { ink: '#191F28', ink2: '#4E5968', muted: '#8B95A1', line: '#E5E8EB', blue: '#3182F6', pockets: { '어학연수': '#3182F6', '글로컬': '#00A0A0', '대학회계': '#B0B8C1' } };
  var HEAT = ['#F2F4F6', '#D6E7FD', '#A9CCFB', '#6AA8F8', '#3182F6', '#1B64DA'];
  var CSS = [
    '.ch-wrap{max-width:760px;margin:0 auto;padding:0 12px 48px;box-sizing:border-box}',
    '.ch-head{padding:8px 2px 6px}.ch-head h1{margin:0 0 4px;font-size:1.35rem;letter-spacing:-.02em}',
    '.ch-head p{margin:0;font-size:.8rem;color:var(--muted);line-height:1.45}',
    '.ch-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 14px 12px;margin:0 0 12px}',
    '.ch-card h2{margin:0 0 2px;font-size:1rem;letter-spacing:-.01em;display:flex;gap:6px;align-items:baseline}',
    '.ch-card h2 small{font-size:.72rem;color:var(--muted);font-weight:600}',
    '.ch-sub{font-size:.78rem;color:var(--ink-2);margin:0 0 10px;line-height:1.4}',
    '.ch-src{font-size:.72rem;color:var(--muted);margin:8px 0 0;line-height:1.4;word-break:keep-all}',
    '.ch-svg{width:100%;height:auto;display:block;overflow:visible}',
    '.ch-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}',
    '.ch-empty{padding:22px 8px;text-align:center;color:var(--muted);font-weight:700;background:var(--soft);border-radius:12px}',
    '.ch-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:.75rem;color:var(--ink-2);margin:6px 0 0}',
    '.ch-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}',
    '.ch-tip{font-size:.8rem;color:var(--ink);min-height:1.2em;margin:6px 0 0;font-weight:600}',
    '.ch-tbl{width:100%;border-collapse:collapse;font-size:.82rem}',
    '.ch-tbl td{padding:7px 4px;border-top:1px solid var(--line);vertical-align:middle}',
    '.ch-tbl td.n{white-space:nowrap;max-width:9.5rem;overflow:hidden;text-overflow:ellipsis}',
    '.ch-tbl td.v{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}',
    '.ch-tbl td.d{text-align:right;font-size:.74rem;white-space:nowrap}',
    '.ch-up{color:#F04452}.ch-dn{color:#3182F6}.ch-eq{color:var(--muted)}'
  ].join('\n');

  function style() {
    if (document.getElementById('ch-style')) return;
    var s = document.createElement('style'); s.id = 'ch-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function won(n) { return (n == null ? '' : Math.round(n).toLocaleString('ko-KR')) + '원'; }
  function man(n) { return Math.round(n / 10000).toLocaleString('ko-KR') + '만'; }
  function md(d) { var p = String(d).split('-'); return Number(p[1]) + '.' + Number(p[2]) + '.'; }
  function empty(msg) { return '<div class="ch-empty">데이터 없음' + (msg ? '<br><small style="font-weight:500">' + msg + '</small>' : '') + '</div>'; }
  function card(title, tag, sub, body, src, esc) {
    return '<section class="ch-card"><h2>' + esc(title) + ' <small>' + esc(tag) + '</small></h2>' +
      (sub ? '<p class="ch-sub">' + esc(sub) + '</p>' : '') + body + (src ? '<p class="ch-src">출처: ' + esc(src) + '</p>' : '') + '</section>';
  }

  /* 08 캘린더 히트맵 */
  function heatmap(h, esc) {
    if (!h || h.empty) return empty(h && h.src);
    var start = new Date(h.start + 'T00:00:00'), end = new Date(h.end + 'T00:00:00');
    var s0 = new Date(start); s0.setDate(s0.getDate() - ((s0.getDay() + 6) % 7)); /* 월요일 시작 */
    var cell = 13, gap = 3, top = 16, left = 18;
    var weeks = Math.ceil(((end - s0) / 864e5 + 1) / 7);
    var W = left + weeks * (cell + gap), H = top + 7 * (cell + gap);
    var max = Math.max(1, h.max || 1);
    var todayIso = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    var out = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" style="min-width:' + W + 'px" role="img" aria-label="날짜별 일정 건수">';
    ['월', '', '수', '', '금', '', ''].forEach(function (t, i) { if (t) out += '<text x="0" y="' + (top + i * (cell + gap) + 10) + '" font-size="9" fill="' + C.muted + '">' + t + '</text>'; });
    var lastM = -1;
    for (var w = 0; w < weeks; w++) {
      for (var d = 0; d < 7; d++) {
        var dt = new Date(s0); dt.setDate(s0.getDate() + w * 7 + d);
        if (dt < start || dt > end) continue;
        var iso = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
        if (dt.getDate() <= 7 && d === 0 || (w === 0 && d === ((start.getDay() + 6) % 7))) {
          if (dt.getMonth() !== lastM) { lastM = dt.getMonth(); out += '<text x="' + (left + w * (cell + gap)) + '" y="10" font-size="9" fill="' + C.ink2 + '">' + (dt.getMonth() + 1) + '월</text>'; }
        }
        var v = (h.days[iso] || [0, 0]);
        var lvl = v[0] ? Math.min(5, 1 + Math.floor((v[0] - 1) * 4 / max)) : 0;
        out += '<rect class="hm" data-d="' + iso + '" data-w="' + v[0] + '" data-r="' + v[1] + '" x="' + (left + w * (cell + gap)) + '" y="' + (top + d * (cell + gap)) +
          '" width="' + cell + '" height="' + cell + '" rx="3" fill="' + HEAT[lvl] + '"' + (iso === todayIso ? ' stroke="' + C.ink + '" stroke-width="1.5"' : '') + '><title>' + md(iso) + ' 업무 ' + v[0] + '건 · 참고 ' + v[1] + '건</title></rect>';
      }
    }
    out += '</svg>';
    var leg = '<div class="ch-legend"><span>적음</span>' + HEAT.map(function (c) { return '<span><i style="background:' + c + '"></i></span>'; }).join('') + '<span>많음 (최대 ' + max + '건/일)</span><span>□ 테두리 = 오늘</span></div>';
    return '<div class="ch-scroll">' + out + '</div>' + leg + '<p class="ch-tip" id="hm-tip">칸을 누르면 그날 건수</p>';
  }

  /* 04 계단형 잔액 */
  function step(s, esc) {
    if (!s || s.empty) return empty(s && s.src);
    var W = 340, H = 170, L = 52, R = 10, T = 14, B = 26;
    var x0 = new Date(s.points[0].d).getTime(), x1 = Math.max(new Date(s.today).getTime(), new Date(s.points[s.points.length - 1].d).getTime()) + 3 * 864e5;
    var X = function (d) { return L + (new Date(d).getTime() - x0) / (x1 - x0) * (W - L - R); };
    var Y = function (v) { return T + (1 - v / s.start) * (H - T - B); };
    var o = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="글로컬 잔액 계단 그래프">';
    [0, 0.5, 1].forEach(function (f) { var v = s.start * f; o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + C.line + '"/><text x="' + (L - 6) + '" y="' + (Y(v) + 3) + '" font-size="9" text-anchor="end" fill="' + C.muted + '">' + man(v) + '</text>'; });
    var p = 'M' + X(s.points[0].d) + ' ' + Y(s.points[0].bal);
    for (var i = 1; i < s.points.length; i++) p += ' H' + X(s.points[i].d) + ' V' + Y(s.points[i].bal);
    p += ' H' + X(s.today);
    o += '<path d="' + p + ' V' + Y(0) + ' H' + X(s.points[0].d) + ' Z" fill="' + C.pockets['글로컬'] + '" opacity=".08"/>';
    o += '<path d="' + p + '" fill="none" stroke="' + C.pockets['글로컬'] + '" stroke-width="2.2"/>';
    s.points.forEach(function (pt, i) {
      o += '<circle cx="' + X(pt.d) + '" cy="' + Y(pt.bal) + '" r="3.5" fill="#fff" stroke="' + C.pockets['글로컬'] + '" stroke-width="2"><title>' + md(pt.d) + ' ' + esc(pt.what) + ' → 잔액 ' + won(pt.bal) + '</title></circle>';
      o += '<text x="' + X(pt.d) + '" y="' + (H - 8) + '" font-size="9" text-anchor="' + (i ? 'middle' : 'start') + '" fill="' + C.ink2 + '">' + md(pt.d) + '</text>';
    });
    o += '<text x="' + X(s.today) + '" y="' + (H - 8) + '" font-size="9" text-anchor="end" fill="' + C.muted + '">오늘</text>';
    o += '</svg>';
    var last = s.points[s.points.length - 1];
    var list = s.points.slice(1).map(function (pt) { return md(pt.d) + ' −' + won(pt.amt) + ' (' + esc(pt.what) + ')'; }).join('<br>');
    return o + '<p class="ch-tip">지금 잔액 ' + won(last.bal) + ' / 배정 확인분 ' + won(s.start) + '</p>' +
      '<p class="ch-sub" style="margin:4px 0 0">' + list + '</p><p class="ch-src">' + esc(s.note) + '</p>';
  }

  /* 05 스파크라인 표 */
  function spark(xs, ys) {
    var W = 92, H = 26, n = ys.length;
    if (!n) return '';
    var mx = Math.max.apply(null, ys), mn = Math.min.apply(null, ys), rng = (mx - mn) || 1;
    var pts = ys.map(function (v, i) { return [(n === 1 ? W / 2 : 2 + i * (W - 4) / (n - 1)), 3 + (1 - (v - mn) / rng) * (H - 6)]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var lp = pts[pts.length - 1];
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + C.blue + '" stroke-width="1.6" stroke-linejoin="round"/><circle cx="' + lp[0] + '" cy="' + lp[1] + '" r="2.4" fill="' + C.blue + '"/></svg>';
  }
  function sparks(s, esc) {
    if (!s || s.empty) return empty();
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

  /* 03 누적 영역 (주머니별) */
  function stacked(s, esc) {
    if (!s || s.empty) return empty(s && s.src);
    var W = 340, H = 180, L = 40, R = 10, T = 12, B = 24, n = s.months.length;
    var X = function (i) { return L + i * (W - L - R) / (n - 1); };
    var acc = s.months.map(function () { return 0; });
    var layers = s.series.map(function (se) { var lo = acc.slice(); acc = acc.map(function (a, i) { return a + se.y[i]; }); return { se: se, lo: lo, hi: acc.slice() }; });
    var mx = Math.max.apply(null, acc) || 1;
    var Y = function (v) { return T + (1 - v / mx) * (H - T - B); };
    var o = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="주머니별 강사료 누적 영역">';
    [0, 0.5, 1].forEach(function (f) { o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(mx * f) + '" y2="' + Y(mx * f) + '" stroke="' + C.line + '"/><text x="' + (L - 5) + '" y="' + (Y(mx * f) + 3) + '" font-size="9" text-anchor="end" fill="' + C.muted + '">' + man(mx * f) + '</text>'; });
    layers.forEach(function (ly) {
      if (ly.se.empty) return;
      var up = ly.hi.map(function (v, i) { return X(i) + ' ' + Y(v); }).join(' L');
      var dn = ly.lo.map(function (v, i) { return X(i) + ' ' + Y(v); }).reverse().join(' L');
      var col = C.pockets[ly.se.pocket] || C.muted;
      o += '<path d="M' + up + ' L' + dn + ' Z" fill="' + col + '" opacity=".78"><title>' + esc(ly.se.pocket) + '</title></path>';
      ly.hi.forEach(function (v, i) { if (ly.se.y[i]) o += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="5" fill="transparent"><title>' + esc(ly.se.pocket) + ' ' + Number(s.months[i].slice(5)) + '월 ' + won(ly.se.y[i]) + ' (' + esc(ly.se.kind[i]) + ')</title></circle>'; });
    });
    s.months.forEach(function (m, i) { o += '<text x="' + X(i) + '" y="' + (H - 8) + '" font-size="9" text-anchor="middle" fill="' + C.ink2 + '">' + Number(m.slice(5)) + '월</text>'; });
    o += '</svg>';
    var leg = '<div class="ch-legend">' + s.series.map(function (se) {
      return '<span><i style="background:' + (C.pockets[se.pocket] || C.muted) + (se.empty ? ';opacity:.35' : '') + '"></i>' + esc(se.pocket) + (se.empty ? ' · 데이터 없음' : '') + '</span>';
    }).join('') + '</div>';
    var rows = '<table class="ch-tbl" style="margin-top:8px"><tbody>' + s.series.filter(function (se) { return !se.empty; }).map(function (se) {
      return '<tr><td class="n">' + esc(se.pocket) + '</td><td style="font-size:.74rem;color:var(--ink-2)">' + se.y.map(function (v, i) { return v ? Number(s.months[i].slice(5)) + '월 ' + man(v) + '(' + esc(se.kind[i]) + ')' : ''; }).filter(Boolean).join(' · ') + '</td></tr>';
    }).join('') + '</tbody></table>';
    return o + leg + rows;
  }

  function render(el, api) {
    var esc = api.esc;
    style();
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    fetch(new URL('data/charts.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('charts'); return r.json(); })
      .then(function (c) {
        var h = '<div class="ch-wrap"><section class="ch-head"><h1>업무 차트</h1><p>실제 자료만 그려요. 자료가 없으면 「데이터 없음」. 돈은 주머니(어학연수·글로컬·대학회계)별로 따로 봐요.</p></section>';
        h += card('일정·업무량 달력', '히트맵', '날짜별 유진님 할 일·교수님 일정 건수(진할수록 많음). 9월~2월.', heatmap(c.heatmap, esc), c.heatmap && c.heatmap.src, esc);
        h += card('글로컬 예산 잔액', '계단형', c.step && c.step.label, step(c.step, esc), c.step && c.step.src, esc);
        h += card('할 일·부서 추세', '스파크라인', '마지막 값과 바로 앞 대비 증감.', sparks(c.sparks, esc), '', esc);
        h += card('강사료 월별 구성', '누적 영역', (c.stacked && c.stacked.label) + ' · 색마다 다른 주머니(합계 아님)', stacked(c.stacked, esc), c.stacked && c.stacked.src, esc);
        h += '</div>';
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

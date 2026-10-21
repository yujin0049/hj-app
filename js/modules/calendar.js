/* 계획 달력: 현황판 시트(정본)·일정총괄에서 스크립트가 만든 data/calendar.json 을 읽기만 해요.
   레인 3개는 섞지 않아요: 유진님 할 일(파랑) · 교수님 일정(보라) · 참고(회색, 유진님 일 아님).
   이 파일은 모든 화면 위 「마지막 갱신」 띠(HJStamp)도 맡아요(app.js 안 건드림). 개인정보 없음. */
(function (root) {
  'use strict';
  var LANES = [['yujin', '유진님 할 일'], ['prof', '교수님 일정'], ['ref', '참고']];
  var view = { mode: 'month', cur: '', sel: '', lanes: { yujin: 1, prof: 1, ref: 1 }, bot: '', status: '', group: '', showDone: false };
  var D = null;

  function base(p) { return new URL(p, document.baseURI).href; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function need() {
    if (root.HJCal) return Promise.resolve(root.HJCal);
    if (need.p) return need.p;
    need.p = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = base('js/calendar-core.js?v=1');
      s.onload = function () { res(root.HJCal); }; s.onerror = function () { rej(new Error('calendar-core')); };
      document.head.appendChild(s);
    });
    return need.p;
  }
  function getJSON(p) { return fetch(base(p), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(p); return r.json(); }); }
  function loadAll() {
    if (D) return Promise.resolve(D);
    return need().then(function () {
      return Promise.all([getJSON('data/calendar.json'), getJSON('data/status.json'), getJSON('data/meta.json').catch(function () { return null; }),
        getJSON('data/ojnt_progress.json').catch(function () { return null; })]);
    }).then(function (a) { D = { cal: a[0], st: a[1], meta: a[2], ojnt: a[3] }; root.HJData = D; return D; });
  }

  /* ---------- 모든 화면 위 「마지막 갱신」 ---------- */
  var stampMeta;
  function stamp() {
    var shell = document.getElementById('shell'), v = document.getElementById('view');
    if (!shell || !v) return;
    var el = document.getElementById('hj-stamp');
    if (!el) { el = document.createElement('div'); el.id = 'hj-stamp'; v.parentNode.insertBefore(el, v); }
    style(); /* 띠 모양(여백·글씨 크기)은 달력을 안 열어도 적용 */
    /* 봇 작업 현황(#/bots)은 자기 시각(현황판 읽은 시각) 하나만 보여요 → 달력 띠는 숨김 */
    el.hidden = /^#\/bots(\/|\?|$)/.test(location.hash || '');
    if (el.hidden) return;
    function paintStamp(meta) {
      var C = root.HJCal, s = C.staleness(meta);
      el.className = s.warn ? 'warn' : '';
      el.innerHTML = '<span>달력 자료 갱신 ' + esc(meta && meta.refreshed_at ? meta.refreshed_at : '-') + ' (KST)</span>' +
        (s.warn ? '<b>· ' + esc(s.why) + '</b>' : '');
    }
    if (stampMeta !== undefined) { paintStamp(stampMeta); return; }
    need().then(function () { return getJSON('data/meta.json').catch(function () { return null; }); })
      .then(function (m) { stampMeta = m; paintStamp(m); }).catch(function () { /* 띠 없이 */ });
  }
  root.HJStamp = stamp;
  if (document.readyState !== 'loading') setTimeout(stamp, 0); else document.addEventListener('DOMContentLoaded', stamp);
  root.addEventListener && root.addEventListener('hashchange', function () { setTimeout(stamp, 0); });

  var CSS = [
    '#hj-stamp{max-width:1120px;margin:0 auto;padding:6px 16px 0;font-size:12px;color:var(--muted);display:flex;gap:6px;flex-wrap:wrap}',
    '#hj-stamp[hidden]{display:none}#hj-stamp.warn{color:var(--no)}#hj-stamp.warn b{font-weight:700}',
    '.cl-stale{background:var(--nobg);color:var(--no);border-radius:14px;padding:12px 14px;font-weight:600;margin-bottom:12px}',
    '.cl-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cl-top h2{margin:0;font-size:22px;flex:1}',
    '.cl-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 4px}',
    '.cl-kpi div{background:var(--soft);border-radius:14px;padding:10px 12px}.cl-kpi b{display:block;font-size:22px}.cl-kpi span{font-size:12px;color:var(--muted)}',
    '.cl-kpi .k-late b{color:var(--no)}.cl-kpi .k-soon b{color:var(--warn)}.cl-kpi .k-yu b{color:var(--navy)}.cl-kpi .k-chk b{color:#6D28D9}',
    '.cl-seg{display:inline-flex;background:var(--soft);border-radius:12px;padding:3px}',
    '.cl-seg button{border:0;background:none;padding:7px 16px;border-radius:10px;font-weight:700;color:var(--muted);font-size:14px;cursor:pointer}',
    '.cl-seg button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}',
    '.cl-nav{display:flex;align-items:center;gap:6px;margin:14px 0 8px}.cl-nav h3{flex:1;margin:0;font-size:18px}',
    '.cl-nav button{border:0;background:var(--soft);border-radius:10px;padding:7px 12px;font-weight:700;cursor:pointer;color:var(--ink-2)}',
    '.cl-leg{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}',
    '.cl-leg button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;cursor:pointer;color:var(--ink-2)}',
    '.cl-leg button i{display:inline-block;width:9px;height:9px;border-radius:5px;margin-right:6px;vertical-align:0}',
    '.cl-leg button.off{opacity:.4;text-decoration:line-through}',
    '.ln-yujin{background:#3182F6}.ln-prof{background:#8B5CF6}.ln-ref{background:#B0B8C1}',
    '.cl-flt{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.cl-flt select{width:auto;flex:1 1 150px;min-width:0;margin:0;height:auto;border:1px solid var(--line);border-radius:10px;padding:7px 8px;background:#fff;font-size:13px;color:var(--ink-2);max-width:100%}',
    '.cl-flt label{font-size:13px;color:var(--ink-2);display:flex;align-items:center;gap:4px}',
    '.cl-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px}',
    '.cl-grid .wd{font-size:12px;color:var(--muted);text-align:center;padding:4px 0}.cl-grid .wd.sun{color:var(--no)}',
    '.cl-ev.band{border-radius:6px 0 0 6px;margin-right:-5px}.cl-ev.band.cont{border-radius:0;margin-left:-5px;opacity:.85}.cl-ev.band.last{border-radius:0 6px 6px 0;margin-right:0}',
    '.cl-day{min-height:78px;border-radius:12px;padding:4px;cursor:pointer;background:#fff;border:1px solid transparent;overflow:hidden}',
    '.cl-day.out{opacity:.35}.cl-day.sel{border-color:var(--navy)}.cl-day .n{font-size:12px;font-weight:700;display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px}',
    '.cl-day.today .n{background:var(--ink);color:#fff}.cl-day.sun .n{color:var(--no)}.cl-day.today.sun .n{color:#fff}',
    '.cl-ev{display:block;font-size:11px;line-height:1.35;border-radius:5px;padding:1px 4px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.cl-ev.l-yujin{background:#E8F3FF;color:#1B64DA}.cl-ev.l-prof{background:#F3EEFF;color:#6D28D9}.cl-ev.l-ref{background:#F2F4F6;color:#6B7684}',
    '.cl-ev.s-late{box-shadow:inset 3px 0 0 var(--no)}.cl-ev.s-soon,.cl-ev.s-today{box-shadow:inset 3px 0 0 var(--warn)}.cl-ev.s-done{opacity:.5;text-decoration:line-through}',
    '.cl-more{font-size:11px;color:var(--muted);margin-top:2px}',
    '.cl-ev.main{font-size:12px;font-weight:700;padding:2px 5px}.cl-ev.sub{background:none !important;color:var(--muted);font-size:10px;padding:0 3px;box-shadow:none}',
    '.cl-list .row.sub{padding:5px 0 5px 14px;border-top:1px dashed var(--line)}.cl-list .row.sub .tx b{font-size:12px;font-weight:500;color:var(--ink-2)}',
    '.cl-list .row.sub .bar{opacity:.4;width:2px}.dd.sub{font-size:11px;font-weight:600;background:none;color:var(--muted)}',
    '.cl-dots{display:none}',
    '.cl-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}',
    '.cl-wcol{background:var(--soft);border-radius:14px;padding:8px;min-height:120px}.cl-wcol.today{background:#E8F3FF}',
    '.cl-wcol h4{margin:0 0 6px;font-size:13px}.cl-wcol .cl-ev{white-space:normal}',
    '.cl-wlane{font-size:11px;color:var(--muted);margin-top:6px}',
    '.cl-list .row{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid var(--line)}',
    '.cl-list .bar{width:4px;align-self:stretch;border-radius:2px;flex:none}',
    '.cl-list .tx{flex:1;min-width:0}.cl-list .tx b{display:block;font-size:15px;line-height:1.35;word-break:keep-all}.cl-list .tx small{color:var(--muted);font-size:12px}',
    '.dd{flex:none;white-space:nowrap;font-weight:800;font-size:14px;padding:4px 9px;border-radius:9px;background:var(--soft);color:var(--ink-2)}',
    '.dd.late{background:var(--nobg);color:var(--no)}.dd.soon,.dd.today{background:var(--warnbg);color:var(--warn)}.dd.done{color:var(--muted)}',
    '.tag{display:inline-block;font-size:11px;border-radius:6px;padding:1px 6px;margin-left:4px;background:#FFF4E6;color:#E67700;font-weight:700}',
    '.tag.chk{background:#F3EEFF;color:#6D28D9}',
    '.cl-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '.cl-cols h3,.cl-sec{font-size:16px;margin:4px 0 4px}',
    '.cl-note{font-size:12px;color:var(--muted);margin:6px 0 0}',
    '@media (max-width:640px){.cl-kpi{gap:6px}.cl-kpi div{padding:8px}.cl-kpi b{font-size:18px}.cl-kpi span{font-size:11px;line-height:1.2;display:block}.cl-flt select{flex:1 1 30%;font-size:12px;padding:6px}.cl-day{min-height:50px}.cl-day .cl-ev,.cl-day .cl-more{display:none}',
    '.cl-dots{display:flex;gap:2px;justify-content:center;flex-wrap:wrap;margin-top:2px}.cl-dots i{width:6px;height:6px;border-radius:3px}',
    '.cl-week{grid-template-columns:1fr}.cl-wcol{min-height:0}.cl-cols{grid-template-columns:1fr}}'
  ].join('\n');
  function style() {
    if (document.getElementById('cl-style')) return;
    var s = document.createElement('style'); s.id = 'cl-style'; s.textContent = CSS; document.head.appendChild(s);
  }

  function filtered(C) {
    return D.cal.events.filter(function (e) { return C.pass(e, view); });
  }
  function opts(list, cur, all) {
    return '<option value="">' + all + '</option>' + list.map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }
  function uniq(arr) { var o = {}; arr.forEach(function (v) { if (v) o[v] = 1; }); return Object.keys(o).sort(); }
  /* 현황판 날짜(정본)는 크게, 같은 T번호의 하위 단계는 작게 (대장 결정 261021) */
  function isBand(C, e) { return !!(e.end && e.end > e.date && C.addDays(e.date, 14) >= e.end); }
  function evChip(C, e, today) {
    if (e._cont) return '<span class="cl-ev band cont l-' + e.lane + (e._last ? ' last' : '') + '" data-span="' + esc(e.id) + '" title="' + esc((e.t ? e.t + ' ' : '') + e.title + ' (~' + C.md(e.end) + ')') + '">↔ ' + esc(e.t || e.title) + '</span>';
    if (isBand(C, e)) return '<span class="cl-ev band start l-' + e.lane + (isMain(e) ? ' main' : '') + '" data-span="' + esc(e.id) + '" title="' + esc((e.t ? e.t + ' ' : '') + e.title + ' (~' + C.md(e.end) + ')') + '">' + (e.t ? '<b>' + esc(e.t) + '</b> ' : '') + esc(e.title) + '</span>';
    if (e.sub) return '<span class="cl-ev sub l-' + e.lane + '" title="' + esc(e.title) + '">└ ' + esc(e.step || e.title) + '</span>';
    var main = isMain(e);
    var s = !main || e.kind === '수업' || e.kind === '참고' || e.kind === '반복' ? { cls: '' } : C.dueState(e.date, today, e.status);
    return '<span class="cl-ev l-' + e.lane + ' s-' + s.cls + (main ? ' main' : '') + '" title="' + esc((e.t ? e.t + ' ' : '') + e.title) + '">' +
      (main && e.t ? '<b>' + esc(e.t) + '</b> ' : '') + esc(e.title) + '</span>';
  }
  function rank(e) { return e.sub ? 2 : (/^sheet/.test(e.src || '') ? 0 : 1); }
  function mainFirst(a, b) { return rank(a) - rank(b); }
  function isMain(e) { return /^sheet/.test(e.src || '') && !e.sub; }
  function row(C, e, today) {
    if (e.sub) {
      var n0 = C.diffDays(today, e.date);
      return '<div class="row sub" data-ev="' + esc(e.id) + '" data-sub="1"><span class="bar ln-' + e.lane + '"></span><div class="tx"><b>' + esc(e.title) + '</b><small>' +
        esc(C.md(e.date)) + ' · 하위 단계 · 정본 마감은 현황판 ' + esc(e.t) + (e.cond ? ' · 조건: ' + esc(e.cond) : '') + '</small></div><span class="dd sub">' +
        (n0 === 0 ? '오늘' : n0 > 0 ? 'D-' + n0 : (-n0) + '일 전') + '</span></div>';
    }
    var s = C.dueState(e.date, today, e.status);
    if (!isMain(e) && s.cls !== 'done') { var n1 = C.diffDays(today, e.date); s = { cls: '', n: n1, label: n1 === 0 ? '오늘' : n1 > 0 ? 'D-' + n1 : (-n1) + '일 전' }; }
    var lane = { yujin: '유진님 할 일', prof: '교수님 일정', ref: '참고' }[e.lane];
    return '<div class="row" data-ev="' + esc(e.id) + '"><span class="bar ln-' + e.lane + '"></span><div class="tx"><b>' + esc(e.title) +
      (e.check ? '<span class="tag chk">' + (/^충돌/.test(e.check) ? '충돌' : '확인 필요') + '</span>' : '') +
      ((e.yujin || []).length ? '<span class="tag">' + esc(e.yujin[0]) + '</span>' : '') + '</b><small>' + esc(C.md(e.date)) + (isBand(C, e) ? '~' + esc(C.md(e.end)) : '') + ' · ' + esc(e.t || '') +
      (e.t ? ' · ' : '') + esc(lane) + ' · ' + esc(e.group || '') + (e.status ? ' · ' + esc(e.status) : '') + (e.cond ? ' · 조건: ' + esc(e.cond) : '') + '</small></div>' +
      '<span class="dd ' + s.cls + '">' + esc(e.lane === 'prof' || e.kind === '참고' ? (s.n === 0 ? '오늘' : s.n > 0 ? 'D-' + s.n : (-s.n) + '일 전') : s.label) + '</span></div>';
  }

  function paint(el, api) {
    var C = root.HJCal, today = C.todayKST();
    if (!view.cur) view.cur = today;
    if (!view.sel) view.sel = today;
    var all = D.cal.events, evs = filtered(C);
    /* 지연·D-3 숫자는 현황판 마감(정본)만 셈 */
    var active = all.filter(function (e) { return isMain(e) && !C.isDone(e.status) && e.lane === 'yujin' && e.kind !== '참고'; });
    var late = active.filter(function (e) { return C.dueState(e.date, today, e.status).cls === 'late'; }).length;
    var soon = active.filter(function (e) { var c = C.dueState(e.date, today, e.status).cls; return c === 'soon' || c === 'today'; }).length;
    var yu = (D.st.tasks || []).filter(function (t) { return (t.yujin || []).length; }).length;
    var st = C.staleness(D.meta);
    var p = view.cur.split('-'), y = +p[0], m = +p[1];
    var byDay = {};
    /* 기간 일정(date~end, 14일 이하, 긴 학기 기간 등은 첫날만)은 걸친 모든 날에 띠로 그려요 */
    evs.forEach(function (e) {
      (byDay[e.date] = byDay[e.date] || []).push(e);
      if (isBand(C, e)) {
        for (var d2 = C.addDays(e.date, 1); d2 <= e.end; d2 = C.addDays(d2, 1)) {
          (byDay[d2] = byDay[d2] || []).push(Object.assign({}, e, { _cont: d2, _last: d2 === e.end }));
        }
      }
    });
    Object.keys(byDay).forEach(function (k) { byDay[k].sort(mainFirst); });
    var html = '<section class="card">' +
      (st.warn ? '<div class="cl-stale" id="cl-stale">⚠ 자료가 최신이 아닐 수 있어요 — ' + esc(st.why) + '</div>' : '') +
      '<div class="cl-top"><h2>계획 달력</h2><div class="cl-seg" id="cl-mode"><button data-m="month" class="' + (view.mode === 'month' ? 'on' : '') + '">월</button><button data-m="week" class="' + (view.mode === 'week' ? 'on' : '') + '">주</button></div></div>' +
      '<div class="cl-kpi"><div class="k-late"><b id="k-late">' + late + '</b><span>지연(마감 지남)</span></div><div class="k-soon"><b id="k-soon">' + soon + '</b><span>마감 임박(D-3)</span></div>' +
      '<div class="k-yu"><b id="k-yu">' + yu + '</b><span>유진님이 하실 일</span></div><div class="k-chk"><b id="k-chk">' + D.cal.checks.length + '</b><span>확인 필요·충돌</span></div></div>' +
      '<div class="cl-leg" id="cl-leg">' + LANES.map(function (l) { return '<button data-lane="' + l[0] + '" class="' + (view.lanes[l[0]] ? '' : 'off') + '"><i class="ln-' + l[0] + '"></i>' + l[1] + '</button>'; }).join('') + '</div>' +
      '<div class="cl-flt"><select id="f-bot" aria-label="담당 봇">' + opts(uniq(all.map(function (e) { return e.bot; })), view.bot, '담당 봇 전체') + '</select>' +
      '<select id="f-st" aria-label="상태">' + opts(uniq(all.map(function (e) { return e.status; })), view.status, '상태 전체') + '</select>' +
      '<select id="f-grp" aria-label="업무 분야">' + opts(D.cal.groups || uniq(all.map(function (e) { return e.group; })), view.group, '업무 분야 전체') + '</select>' +
      '<label><input type="checkbox" id="f-done"' + (view.showDone ? ' checked' : '') + '> 끝난 일 보기</label></div>' +
      '<div class="cl-nav"><button id="cl-prev" aria-label="이전">‹</button><h3 id="cl-title">' +
      (view.mode === 'month' ? y + '년 ' + m + '월' : C.md(C.weekStart(view.cur)) + ' ~ ' + C.md(C.addDays(C.weekStart(view.cur), 6))) +
      '</h3><button id="cl-today">오늘</button><button id="cl-next" aria-label="다음">›</button></div>';
    if (view.mode === 'month') {
      html += '<div class="cl-grid" id="cl-month">' + C.WD.map(function (w, i) { return '<div class="wd' + (i === 0 ? ' sun' : '') + '">' + w + '</div>'; }).join('');
      C.monthGrid(y, m).forEach(function (d) {
        var list = byDay[d] || [], dm = +d.split('-')[1];
        html += '<div class="cl-day' + (dm !== m ? ' out' : '') + (d === today ? ' today' : '') + (d === view.sel ? ' sel' : '') + (C.weekday(d) === 0 ? ' sun' : '') +
          '" data-day="' + d + '"><span class="n">' + (+d.split('-')[2]) + '</span>' +
          list.slice(0, 3).map(function (e) { return evChip(C, e, today); }).join('') +
          (list.length > 3 ? '<div class="cl-more">+' + (list.length - 3) + '</div>' : '') +
          '<div class="cl-dots">' + list.slice(0, 6).map(function (e) { return '<i class="ln-' + e.lane + '"></i>'; }).join('') + '</div></div>';
      });
      html += '</div>';
      var sl = byDay[view.sel] || [];
      html += '<h3 class="cl-sec" style="margin-top:14px">' + esc(C.md(view.sel)) + ' 일정 ' + sl.length + '개</h3><div class="cl-list" id="cl-daylist">' +
        (sl.length ? sl.map(function (e) { return row(C, e, today); }).join('') : '<p class="muted">일정이 없어요.</p>') + '</div>';
    } else {
      html += '<div class="cl-week" id="cl-weekview">' + C.weekDays(view.cur).map(function (d) {
        var list = byDay[d] || [];
        return '<div class="cl-wcol' + (d === today ? ' today' : '') + '" data-wday="' + d + '"><h4>' + esc(C.md(d)) + '</h4>' +
          LANES.map(function (l) {
            var ll = list.filter(function (e) { return e.lane === l[0]; });
            return ll.length ? '<div class="cl-wlane">' + l[1] + '</div>' + ll.map(function (e) { return evChip(C, e, today); }).join('') : '';
          }).join('') + (list.length ? '' : '<div class="cl-wlane">없음</div>') + '</div>';
      }).join('') + '</div>';
    }
    html += '</section>';
    /* 다가오는 일정: 지연(유진님) + 오늘부터 30일, 레인 따로 */
    var up = evs.filter(function (e) {
      var n = C.diffDays(today, e.date);
      return (n >= 0 && n <= 30) || (n < 0 && isMain(e) && e.lane === 'yujin' && e.kind !== '참고' && !C.isDone(e.status));
    }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : mainFirst(a, b); });
    function col(lane, title, id) {
      var l = up.filter(function (e) { return e.lane === lane; });
      return '<div><h3>' + title + ' <small class="muted">' + l.length + '</small></h3><div class="cl-list" id="' + id + '">' +
        (l.length ? l.map(function (e) { return row(C, e, today); }).join('') : '<p class="muted">' + (view.lanes[lane] ? '30일 안에 없어요.' : '꺼 둔 레인이에요.') + '</p>') + '</div></div>';
    }
    html += '<section class="card"><h2 style="font-size:20px;margin:0 0 6px">다가오는 일정</h2><p class="cl-note">지연된 유진님 일 + 오늘부터 30일. 색: 빨강 지연 · 주황 D-3 이내. 굵은 줄 = 현황판 마감(정본), 작은 「└」 줄 = 같은 T번호의 하위 단계.</p><div class="cl-cols">' +
      col('yujin', '유진님 할 일', 'up-yujin') + col('prof', '교수님 일정', 'up-prof') + '</div>' +
      (view.lanes.ref ? col('ref', '참고 (유진님 일 아님)', 'up-ref') : '') +
      (D.cal.prof_note ? '<p class="cl-note" id="prof-note">교수님 일정: ' + esc(D.cal.prof_note) + '</p>' : '') + '</section>';
    html += '<section class="card"><details id="cl-checks"><summary><b>확인 필요·충돌 ' + D.cal.checks.length + '개</b></summary><div class="cl-list">' +
      D.cal.checks.map(function (c) { return '<div class="row"><span class="bar ln-ref"></span><div class="tx"><b>' + esc(c.t || '-') + ' ' + esc(c.title || '') + '</b><small>' + esc(c.why) + '</small></div></div>'; }).join('') +
      '</div></details><p class="cl-note">자료: ' + esc(D.cal.source) + '. 사이트는 읽기만 해요(고치는 곳은 현황판). 갱신은 봇이 시트를 읽어 다시 만들 때(빌드 때) 돼요.</p></section>';
    el.innerHTML = html;
    bind(el, api);
  }

  function bind(el, api) {
    var C = root.HJCal;
    el.querySelectorAll('#cl-mode button').forEach(function (b) { b.onclick = function () { view.mode = b.getAttribute('data-m'); paint(el, api); }; });
    el.querySelectorAll('#cl-leg button').forEach(function (b) { b.onclick = function () { var l = b.getAttribute('data-lane'); view.lanes[l] = view.lanes[l] ? 0 : 1; paint(el, api); }; });
    el.querySelector('#f-bot').onchange = function (e) { view.bot = e.target.value; paint(el, api); };
    el.querySelector('#f-st').onchange = function (e) { view.status = e.target.value; paint(el, api); };
    el.querySelector('#f-grp').onchange = function (e) { view.group = e.target.value; paint(el, api); };
    el.querySelector('#f-done').onchange = function (e) { view.showDone = e.target.checked; paint(el, api); };
    function move(n) {
      if (view.mode === 'week') view.cur = C.addDays(view.cur, 7 * n);
      else { var p = view.cur.split('-'), y = +p[0], m = +p[1] + n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } view.cur = y + '-' + String(m).padStart(2, '0') + '-01'; }
      paint(el, api);
    }
    el.querySelector('#cl-prev').onclick = function () { move(-1); };
    el.querySelector('#cl-next').onclick = function () { move(1); };
    el.querySelector('#cl-today').onclick = function () { view.cur = view.sel = C.todayKST(); paint(el, api); };
    el.querySelectorAll('[data-day]').forEach(function (d) { d.onclick = function () { view.sel = d.getAttribute('data-day'); paint(el, api); var l = el.querySelector('#cl-daylist'); if (l && innerWidth < 640) l.scrollIntoView({ block: 'nearest' }); }; });
  }

  function render(el, api) {
    style();
    el.classList.add('wide');
    var tb = document.querySelector('.tabs [data-tab="more"]'); if (tb) tb.classList.add('on');
    stamp();
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    loadAll().then(function () { paint(el, api); }).catch(function () {
      el.innerHTML = '<section class="card"><div class="cl-stale" id="cl-stale">⚠ 달력 자료를 불러오지 못했어요. 갱신 스크립트(tools/refresh_all.py)를 다시 돌려 주세요.</div></section>';
    });
  }

  root.HJCalData = loadAll;
  root.HJEsc = esc;
  root.HJCalStyle = style;
  if (root.ShellModules) root.ShellModules.calendar = { id: 'calendar', tab: '계획 달력', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

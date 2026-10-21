/* 현황표: 현황판 시트 「업무」 탭(정본)에서 만든 data/status.json 을 읽기만 해요.
   맨 위에 「유진님이 하실 일」(대기: PC·KORUS, 결재·상신, 확인 필요, 유진님 직접)을 고정해요.
   사람 칸(담당·상대)은 저장소에 없어요. 잠긴 API(유진님만, Cloudflare Access 확인 뒤)에서 그때그때 읽고, 못 읽으면 「잠금 확인 후 표시」. */
(function (root) {
  'use strict';
  var view = { bot: '', status: '', group: '', showDone: false, q: '' };
  var people = null; /* {T001: '...'} — 메모리에만, 어디에도 저장 안 함 */
  var peopleTried = false;
  var CSS = [
    '.st-pin{background:#E8F3FF;border-radius:20px;padding:16px;margin-bottom:12px}',
    '.st-pin h2{font-size:18px;margin:0 0 4px;color:#1B64DA}',
    '.st-tbl{width:100%;border-collapse:collapse;font-size:14px}',
    '.st-tbl th{font-size:12px;color:var(--muted);text-align:left;font-weight:600;padding:8px 6px;border-bottom:1px solid var(--line)}',
    '.st-tbl td{padding:10px 6px;border-bottom:1px solid var(--line);vertical-align:top}',
    '.st-tbl td.t{font-weight:700;color:var(--ink-2);white-space:nowrap}.st-tbl td.ttl{word-break:keep-all;line-height:1.4}',
    '.st-tbl td.who{color:var(--muted);font-size:12px}',
    '.st-badge{display:inline-block;font-size:12px;font-weight:700;border-radius:8px;padding:2px 8px;white-space:nowrap}',
    '.b-할일{background:var(--soft);color:var(--ink-2)}.b-진행중{background:#E8F3FF;color:#1B64DA}.b-완료,.b-취소{background:var(--okbg);color:var(--ok)}',
    '.b-확인필요{background:#F3EEFF;color:#6D28D9}.b-보류,.b-대기{background:var(--warnbg);color:var(--warn)}',
    '.st-steps{font-size:12px;color:var(--ink-2);margin-top:6px}.st-steps summary{cursor:pointer;color:var(--navy);font-weight:600}',
    '.st-steps li{margin:3px 0}.st-steps .l-prof{color:#6D28D9}.st-steps .l-ref{color:var(--muted)}',
    '.oj-row{margin:10px 0}.oj-row .lb{display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px}',
    '.oj-bar{height:10px;border-radius:5px;background:var(--soft);overflow:hidden}.oj-bar i{display:block;height:100%;background:var(--navy);border-radius:5px}',
    '@media (max-width:640px){.st-tbl thead{display:none}.st-tbl tr{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;padding:10px 0;border-bottom:1px solid var(--line)}',
    '.st-tbl td{border:0;padding:0}.st-tbl td.ttl{grid-column:2/4}.st-tbl td.t{grid-row:1/3}.st-tbl td.who,.st-tbl td.bot{font-size:12px;color:var(--muted)}}'
  ].join('\n');
  function style() {
    if (root.HJCalStyle) root.HJCalStyle();
    if (document.getElementById('st-style')) return;
    var s = document.createElement('style'); s.id = 'st-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return root.HJEsc(s); }
  function uniq(arr) { var o = {}; arr.forEach(function (v) { if (v) o[v] = 1; }); return Object.keys(o).sort(); }
  function opts(list, cur, all) {
    return '<option value="">' + all + '</option>' + list.map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }
  function loadPeople() {
    if (peopleTried) return Promise.resolve(people);
    peopleTried = true;
    var C = root.HJCal, ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 3000);
    return fetch(new URL(C.PEOPLE_API + '?kind=task-people', document.baseURI).href, { credentials: 'same-origin', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (!r.ok || ct.indexOf('json') < 0) throw new Error('api');
        return r.json();
      })
      .then(function (j) { people = j && typeof j.tasks === 'object' ? j.tasks : null; return people; })
      .catch(function () { people = null; return null; })
      .then(function (p) { clearTimeout(timer); return p; });
  }
  function whoCell(t) {
    if (people && people[t]) return esc(typeof people[t] === 'string' ? people[t] : (people[t]['담당·상대'] || ''));
    return '<span class="muted" data-lock="1">잠금 확인 후 표시</span>';
  }
  function order(C, today) {
    return function (a, b) {
      var sa = C.dueState(a.due, today, a.status), sb = C.dueState(b.due, today, b.status);
      var ra = { late: 0, today: 1, soon: 2, later: 3, none: 4, done: 5 }[sa.cls], rb = { late: 0, today: 1, soon: 2, later: 3, none: 4, done: 5 }[sb.cls];
      if (ra !== rb) return ra - rb;
      return (a.due || '9') < (b.due || '9') ? -1 : (a.due || '9') > (b.due || '9') ? 1 : (a.t < b.t ? -1 : 1);
    };
  }
  function badge(s) { return '<span class="st-badge b-' + esc(String(s).replace(/\s/g, '')) + '">' + esc(s) + '</span>'; }
  function dd(C, t, today) { var s = C.dueState(t.due, today, t.status); return t.due ? '<span class="dd ' + s.cls + '">' + esc(s.label) + '</span><br><small class="muted">' + esc(C.md(t.due)) + '</small>' : '<small class="muted">마감 없음</small>'; }
  function steps(C, t) {
    if (!t.steps || !t.steps.length) return '';
    var nm = { yujin: '유진님', prof: '교수님', ref: '참고' };
    return '<details class="st-steps"><summary>일정 ' + t.steps.length + '개 (달력과 같음)</summary><ul>' + t.steps.map(function (s) {
      return '<li class="l-' + s.lane + '">' + esc(C.md(s.date)) + ' · ' + esc(nm[s.lane] || '') + ' · ' + esc(s.title) + (s.cond ? ' <small>(' + esc(s.cond) + ')</small>' : '') + '</li>';
    }).join('') + '</ul></details>';
  }
  function trow(C, t, today) {
    return '<tr data-t="' + esc(t.t) + '"><td class="t">' + esc(t.t) + '</td><td class="ttl">' + esc(t.title) +
      (t.yujin && t.yujin.length ? t.yujin.map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join('') : '') + steps(C, t) +
      '</td><td>' + badge(t.status) + '</td><td>' + dd(C, t, today) + '</td><td class="bot">' + esc(t.bot || '-') + '</td><td class="who">' + whoCell(t.t) + '</td></tr>';
  }
  function table(C, list, today, id) {
    return '<table class="st-tbl" id="' + id + '"><thead><tr><th>T번호</th><th>업무 이름</th><th>상태</th><th>마감</th><th>담당 1봇</th><th>담당·상대</th></tr></thead><tbody>' +
      list.map(function (t) { return trow(C, t, today); }).join('') + '</tbody></table>';
  }
  function paint(el, api) {
    var C = root.HJCal, D = root.HJData, today = C.todayKST(), st = C.staleness(D.meta);
    var tasks = D.st.tasks.slice().sort(order(C, today));
    var pin = tasks.filter(function (t) { return t.yujin && t.yujin.length && !C.isDone(t.status); });
    var shown = tasks.filter(function (t) { return C.pass(t, view); });
    var late = tasks.filter(function (t) { return C.dueState(t.due, today, t.status).cls === 'late'; }).length;
    var soon = tasks.filter(function (t) { var c = C.dueState(t.due, today, t.status).cls; return c === 'soon' || c === 'today'; }).length;
    var html = (st.warn ? '<div class="cl-stale" id="cl-stale">⚠ 자료가 최신이 아닐 수 있어요 — ' + esc(st.why) + '</div>' : '') +
      '<section class="st-pin" id="st-pin"><h2>유진님이 하실 일 ' + pin.length + '개</h2><p class="cl-note" style="margin:0 0 6px">대기: PC · 대기: KORUS(회계 시스템) · 결재·상신 · 확인 필요 · 유진님 직접. 지연 먼저.</p>' +
      table(C, pin, today, 'st-pin-tbl') + '</section>' +
      '<section class="card"><div class="cl-top"><h2>현황표</h2></div>' +
      '<div class="cl-kpi"><div><b id="s-all">' + D.st.counts.active + '</b><span>진행할 업무</span></div><div class="k-late"><b id="s-late">' + late + '</b><span>지연</span></div>' +
      '<div class="k-soon"><b id="s-soon">' + soon + '</b><span>마감 임박(D-3)</span></div><div class="k-yu"><b>' + pin.length + '</b><span>유진님 할 일</span></div></div>' +
      '<div class="cl-flt"><select id="sf-bot" aria-label="담당 봇">' + opts(uniq(tasks.map(function (t) { return t.bot; })), view.bot, '담당 봇 전체') + '</select>' +
      '<select id="sf-st" aria-label="상태">' + opts(uniq(tasks.map(function (t) { return t.status; })), view.status, '상태 전체') + '</select>' +
      '<select id="sf-grp" aria-label="업무 분야">' + opts(D.st.groups || uniq(tasks.map(function (t) { return t.group; })), view.group, '업무 분야 전체') + '</select>' +
      '<label><input type="checkbox" id="sf-done"' + (view.showDone ? ' checked' : '') + '> 끝난 일 보기</label></div>' +
      '<p class="cl-note" id="st-count">' + shown.length + '개 보기</p>' + table(C, shown, today, 'st-tbl') +
      '<p class="cl-note" id="st-lock">담당·상대(사람) 칸은 사이트 파일에 없어요. 유진님만 들어오는 잠금(Cloudflare Access) 확인 뒤 잠긴 API에서 읽어 보여요.</p></section>';
    if (D.ojnt && D.ojnt.items) {
      html += '<section class="card" id="oj"><h2 style="font-size:18px;margin:0">OJNT 입사 서류 진행률</h2><p class="cl-note">숫자만(이름 없음). ' + esc(D.ojnt.source) + '</p>' +
        D.ojnt.items.map(function (i) {
          return '<div class="oj-row"><div class="lb"><span>' + esc(i.label) + (i.note ? ' <small class="muted">(' + esc(i.note) + ')</small>' : '') + '</span><b>' + i.done + '/' + i.total + ' · ' + i.rate + '%</b></div><div class="oj-bar"><i style="width:' + i.rate + '%"></i></div></div>';
        }).join('') + (D.ojnt.deadlines || []).map(function (d) { return '<span class="tag chk">' + esc(d.label) + ' ' + esc(C.md(d.date)) + '</span>'; }).join(' ') + '</section>';
    }
    if (D.st.others && D.st.others.length) {
      html += '<section class="card" id="st-others"><h2 style="font-size:18px;margin:0">다른 곳(캘린더·노션) 할 일 ' + D.st.others.length + '개</h2><p class="cl-note">현황판에 없는 일. 현황판에 올릴지는 대장이 정해요.</p><div class="cl-list">' +
        D.st.others.map(function (o) { return '<div class="row"><span class="bar ln-' + esc(o.lane) + '"></span><div class="tx"><b>' + esc(o.title) + '</b><small>' + esc(o.due ? C.md(o.due) : '날짜 없음') + ' · ' + esc(o.group) + ' · ' + esc(o.source) + '</small></div></div>'; }).join('') + '</div></section>';
    }
    el.innerHTML = html;
    el.querySelector('#sf-bot').onchange = function (e) { view.bot = e.target.value; paint(el, api); };
    el.querySelector('#sf-st').onchange = function (e) { view.status = e.target.value; paint(el, api); };
    el.querySelector('#sf-grp').onchange = function (e) { view.group = e.target.value; paint(el, api); };
    el.querySelector('#sf-done').onchange = function (e) { view.showDone = e.target.checked; paint(el, api); };
  }
  function render(el, api) {
    style();
    el.classList.add('wide');
    var tb = document.querySelector('.tabs [data-tab="more"]'); if (tb) tb.classList.add('on');
    if (root.HJStamp) root.HJStamp();
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    if (!root.HJCalData) { el.innerHTML = '<section class="card"><div class="cl-stale">⚠ 달력 모듈이 없어 현황표를 열지 못했어요.</div></section>'; return; }
    root.HJCalData().then(function () { paint(el, api); return loadPeople(); }).then(function (p) { if (p) paint(el, api); }).catch(function () {
      el.innerHTML = '<section class="card"><div class="cl-stale" id="cl-stale">⚠ 현황표 자료를 불러오지 못했어요. 갱신 스크립트(tools/refresh_all.py)를 다시 돌려 주세요.</div></section>';
    });
  }
  if (root.ShellModules) root.ShellModules.status = { id: 'status', tab: '현황표', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

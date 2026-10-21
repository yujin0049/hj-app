/* 봇 작업 현황 (#/bots): 지금 도는 일을 한 줄씩. 정본은 인수인계봇 현황판 시트 「업무」 탭.
   자료 data/bot_status.json 은 99 봇/스크립트/bot_status_build.py 가 만들고(손으로 안 옮김), 이 화면은 읽기만 해요.
   한 줄: 색 점(상태) · T번호 · 짧은 제목 · 맡은 봇 · 진행률 · 검증 · 마감 · 마지막 갱신. 맨 위: 유진님이 해야 할 것 · 마감 임박 · 감사 위험.
   사람 이름·연락처는 파일에 없어요(봇 이름·T번호·업무 이름만). 출처: 유진님 10.21. 20:15 「응 그거 해봐. 행정업무 연습장에 하면 될듯」. */
(function (root) {
  'use strict';
  var view = { state: '', bot: '', q: '', open: {} };
  var data = null, tried = false, failed = false;
  var CSS = [
    '.bs-head{padding:4px 2px 0}.bs-head h1{margin:0 0 2px}.bs-head p{margin:0;color:var(--muted);font-size:.86rem}',
    '.bs-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 4px}',
    '.bs-kpi button{border:0;background:var(--card);border-radius:16px;padding:10px 4px;text-align:center;cursor:pointer}',
    '.bs-kpi button.on{box-shadow:inset 0 0 0 2px var(--navy)}',
    '.bs-kpi b{display:block;font-size:1.25rem;font-weight:800;letter-spacing:-.02em}.bs-kpi span{font-size:.74rem;color:var(--ink-2);white-space:nowrap}',
    '.bs-dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex:0 0 9px;margin-top:7px}',
    '.bs-kpi .bs-dot{margin:0 4px 1px 0;vertical-align:middle}',
    '.d-run{background:#3182F6}.d-yu{background:#FF9F00}.d-stop{background:#F04452}.d-done{background:#03B26C}',
    '.bs-sec{background:var(--card);border-radius:20px;padding:16px 16px 6px;margin:12px 0}',
    '.bs-sec.yu{background:#FFF8E6}.bs-sec.risk{background:#FEF1F2}',
    '.bs-sec h2{font-size:1.02rem;margin:0 0 2px;display:flex;justify-content:space-between;align-items:baseline}',
    '.bs-sec h2 small{font-size:.8rem;color:var(--muted);font-weight:500}',
    '.bs-sec .why{font-size:.78rem;color:var(--muted);margin:0 0 6px}',
    '.bs-row{display:flex;gap:10px;padding:11px 0;border-top:1px solid var(--line)}.bs-row:first-of-type{border-top:0}',
    '.bs-sec.yu .bs-row,.bs-sec.risk .bs-row{border-top-color:rgba(0,0,0,.06)}',
    '.bs-tx{min-width:0;flex:1}',
    '.bs-t1{display:flex;gap:6px;align-items:baseline}.bs-t1 .tn{font-weight:700;color:var(--muted);font-size:.8rem;white-space:nowrap}',
    '.bs-t1 .tt{font-weight:600;font-size:.95rem;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
    '.bs-t2{font-size:.76rem;color:var(--ink-2);margin-top:3px;display:flex;flex-wrap:wrap;gap:2px 8px}',
    '.bs-t2 .mi{color:var(--muted)}.bs-t2 .na{color:#B0B8C1}',
    '.bs-due{font-size:.78rem;font-weight:700;white-space:nowrap;text-align:right;min-width:52px}',
    '.bs-due small{display:block;font-weight:500;color:var(--muted);font-size:.72rem}',
    '.bs-due.late{color:#F04452}.bs-due.today,.bs-due.soon{color:#E67700}.bs-due.later{color:var(--ink-2)}.bs-due.none,.bs-due.done{color:var(--muted)}',
    '.bs-tag{display:inline-block;font-size:.7rem;font-weight:700;border-radius:6px;padding:1px 6px;margin:4px 4px 0 0;background:#FFEFC7;color:#9A5B00}',
    '.bs-tag.r{background:#FDE2E4;color:#C62536}',
    '.bs-bar{height:4px;border-radius:2px;background:var(--soft);margin-top:6px;overflow:hidden}.bs-bar i{display:block;height:100%;background:var(--navy)}',
    '.bs-more{display:block;width:100%;border:0;background:none;color:var(--navy);font-weight:600;font-size:.86rem;padding:10px 0;cursor:pointer}',
    '.bs-flt{display:flex;gap:8px;margin:4px 0 8px}.bs-flt select,.bs-flt input{flex:1;min-width:0;border:0;background:var(--soft);border-radius:12px;padding:9px 10px;font-size:.86rem}',
    '.bs-stale{background:var(--warnbg);color:var(--warn);border-radius:14px;padding:10px 12px;font-size:.84rem;margin:10px 0}',
    '.bs-foot{font-size:.76rem;color:var(--muted);padding:4px 4px 20px;line-height:1.5}'
  ].join('\n');
  function style() {
    if (document.getElementById('bs-style')) return;
    var s = document.createElement('style'); s.id = 'bs-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function load() {
    if (tried) return Promise.resolve(data);
    tried = true;
    return fetch(new URL('data/bot_status.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('bot_status'); return r.json(); })
      .then(function (j) { data = j; return j; })
      .catch(function () { failed = true; tried = false; return null; });
  }
  function row(B, esc, t, today, opt) {
    var d = B.due(t, today);
    var tags = '';
    if (opt && opt.yu) tags += (t.yujin || []).map(function (g) { return '<span class="bs-tag">' + esc(g) + '</span>'; }).join('');
    if (opt && opt.risk) tags += (t.risk || []).map(function (g) { return '<span class="bs-tag r">' + esc(g) + '</span>'; }).join('');
    var pr = B.progressText(t.progress), vf = B.verifiedText(t.verified);
    var bar = (t.progress === null || t.progress === undefined) ? '' : '<div class="bs-bar"><i style="width:' + Math.max(0, Math.min(100, +t.progress)) + '%"></i></div>';
    return '<div class="bs-row" data-t="' + esc(t.t) + '" data-state="' + esc(t.state) + '">' +
      '<span class="bs-dot d-' + B.DOT[t.state] + '" title="' + esc(t.state) + '"></span>' +
      '<div class="bs-tx"><div class="bs-t1"><span class="tn">' + esc(t.t) + '</span><span class="tt">' + esc(t.title) + '</span></div>' +
      '<div class="bs-t2"><span>' + esc(t.bot || '담당 봇 미기재') + '</span>' +
      '<span class="mi">' + esc(B.SHORT[t.state]) + (t.raw && t.raw !== t.state ? ' · ' + esc(t.raw) : '') + '</span>' +
      '<span class="' + (pr === '미기재' ? 'na' : '') + '">진행률 ' + esc(pr) + '</span>' +
      '<span class="' + (vf === '미기재' ? 'na' : '') + '">검증 ' + esc(vf === '미기재' ? vf : vf.replace(/^점검 /, '')) + '</span>' +
      '<span class="mi">갱신 ' + esc(t.updated ? t.updated.slice(5).replace('-', '.').replace(' ', '. ') : '미기재') + '</span></div>' + tags + bar + '</div>' +
      '<div class="bs-due ' + d.cls + '">' + esc(d.cls === 'done' ? '끝' : d.label) + (t.due && d.cls !== 'done' ? '<small>' + esc(B.md(t.due)) + '</small>' : '') + '</div></div>';
  }
  function section(B, esc, id, cls, title, why, list, today, opt, limit) {
    if (!list.length) return '<section class="bs-sec ' + cls + '" id="' + id + '"><h2>' + esc(title) + ' <small>0개</small></h2><p class="why">' + esc(why) + '</p><p class="muted" style="font-size:.86rem;margin:4px 0 10px">지금은 없어요.</p></section>';
    var all = !!view.open[id], shown = all ? list : list.slice(0, limit);
    return '<section class="bs-sec ' + cls + '" id="' + id + '"><h2>' + esc(title) + ' <small>' + list.length + '개</small></h2><p class="why">' + esc(why) + '</p>' +
      shown.map(function (t) { return row(B, esc, t, today, opt); }).join('') +
      (list.length > limit ? '<button class="bs-more" type="button" data-more="' + id + '">' + (all ? '접기' : (list.length - limit) + '개 더 보기') + '</button>' : '') + '</section>';
  }
  function paint(el, api) {
    var B = root.HJBots, esc = api.esc, today = B.todayKST();
    var tasks = data.tasks || [];
    var c = B.counts(tasks), sec = B.sections(tasks, today), st = B.stale(data);
    var list = B.sortTasks(B.filter(tasks, view), today);
    var kpi = B.STATES.map(function (s) {
      return '<button type="button" data-st="' + esc(s) + '" class="' + (view.state === s ? 'on' : '') + '"><b>' + c[s] + '</b><span><i class="bs-dot d-' + B.DOT[s] + '"></i>' + esc(B.SHORT[s]) + '</span></button>';
    }).join('');
    var botOpts = '<option value="">봇 전체</option>' + B.bots(tasks).map(function (b) { return '<option' + (b === view.bot ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') +
      '<option value="(미기재)"' + (view.bot === '(미기재)' ? ' selected' : '') + '>담당 봇 미기재</option>';
    var cols = data.columns || {};
    el.innerHTML =
      '<div class="bs-head"><h1>봇 작업 현황</h1><p id="bs-stamp">현황판 ' + esc(data.read_at || '?') + ' 읽음 · 화면 자료 ' + esc(data.built_at || '?') + ' (한국 시간)</p></div>' +
      (st.warn ? '<div class="bs-stale" id="bs-stale">⚠ ' + esc(st.why) + '. 보이는 내용이 현황판과 다를 수 있어요.</div>' : '') +
      '<div class="bs-kpi" id="bs-kpi">' + kpi + '</div>' +
      section(B, esc, 'bs-yu', 'yu', '유진님이 해야 할 것', '로그인 · 결제 · 결재 · KORUS 입력 · 제출 · 확인·판단. 마감 가까운 것부터.', sec.yujin, today, { yu: 1 }, 5) +
      section(B, esc, 'bs-soon', '', '마감 임박', '마감 3일 이내(D-3)와 이미 지난 것.', sec.soon, today, {}, 5) +
      section(B, esc, 'bs-risk', 'risk', '감사 위험', '감사·검사, 개선권고, 만료, 놓치면 불이익이 있는 일.', sec.risk, today, { risk: 1 }, 5) +
      '<section class="bs-sec" id="bs-all"><h2>' + esc(view.state ? B.SHORT[view.state] : '지금 도는 일') + ' <small id="bs-count">' + list.length + '개</small></h2>' +
      '<p class="why">' + (view.state ? '위 숫자를 한 번 더 누르면 전체로 돌아가요.' : '끝난 일은 빼고 보여요. 「끝」 숫자를 누르면 끝난 일만.') + '</p>' +
      '<div class="bs-flt"><select id="bs-bot" aria-label="맡은 봇">' + botOpts + '</select><input id="bs-q" type="search" placeholder="T번호·낱말" value="' + esc(view.q) + '" aria-label="찾기"></div>' +
      list.map(function (t) { return row(B, esc, t, today, null); }).join('') + '</section>' +
      '<p class="bs-foot">정본: ' + esc(data.source || '현황판') + '. 이 화면은 읽기만 해요. 고칠 땐 현황판(인수인계봇)에서.<br>' +
      (cols.progress ? '' : '진행률 칸이 현황판에 아직 없어 「미기재」로 보여요. ') + (cols.verified ? '' : '검증 칸도 아직 없어 「미기재」예요. ') +
      '갱신: ' + esc(data.refresh || '') + '.<br>왜 이렇게: 유진님이 휴대폰 한 화면에서 「내가 할 일」과 「급한 일」부터 보게, 정본 하나(현황판)만 읽어 손으로 옮긴 틀린 값이 안 생기게 했어요.</p>';
    el.querySelectorAll('[data-st]').forEach(function (b) {
      b.onclick = function () { var s = b.getAttribute('data-st'); view.state = view.state === s ? '' : s; paint(el, api); };
    });
    el.querySelectorAll('[data-more]').forEach(function (b) {
      b.onclick = function () { var id = b.getAttribute('data-more'); view.open[id] = !view.open[id]; paint(el, api); };
    });
    el.querySelector('#bs-bot').onchange = function (e) { view.bot = e.target.value; paint(el, api); };
    var q = el.querySelector('#bs-q');
    q.oninput = function () {
      view.q = q.value; var pos = q.selectionStart; paint(el, api);
      var n = el.querySelector('#bs-q'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* 지원 안 함 */ }
    };
  }
  function render(el, api) {
    style();
    if (!root.HJBots) { el.innerHTML = '<section class="card"><div class="bs-stale">⚠ 봇 작업 현황 계산 파일(js/botstatus-core.js)을 못 불러왔어요. 새로고침해 주세요.</div></section>'; return; }
    if (data) { paint(el, api); return; }
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    load().then(function (d) {
      if (!d) { el.innerHTML = '<section class="card"><div class="bs-stale" id="bs-stale">⚠ 봇 작업 현황 자료(data/bot_status.json)를 불러오지 못했어요. 인터넷을 확인하고 새로고침해 주세요.</div></section>'; return; }
      paint(el, api);
    });
  }
  /* 홈 타일 숫자용: 유진님 몫 개수(자료 없으면 null) */
  root.HJBotsPeek = function () { return load().then(function (d) { return d && root.HJBots ? root.HJBots.sections(d.tasks || [], root.HJBots.todayKST()) : null; }); };
  if (root.ShellModules) root.ShellModules.bots = { id: 'bots', tab: '봇 현황', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

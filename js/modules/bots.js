/* 봇 작업 현황 (#/bots): 지금 도는 일을 한 줄씩. 정본은 현황판 시트 「업무」 탭.
   자료 data/bot_status.json 은 99 봇/스크립트/bot_status_build.py 가 만들고(손으로 안 옮김), 이 화면은 읽기만 해요.
   한 줄: 색 점(상태) · T번호 · 짧은 제목 · 맡은 봇 · 진행률 · 검증 · 마감 · 마지막 갱신. 맨 위: 유진님이 해야 할 것 · 마감 임박 · 감사 위험.
   사람 이름·연락처는 파일에 없어요(봇 이름·T번호·업무 이름만). 출처: 유진님 10.21. 20:15 「응 그거 해봐. 행정업무 연습장에 하면 될듯」. */
(function (root) {
  'use strict';
  var view = { state: '', bot: '', q: '', open: {}, board: 'state' };
  var todo = null, todoTried = false, boardTried = false, boardFailed = false, todoFailed = false;
  var data = null, tried = false, failed = false;
  var score = null, scoreTried = false;
  function loadScore() {
    if (scoreTried) return Promise.resolve(score);
    scoreTried = true;
    return fetch(new URL('data/hyunhwang_score.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('hyunhwang_score'); return r.json(); })
      .then(function (j) { score = j; return j; })
      .catch(function () { scoreTried = false; return null; });
  }
  /* 건별 수치화(hyunhwang_score.json): 요약 4개 + 안 끝난 건마다 진행률·체크리스트·다음 할 일·담당·마감 */
  function scoreSection(esc, today) {
    var H = root.HJScore;
    if (!score || !H) return '';
    var tasks = score.tasks || [], s = H.summary(tasks, today, (score.summary || {}).window);
    var list = H.openSorted(tasks, today), all = !!view.open['hs'], shown = all ? list : list.slice(0, 6);
    var kpi = [[s.all, '전체 건수'], [s.avg_pct + '%', '평균 진행률'], [s.yujin, '유진님 몫'], [s.due7, '마감 ' + s.window + '일 이내']].map(function (k) {
      return '<div><b>' + esc(String(k[0])) + '</b><span>' + esc(k[1]) + '</span></div>'; }).join('');
    var rows = shown.map(function (t) {
      var d = H.dueLabel(t, today), od = H.oDiffText(t);
      return '<div class="hs-row" data-t="' + esc(t.t) + '"><div class="hs-t1"><span class="tn">' + esc(t.t) + '</span><span class="tt">' + esc(t.title) + '</span><span class="pc">' + esc(String(t.pct)) + '%</span></div>' +
        '<div class="bs-bar"><i style="width:' + Math.max(0, Math.min(100, +t.pct || 0)) + '%"></i></div>' +
        '<div class="hs-meta"><span>' + esc(t.type) + ' · ' + esc(H.stepText(t)) + '</span><span class="' + (t.owner === '유진님' ? 'yu' : '') + '">담당 ' + esc(t.owner) + '</span>' +
        '<span class="' + d.cls + '">' + esc(d.label) + (t.due ? ' (' + esc(root.HJBots.md(t.due)) + ')' : '') + '</span>' + (od ? '<span class="od">' + esc(od) + '</span>' : '') + '</div>' +
        '<div class="hs-steps">' + (t.steps || []).map(function (st) { return '<i class="' + (st.done ? 'ok' : '') + '">' + (st.done ? '✓ ' : '○ ') + esc(st.name) + '</i>'; }).join('') + '</div>' +
        (t.next ? '<div class="hs-next">→ ' + esc(t.next) + '</div>' : '') +
        (t.folder ? '<div class="hs-dir">📂 ' + esc(t.folder) + '</div>' : '') + '</div>';
    }).join('');
    return '<section class="bs-sec" id="hs-score"><h2>건별 진행률 <small>안 끝난 ' + s.open + '개</small></h2>' +
      '<p class="why">진행률 = 끝난 단계 ÷ 전체 단계(업무 유형별 체크리스트, 현황판 글로 봇이 추정). 취소 ' + s.cancelled + '개는 평균에서 뺐어요' + (s.overdue ? ', 마감 지난 것 ' + s.overdue + '개' : '') + '.</p>' +
      '<div class="hs-kpi" id="hs-kpi">' + kpi + '</div>' + rows +
      (list.length > 6 ? '<button class="bs-more" type="button" data-more="hs">' + (all ? '접기' : (list.length - 6) + '개 더 보기') + '</button>' : '') +
      '<p class="why" style="margin-top:6px">계산 ' + esc(fmtAt(score.built_at)) + ' · 왜: 건마다 어디까지 왔고 다음에 뭘 할지 숫자로 보면 급한 것·유진님 몫부터 손댈 수 있어요.</p></section>';
  }
  /* 협업 보드: 계산 파일(js/collab-board-core.js)과 「내일 할 일」(data/todo.json)은 이 화면을 열 때만 받아요(보기만 함) */
  function loadBoard() {
    var p1 = root.HJBoard || boardTried ? Promise.resolve() : new Promise(function (ok) {
      boardTried = true;
      var s = document.createElement('script');
      s.src = new URL('js/collab-board-core.js?v=77', document.baseURI).href;
      s.onload = ok; s.onerror = function () { boardTried = false; boardFailed = true; ok(); };
      document.head.appendChild(s);
    });
    var p2 = todoTried ? Promise.resolve() : (todoTried = true, fetch(new URL('data/todo.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('todo'); return r.json(); })
      .then(function (j) { todo = j; todoFailed = false; })
      .catch(function () { todoTried = false; todoFailed = true; }));
    return Promise.all([p1, p2]);
  }
  /* 협업 보드: 카드마다 일 번호·짧은 제목·봇 이름·상태·다음 단계·시각·연습장 링크 7칸만. 묶기(상태별·봇별)는 보는 방법만 바꿔요 */
  function boardSection(esc) {
    var H = root.HJBoard;
    if (!H) return '<section class="bs-sec cb" id="cb-board"><h2>협업 보드</h2><p class="why">' + (boardFailed ? '⚠ 보드 계산 파일(js/collab-board-core.js)을 못 불러왔어요. 새로고침해 주세요.' : '보드 계산 파일을 불러오는 중이에요.') + '</p></section>';
    var cards, groups;
    try { cards = H.build(data, todo); groups = H.group(cards, view.board); }
    catch (e) { return '<section class="bs-sec cb" id="cb-board"><h2>협업 보드</h2><p class="why">⚠ 보드 자료 모양이 달라 카드를 못 만들었어요. 아래 목록은 그대로 볼 수 있어요.</p></section>'; }
    var stale = cards.filter(function (c) { return c.stale; }).length;
    var seg = [['state', '상태별'], ['bot', '봇별']].map(function (m) {
      return '<button type="button" data-cb="' + m[0] + '" aria-pressed="' + (view.board === m[0]) + '" class="' + (view.board === m[0] ? 'on' : '') + '">' + m[1] + '</button>';
    }).join('');
    var body = groups.map(function (g) {
      var id = 'cb-' + g.key, all = !!view.open[id], lim = (view.board === 'state' && g.key === '끝') ? 3 : 6;
      var shown = all ? g.cards : g.cards.slice(0, lim);
      return '<div class="cb-grp" data-grp="' + esc(g.key) + '"><h3>' + esc(g.key) + ' <small>' + g.cards.length + '개</small></h3><div class="cb-list">' +
        shown.map(H.cardHTML).join('') + '</div>' +
        (g.cards.length > lim ? '<button class="bs-more" type="button" data-more="' + esc(id) + '">' + (all ? '접기' : (g.cards.length - lim) + '개 더 보기') + '</button>' : '') + '</div>';
    }).join('');
    return '<section class="bs-sec cb" id="cb-board"><h2>협업 보드 <small id="cb-count">' + cards.length + '개</small></h2>' +
      '<p class="why">유진님과 봇이 「누가 · 무엇을 · 어디까지」 하는지 한눈에 봐요. 보기 전용이에요. 지시는 지금처럼 대장에게 해 주세요.' +
      (!todoFailed ? '' : ' 「내일 할 일」 자료는 못 받아서 현황판 카드만 보여요.') + (stale ? ' 3일 넘게 안 바뀐 카드 ' + stale + '개는 「오래 멈춤」으로 표시했어요.' : '') + '</p>' +
      '<div class="cb-seg" role="group" aria-label="묶는 방법">' + seg + '</div>' + body +
      '<a class="cb-chat" id="cb-chat" href="#/chat">🔒 대장↔클로드 방 (열쇠 필요) →</a></section>';
  }
  var CSS = [
    '.bs-head{padding:4px 2px 0}.bs-head h1{margin:0 0 2px}.bs-head p{margin:0;color:var(--muted);font-size:.86rem}',
    '.bs-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 4px}',
    '.bs-kpi button{border:0;background:var(--card);border-radius:16px;padding:10px 4px;text-align:center;cursor:pointer}',
    '.bs-kpi button.on{box-shadow:inset 0 0 0 2px var(--navy)}',
    '.bs-kpi b{display:block;font-size:1.25rem;font-weight:800;letter-spacing:-.02em}.bs-kpi span{font-size:.7rem;color:var(--ink-2);white-space:nowrap}',
    '.bs-kpi .bs-kpi-sub{display:block;font-size:.66rem;color:var(--muted);margin:-2px 0 1px;white-space:nowrap}',
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
    '.bs-tag.r{background:#FDE2E4;color:#C62536}.bs-tag.g{background:transparent;box-shadow:inset 0 0 0 1px #F5C26B;color:#9A5B00;font-weight:600}',
    '.bs-bar{height:4px;border-radius:2px;background:var(--soft);margin-top:6px;overflow:hidden}.bs-bar i{display:block;height:100%;background:var(--navy)}',
    '.bs-more{display:block;width:100%;border:0;background:none;color:var(--navy);font-weight:600;font-size:.86rem;padding:10px 0;cursor:pointer}',
    '.bs-flt{display:flex;gap:8px;margin:4px 0 8px}.bs-flt select,.bs-flt input{flex:1;min-width:0;border:0;background:var(--soft);border-radius:12px;padding:9px 10px;font-size:.86rem}',
    '.bs-stale{background:var(--warnbg);color:var(--warn);border-radius:14px;padding:10px 12px;font-size:.84rem;margin:10px 0}',
    '.bs-foot{font-size:.76rem;color:var(--muted);padding:4px 4px 20px;line-height:1.5}',
    '.hs-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0 6px}.hs-kpi div{background:var(--soft);border-radius:12px;padding:8px 2px;text-align:center}',
    '.hs-kpi b{display:block;font-size:1.15rem;font-weight:800}.hs-kpi span{font-size:.68rem;color:var(--ink-2);white-space:nowrap}',
    '.hs-row{padding:10px 0;border-top:1px solid var(--line)}.hs-row:first-of-type{border-top:0}',
    '.hs-t1{display:flex;gap:6px;align-items:baseline}.hs-t1 .tn{font-weight:700;color:var(--muted);font-size:.8rem}.hs-t1 .tt{flex:1;font-weight:600;font-size:.92rem;min-width:0}',
    '.hs-t1 .pc{font-weight:800;font-size:.95rem;color:var(--navy)}',
    '.hs-meta{font-size:.74rem;color:var(--ink-2);margin-top:3px;display:flex;flex-wrap:wrap;gap:2px 8px}.hs-meta .late{color:#F04452;font-weight:700}.hs-meta .today,.hs-meta .soon{color:#E67700;font-weight:700}',
    '.hs-meta .yu{color:#9A5B00;font-weight:700}.hs-meta .od{color:var(--muted)}',
    '.hs-steps{margin-top:4px;font-size:.72rem;line-height:1.6}.hs-steps i{font-style:normal;display:inline-block;margin-right:6px;color:#B0B8C1}.hs-steps i.ok{color:#03B26C;font-weight:700}',
    '.bs-top{font-size:.76rem;color:var(--ink-2);margin-top:2px}.bs-top .tn{font-weight:700;color:var(--muted)}.bs-hist{margin-top:4px;color:var(--ink)}',
    '.bs-ret{font-size:.78rem;color:var(--ink-2);padding:8px 0 10px;border-top:1px solid var(--line);line-height:1.7}.bs-ret b{color:var(--navy)}',
    '.cb-seg{display:inline-flex;background:var(--soft);border-radius:12px;padding:3px;margin:2px 0 6px}',
    '.cb-seg button{border:0;background:none;border-radius:10px;padding:8px 16px;min-height:44px;font-size:.84rem;font-weight:600;color:var(--ink-2);cursor:pointer}',
    '.cb-seg button.on{background:var(--card);color:var(--navy);box-shadow:0 1px 2px rgba(0,0,0,.08)}',
    '.cb-grp h3{font-size:.9rem;margin:12px 0 6px;display:flex;justify-content:space-between;align-items:baseline}.cb-grp h3 small{font-size:.76rem;color:var(--muted);font-weight:500}',
    '.cb-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}',
    '.cb-card{background:var(--soft);border-radius:14px;padding:10px 12px;min-width:0;border-left:3px solid transparent}',
    '.cb-dot.d-etc{background:#B0B8C1}',
    '.cb-card.stale{border-left-color:#B0B8C1}.cb-card.stale .cb-st{color:var(--muted)}',
    '.cb-t1{display:flex;gap:6px;align-items:center;font-size:.76rem}.cb-t1 .cb-dot{width:8px;height:8px;border-radius:50%;flex:0 0 8px}',
    '.cb-no{font-weight:700;color:var(--muted)}.cb-st{margin-left:auto;font-weight:700;color:var(--ink-2);white-space:nowrap}',
    '.cb-title{font-weight:600;font-size:.92rem;line-height:1.35;margin-top:4px;overflow-wrap:anywhere}',
    '.cb-meta{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:.74rem;color:var(--ink-2);margin-top:3px}.cb-meta .cb-at{color:var(--muted)}',
    '.cb-next{font-size:.8rem;margin-top:4px;color:var(--ink);overflow-wrap:anywhere}',
    '.cb-link{display:inline-block;font-size:.78rem;font-weight:600;color:var(--navy);margin-top:2px;padding:12px 0 4px;min-height:44px;box-sizing:border-box}',
    '.cb-chat{display:flex;align-items:center;min-height:44px;margin:10px 0 0;padding:0 12px;border-radius:12px;background:var(--soft);color:var(--navy);font-weight:700;text-decoration:none}',
    '@media (prefers-reduced-motion:reduce){.cb-seg button,.cb-card{transition:none!important}}',
    '.hs-next{font-size:.8rem;margin-top:3px;color:var(--ink)}.hs-dir{font-size:.7rem;color:var(--muted);margin-top:2px;word-break:break-all}'
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
  /* '2026-10-21 20:30' → '10.21.(수) 20:30' */
  function fmtAt(s) { var m = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d)/.exec(s || ''); return m ? root.HJBots.md(m[1]) + ' ' + m[2] : (s || '?'); }
  function row(B, esc, t, today, opt) {
    var d = B.due(t, today);
    var tags = '';
    if (opt && opt.yu) tags += (t.yujin || []).map(function (g) {
      var guess = B.isGuessTag(t, g);
      return '<span class="bs-tag' + (guess ? ' g' : '') + '"' + (guess ? ' title="현황판 「유진님 몫」 칸이 비어 있어 봇이 추정"' : '') + '>' + esc(g) + (guess ? ' · 추정' : '') + '</span>';
    }).join('');
    if (opt && opt.risk) tags += (t.risk || []).map(function (g) { return '<span class="bs-tag r">' + esc(g) + '</span>'; }).join('');
    var pr = B.progressText(t.progress), vf = B.verifiedText(t.verified);
    var bar = (t.progress === null || t.progress === undefined) ? '' : '<div class="bs-bar"><i style="width:' + Math.max(0, Math.min(100, +t.progress)) + '%"></i></div>';
    return '<div class="bs-row" data-t="' + esc(t.t) + '" data-state="' + esc(t.state) + '">' +
      '<span class="bs-dot d-' + B.DOT[t.state] + '" title="' + esc(t.state) + '"></span>' +
      '<div class="bs-tx"><div class="bs-t1"><span class="tn">' + esc(t.t) + '</span><span class="tt">' + esc(t.title) + '</span></div>' +
      '<div class="bs-t2"><span>' + esc(t.bot || '담당 봇 미기재') + (t.bot_was ? ' <i class="mi" title="인수인계로 바뀐 담당">← ' + esc(t.bot_was) + '</i>' : '') + '</span>' +
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
  /* 봇 조직(일카드) · 옛 봇 인수인계 · 오늘 인수인계 결과(업무방식 정본) — 자료는 bot_status_build.py 가 볼트에서 뽑음 */
  function orgSection(esc) {
    var o = data.org, h = data.handover;
    if (!o && !h) return '';
    var out = '';
    if (o) {
      out += '<section class="bs-sec" id="bs-org"><h2>지금 일하는 봇 <small>' + (o.bots || []).length + '개</small></h2>' +
        '<p class="why">역할은 볼트 99 봇/인사/일카드에서 한 줄씩. 옛 봇 일은 아래처럼 넘어갔어요.</p>' +
        (o.bots || []).map(function (b) {
          var cnt = b.open == null ? '' : '<div class="bs-t2"><span>진행 ' + b.running + '</span><span>남은 일 ' + b.open + '</span><span class="mi">끝 ' + b.done + '</span></div>';
          var top = (b.top || []).map(function (x) { return '<div class="bs-top"><span class="tn">' + esc(x.t) + '</span> ' + esc(x.title) + (x.due ? ' <span class="mi">' + esc(root.HJBots.md(x.due)) + '</span>' : '') + '</div>'; }).join('');
          return '<div class="bs-row bs-org" data-bot="' + esc(b.key) + '"><span class="bs-dot d-run"></span><div class="bs-tx"><div class="bs-t1"><span class="tt">' + esc(b.name) + '</span>' + (b.rank ? '<span class="tn">' + esc(b.rank) + '</span>' : '') + '</div><div class="bs-t2"><span>' + esc(b.role) + '</span></div>' + cnt + top + '</div></div>';
        }).join('') +
        '<div class="bs-ret" id="bs-retired">' + (o.retired || []).map(function (r) { return '<div>' + esc(r.old) + ' — ' + esc(r.how) + ' → <b>' + esc(r.to) + '</b></div>'; }).join('') +
        (o.history || []).map(function (x) { return '<div class="bs-hist">' + esc(root.HJBots.md(x.date)) + ' ' + esc(x.from) + ' → ' + esc(x.to) + (x.items && x.items.length ? ' (' + esc(x.items.join(' · ')) + ')' : '') + (x.now && x.now !== x.to ? ' → 지금 <b>' + esc(x.now) + '</b>' : '') + '</div>'; }).join('') + '</div></section>';
      if ((o.chart || []).length) out += '<section class="bs-sec" id="bs-chart"><h2>조직도·직급 <small>볼트 99 봇/인사</small></h2><p class="why">조직도_인사규정에서 자동으로 읽어요. 승진은 2주 연속 상위일 때.</p>' +
        o.chart.map(function (c) { return '<div class="bs-row"><div class="bs-tx"><div class="bs-t1"><span class="tn">' + esc(c.rank) + '</span><span class="tt">' + esc(c.who) + '</span></div>' + (c.what ? '<div class="bs-t2"><span>' + esc(c.what) + '</span></div>' : '') + '</div></div>'; }).join('') + '</section>';
    }
    if (h && (h.items || []).length) {
      var all = !!view.open['bs-ho'], items = all ? h.items : h.items.slice(0, 6);
      out += '<section class="bs-sec" id="bs-ho"><h2>인수인계 <small>' + h.items.length + '개 · ' + esc(fmtAt(h.saved_at)) + '</small></h2>' +
        '<p class="why">전임자 업무방식 정본의 항목 제목과 한 줄 요약만 보여요. 원문: ' + esc(h.doc) + '</p>' +
        items.map(function (x) { return '<div class="bs-row"><div class="bs-tx"><div class="bs-t1"><span class="tt">' + esc(x.title) + '</span>' + (x.n ? '<span class="tn">' + x.n + '줄</span>' : '') + '</div>' + (x.summary ? '<div class="bs-t2"><span>' + esc(x.summary) + '</span></div>' : '') + '</div></div>'; }).join('') +
        (h.items.length > 6 ? '<button class="bs-more" type="button" data-more="bs-ho">' + (all ? '접기' : (h.items.length - 6) + '개 더 보기') + '</button>' : '') + '</section>';
    }
    return out;
  }
  function paint(el, api) {
    var B = root.HJBots, esc = api.esc, today = B.todayKST();
    var tasks = data.tasks || [];
    var c = B.counts(tasks), sec = B.sections(tasks, today), st = B.stale(data);
    var list = B.sortTasks(B.filter(tasks, view), today, { confirmFirst: view.state === '대기(유진님 몫)' });
    var ys = B.yujinSplit(tasks);
    var ysSmall = '+추정 ' + ys.guess + (ys.bundle ? ' · 묶음 ' + ys.bundle : '');
    var kpi = B.STATES.map(function (s) {
      var yu = s === '대기(유진님 몫)';
      return '<button type="button" data-st="' + esc(s) + '" class="' + (view.state === s ? 'on' : '') + '"' + (yu ? ' id="bs-kpi-yu"' : '') + '><b>' + (yu ? ys.sure : c[s]) + '</b>' +
        (yu ? '<small class="bs-kpi-sub" id="bs-kpi-yu-sub">' + esc(ysSmall) + '</small>' : '') +
        '<span><i class="bs-dot d-' + B.DOT[s] + '"></i>' + esc(yu ? '유진님 몫 확정' : B.SHORT[s]) + '</span></button>';
    }).join('');
    var botOpts = '<option value="">봇 전체</option>' + B.bots(tasks).map(function (b) { return '<option' + (b === view.bot ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') +
      '<option value="(미기재)"' + (view.bot === '(미기재)' ? ' selected' : '') + '>담당 봇 미기재</option>';
    var cols = data.columns || {};
    el.innerHTML =
      '<div class="bs-head"><h1>봇 작업 현황</h1><p id="bs-stamp">현황판 ' + esc(fmtAt(data.read_at)) + ' 읽음 (한국 시간)</p></div>' +
      (st.warn ? '<div class="bs-stale" id="bs-stale">⚠ ' + esc(st.why) + '. 보이는 내용이 현황판과 다를 수 있어요.</div>' : '') +
      '<div class="bs-kpi" id="bs-kpi">' + kpi + '</div>' +
      boardSection(esc) +
      orgSection(esc) +
      scoreSection(esc, today) +
      section(B, esc, 'bs-yu', 'yu', '유진님이 해야 할 것', '확정 ' + ys.sure + '개(현황판 「유진님 몫」 칸 값, 진한 꼬리표)를 먼저, 그다음 ' + ysSmall.slice(1) + '개(테두리 꼬리표 「추정」 = 칸이 비어 봇이 짐작). 각 묶음 안은 마감 가까운 것부터.', sec.yujin, today, { yu: 1 }, 5) +
      section(B, esc, 'bs-soon', '', '마감 임박', '마감 3일 이내(D-3)와 이미 지난 것.', sec.soon, today, {}, 5) +
      section(B, esc, 'bs-risk', 'risk', '감사 위험', '감사·검사, 개선권고, 만료, 놓치면 불이익이 있는 일.', sec.risk, today, { risk: 1 }, 5) +
      '<section class="bs-sec" id="bs-all"><h2>' + esc(view.state ? B.SHORT[view.state] : '지금 도는 일') + ' <small id="bs-count">' + list.length + '개</small></h2>' +
      '<p class="why">' + (view.state ? '위 숫자를 한 번 더 누르면 전체로 돌아가요.' : '끝난 일은 빼고 보여요. 「끝」 숫자를 누르면 끝난 일만.') + '</p>' +
      '<div class="bs-flt"><select id="bs-bot" aria-label="맡은 봇">' + botOpts + '</select><input id="bs-q" type="search" placeholder="T번호·낱말" value="' + esc(view.q) + '" aria-label="찾기"></div>' +
      list.map(function (t) { return row(B, esc, t, today, null); }).join('') + '</section>' +
      '<p class="bs-foot">정본: ' + esc(data.source || '현황판') + '. 이 화면은 읽기만 해요. 고칠 땐 현황판(대장)에서.<br>' +
      (cols.progress ? '' : '진행률 칸이 현황판에 아직 없어 「미기재」로 보여요. ') + (cols.verified ? '' : '검증 칸도 아직 없어 「미기재」예요. ') +
      '갱신: ' + esc(data.refresh || '') + '.<br>왜 이렇게: 유진님이 휴대폰 한 화면에서 「내가 할 일」과 「급한 일」부터 보게, 정본 하나(현황판)만 읽어 손으로 옮긴 틀린 값이 안 생기게 했어요.</p>';
    el.querySelectorAll('[data-st]').forEach(function (b) {
      b.onclick = function () { var s = b.getAttribute('data-st'); view.state = view.state === s ? '' : s; paint(el, api); };
    });
    el.querySelectorAll('[data-cb]').forEach(function (b) {
      b.onclick = function () { view.board = b.getAttribute('data-cb'); paint(el, api); };
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
  function jump(el) {
    if (!view.fromLink || view.jumped === view.fromLink) return;
    view.jumped = view.fromLink;
    setTimeout(function () { /* 화면 바꿀 때 맨 위로 올리는 것보다 뒤에 */
      var a = el.querySelector('#bs-all');
      if (a && a.scrollIntoView) a.scrollIntoView({ block: 'start', behavior: 'auto' }); /* 바로 이동(움직임 없음) */
    }, 80);
  }
  function render(el, api) {
    style();
    if (!root.HJBots) { el.innerHTML = '<section class="card"><div class="bs-stale">⚠ 봇 작업 현황 계산 파일(js/botstatus-core.js)을 못 불러왔어요. 새로고침해 주세요.</div></section>'; return; }
    var rq = api.route && api.route().query, m = /(?:^|&)t=(T\d{3,4})(?:&|$)/.exec(rq || '');
    if (m) { if (view.fromLink !== m[1]) view.jumped = ''; view.q = m[1]; view.showDone = true; view.state = ''; view.fromLink = m[1]; }
    else if (view.fromLink) { if (view.q === view.fromLink) view.q = ''; view.showDone = false; view.fromLink = ''; view.jumped = ''; }
    if (!root.HJBoard || !todo) loadBoard().then(function () { if (data && el.querySelector('#bs-kpi')) { paint(el, api); jump(el); } });
    if (!score) loadScore().then(function (j) { if (j && data && el.querySelector('#bs-kpi')) { paint(el, api); jump(el); } });
    if (data) { paint(el, api); jump(el); return; }
    el.innerHTML = '<section class="card sk" aria-busy="true"><p class="muted">불러오는 중…</p><i></i><i></i><i></i></section>';
    load().then(function (d) {
      if (!d) { el.innerHTML = '<section class="card"><div class="bs-stale" id="bs-stale">⚠ 봇 작업 현황 자료(data/bot_status.json)를 불러오지 못했어요. 인터넷을 확인하고 새로고침해 주세요.</div></section>'; return; }
      paint(el, api); jump(el);
    });
  }
  /* 홈 타일 숫자용: 유진님 몫 개수(자료 없으면 null) */
  root.HJBotsPeek = function () { return load().then(function (d) { return d && root.HJBots ? root.HJBots.sections(d.tasks || [], root.HJBots.todayKST()) : null; }); };
  if (root.ShellModules) root.ShellModules.bots = { id: 'bots', tab: '봇 현황', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

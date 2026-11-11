(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5z"/></svg>';

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parse(s) {
    var p = String(s || '').split('-');
    if (p.length < 3) return null;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function monthEnd(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function nextDate(item, today) {
    var s = item.schedule || {};
    if (s.type === 'dates') {
      var fut = (s.dates || []).map(parse).filter(function (d) { return d && ymd(d) >= ymd(today); }).sort(function (a, b) { return a - b; });
      return fut[0] || null;
    }
    if (s.type === 'monthly' && s.day > 0) {
      var y = today.getFullYear(), m = today.getMonth();
      var dim = monthEnd(y, m);
      var day = Math.min(s.day, dim);
      var cur = new Date(y, m, day);
      if (ymd(cur) >= ymd(today)) return cur;
      var ny = m === 11 ? y + 1 : y, nm = (m + 1) % 12;
      return new Date(ny, nm, Math.min(s.day, monthEnd(ny, nm)));
    }
    if (s.type === 'weekly' && s.weekday != null) {
      var delta = (s.weekday - today.getDay() + 7) % 7;
      return addDays(today, delta);
    }
    if (s.type === 'yearly' && s.month) {
      var yy = today.getFullYear();
      var dt = new Date(yy, s.month - 1, s.day || 1);
      if (ymd(dt) < ymd(today)) dt = new Date(yy + 1, s.month - 1, s.day || 1);
      return dt;
    }
    if (s.type === 'month-end') {
      var off = s.offset || 0;
      var end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      end.setDate(end.getDate() + off);
      if (ymd(end) < ymd(today)) {
        end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        end.setDate(end.getDate() + off);
      }
      return end;
    }
    return null;
  }

  function inThisMonth(item, today) {
    var s = item.schedule || {};
    if (s.type === 'monthly' || s.type === 'weekly' || s.type === 'weekdays' || s.type === 'month-end') return true;
    if (s.type === 'yearly') return s.month === today.getMonth() + 1;
    if (s.type === 'dates') return (s.dates || []).some(function (d) { var x = parse(d); return x && x.getMonth() === today.getMonth() && x.getFullYear() === today.getFullYear(); });
    return false;
  }

  function reviewItems(pack) {
    var out = [];
    var conflictHref = { '기숙사': '#/dorm', '컴퓨터': '#/computers', '소식': '#/news', '예산': '#/more/budget', '할 일': '#/more/month', '규칙': '#/more', '업무': '#/board', '일정': '#/schedule' };
    (pack.conflicts || []).forEach(function (label) {
      out.push({ href: conflictHref[label] || '#/home', title: label + ' 수정이 새 자료와 겹쳐요', why: '확인 필요' });
    });
    var scheduleItems = (pack.entities.schedule && pack.entities.schedule.items) || [];
    scheduleItems.forEach(function (item) {
      if (item && !item.done && item.needsConfirm) out.push({ href: '#/schedule/' + item.id, title: item.title, why: item.confirmNote || '일정 확인 필요' });
    });
    (pack.entities.news || []).forEach(function (n) {
      if (n.status === '확인 필요') out.push({ href: '#/news/' + n.id, title: n.title, why: '소식 확인 필요' });
    });
    if (window.APComputers) {
      var pcs = APComputers.summarize(pack.entities.computers || []);
      if (pcs.unconfirmed) out.push({ href: '#/computers?miss=1', title: '윈도우 버전 미확인 ' + pcs.unconfirmed + '대', why: '버전 확인 필요' });
    }
    (pack.entities.budget_lines || []).forEach(function (b) {
      if (b.needsConfirm) out.push({ href: '#/more/budget', title: (b.project || '') + ' ' + (b.item || ''), why: '금액 확인 필요' });
    });
    (pack.entities.work_items || []).forEach(function (w) {
      if (w.status === '확인 필요') out.push({ href: '#/board/' + w.id, title: w.title, why: '상태 확인 필요' });
    });
    (pack.entities.monthly_todos || []).forEach(function (t) {
      if ((t.note || '').indexOf('확인 필요') >= 0 || (t.title || '').indexOf('확인 필요') >= 0) {
        out.push({ href: '#/more/month', title: t.title, why: '일정 확인 필요' });
      }
    });
    return out.slice(0, 10);
  }

  function tile(href, emoji, title, sub, tone) {
    return '<button class="tile" type="button" data-go="' + href + '"><span class="tile-ic ' + tone + '">' + emoji + '</span><b>' + title + '</b><span class="tile-sub">' + sub + '</span></button>';
  }
  function tileLink(href, img, title, sub) {
    return '<a class="tile tile-img" href="' + href + '" target="_blank" rel="noopener"><img src="img/' + img + '.jpg" alt="" loading="lazy"><b>' + title + '</b><span class="tile-sub">' + sub + '</span></a>';
  }

  // 홈 3D 카드: 같은 저장소 3d/ 의 모델. 이름표는 3d/assets/labels.json(유진님 3D 사이트 저장값의 호실번호·위치, 사람 이름 뺌).
  // 「새 버전(v02) / 이전 버전(v01)」 전환: 고른 값은 이 탭 동안만 기억(sessionStorage), 기본은 새 버전. #/3d 전체 화면도 같은 값을 씀.
  var V3D = { 'new': '3d/index.html', old: '3d/v01/index.html' };
  function ver3d() { try { return sessionStorage.getItem('hj3dVer') === 'old' ? 'old' : 'new'; } catch (e) { return 'new'; } }
  function verBtns() {
    var v = ver3d();
    return '<div class="v3d-ver" role="group" aria-label="3D 버전">' +
      '<button type="button" data-3dver="new" aria-pressed="' + (v === 'new') + '">새 버전</button>' +
      '<button type="button" data-3dver="old" aria-pressed="' + (v === 'old') + '">이전 버전</button></div>';
  }
  if (!window.__hj3dVerBound) {
    window.__hj3dVerBound = true;
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-3dver]');
      if (!b) return;
      var v = b.getAttribute('data-3dver') === 'old' ? 'old' : 'new';
      try { sessionStorage.setItem('hj3dVer', v); } catch (err) { /* 무시 */ }
      document.querySelectorAll('[data-3dver]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-3dver') === v)); });
      document.querySelectorAll('iframe[data-3dframe]').forEach(function (f) {
        f.src = V3D[v] + (f.getAttribute('data-3dframe') === 'embed' ? '?embed=1&v=18' : '?v=18');
      });
    });
  }
  window.HJ3D = { src: function (embed) { return V3D[ver3d()] + (embed ? '?embed=1&v=18' : '?v=18'); }, btns: verBtns };
  function otEntry() {
    return '<button class="bs-entry" type="button" data-go="#/ot-attach" id="home-otattach"><span class="tile-ic orange">📎</span><span class="bs-entry-tx"><b>원인행위 붙임 만들기</b><span class="tile-sub">종류별 붙임 순서 · 10월 시간외근무수당 한 권</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
  }
  function card3d() {
    return '<section class="card home3d"><div class="home3d-head"><h2>교육원 전경 3D</h2>' +
      '<button class="btn-ghost small" type="button" data-go="#/3d">전체 화면</button></div>' + verBtns() +
      '<div class="home3d-stage"><iframe data-3dframe="embed" title="교육원 전경 3D 미리보기" src="' + window.HJ3D.src(true).replace(/&/g, '&amp;') + '" loading="lazy"></iframe></div>' +
      '<p class="muted small">층 버튼을 눌러 보세요. 화면을 누르면 크게 돌려 볼 수 있어요. 호실번호는 3D 사이트에 입력한 값 그대로예요. ' +
      '<a href="https://silseupdong-3d.yujin06344.workers.dev/" target="_blank" rel="noopener">편집은 3D 사이트(PIN) ↗</a></p></section>';
  }
  /* 홈 현황판(유진님 11.11. 「ㅇㅋ 해」): 위 카드 5개(예정·진행·수정·보류·마감임박) + 건 목록(날짜·제목·담당·마감일).
     자료 = data/bot_status.json(현황판 시트 「업무」 탭, 30분 갱신 스크립트가 만듦). 새 입력 없음. 매핑 없는 칸은 「데이터 없음」.
     계산은 js/homeboard-core.js, 마감 D-3 기준은 botstatus-core.js 의 기존 값. */
  var hbData = null, hbTried = false, hbFilter = '', hbAll = false;
  function hbLoad() {
    if (hbTried) return Promise.resolve(hbData);
    hbTried = true;
    return fetch(new URL('data/bot_status.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('bot_status'); return r.json(); })
      .then(function (j) { hbData = j; return j; })
      .catch(function () { hbTried = false; return null; });
  }
  var NODATA = '데이터 없음';
  /* AI 전환 1단계(계획 /ai_transition plan.md · 「어찌 해야하는지 글을 토대로 다른 전문가거를 배껴서 시스템에 적용하자」):
     현황판 안에 이상치만 빨간 카드 · 자율도 3단 + 유보 잠금 · 경계 안/밖 · 보고 전 검사 · 문서 근거 · 반려 이유.
     계산은 js/aiflow-core.js. 자료는 이미 있는 json 만, 없으면 「데이터 없음」. 첫 화면이 다 뜬 뒤에 받아요(첫 로드 속도 그대로). */
  var aiSrc = null, aiTried = false;
  function aiLoad() {
    if (aiTried) return Promise.resolve(aiSrc);
    aiTried = true;
    function get(f) {
      return fetch(new URL('data/' + f, document.baseURI).href, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    /* 연말 집행·불용 위험 표는 기준(aiflow-core BUDGET_RISK)이 채워진 뒤에만 받음 */
    var A = window.HJAIFlow, bud = A && A.budgetReady() ? get(A.BUDGET_RISK.file.replace(/^data\//, '')) : Promise.resolve(null);
    return Promise.all([get('checks.json'), get('ojnt_progress.json'), get('regular_docs.json'), get('docsearch.json'), bud])
      .then(function (a) { aiSrc = { checks: a[0], ojnt: a[1], regular_docs: a[2], docsearch: a[3], budget: a[4] }; return aiSrc; });
  }
  function aiAfterLoad(f) {
    var go = function () { (window.requestIdleCallback || function (g) { setTimeout(g, 200); })(f); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  }
  var ATTEND_URL = 'https://hj-attend.yujin06344.workers.dev/';
  /* 남해캠 공지 최신 5건(261111 춘식이 kv 「앱에 적용해」): data/notices.json 목차 → 최신 해 파일부터 5건 찰 때까지. 첫 화면 다 뜬 뒤(쉬는 틈)에 받아요.
     원문은 남해캠 게시판 새 창, 전체는 #/notice. 자료 없으면 「데이터 없음」. */
  var ntRows = null, ntIndex = null, ntTried = false;
  function ntLoad() {
    if (ntTried) return Promise.resolve(ntRows);
    ntTried = true;
    function get(f) { return fetch(new URL(f, document.baseURI).href, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(f); return r.json(); }); }
    return get('data/notices.json').then(function (ix) {
      ntIndex = ix;
      var ys = (ix && ix.years) || [], out = [];
      function next(i) {
        if (out.length >= 5 || i >= ys.length) return out.slice(0, 5);
        return get(ys[i].file).then(function (j) { out = out.concat((j && j.rows) || []); return next(i + 1); });
      }
      return next(0);
    }).then(function (rows) { ntRows = rows; return rows; }).catch(function () { ntTried = false; ntRows = null; return null; });
  }
  function ntUrl(id) {
    var b = (ntIndex && ntIndex.article_url) || '';
    return b.indexOf('https://www.namhae.ac.kr/') === 0 && /^\d+$/.test(String(id)) ? b + id : '';
  }
  function ntCard() {
    return '<section class="card nt-home" id="home-notice" aria-busy="true" style="grid-column:1/-1"><h2>남해캠 공지 최신 5</h2><div id="home-notice-list"><p class="muted">불러오는 중…</p></div>' +
      '<button class="btn-ghost small" type="button" data-go="#/notice">공지 전체 · 검색</button></section>';
  }
  function ntPaint(box, esc) {
    var list = box.querySelector('#home-notice-list');
    box.removeAttribute('aria-busy');
    if (!list) return;
    if (!ntRows || !ntRows.length) { list.innerHTML = '<p class="muted">' + NODATA + '</p>'; return; }
    list.innerHTML = ntRows.map(function (r) {
      var u = ntUrl(r.id), d = String(r.d || '').split('-');
      var when = d.length === 3 ? (+d[1]) + '.' + (+d[2]) + '.' : '';
      var inner = '<b>' + esc(r.t) + '</b><div class="item-meta">' + esc(when) + ' · ' + esc(r.dept || NODATA) + (u ? ' · 원문 ↗' : '') + '</div>';
      return u ? '<a class="list-btn" href="' + esc(u) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="list-btn">' + inner + '</div>';
    }).join('');
  }
  function aiNum(o, esc) { return o == null ? NODATA : esc(String(o)); }
  function aiPaint(esc, today) {
    var A = window.HJAIFlow, tasks = hbData && hbData.tasks;
    if (!A || !tasks) return '';
    if (!aiSrc) return '<div class="ai" id="hb-ai" aria-busy="true"><p class="ai-h">이상치만 · 자율도 · 검사</p><p class="muted small">불러오는 중…</p></div>';
    var an = A.anomalies({ tasks: tasks, checks: aiSrc.checks, ojnt: aiSrc.ojnt, budget: aiSrc.budget }, today);
    var s = A.summary(tasks);
    var h = '<div class="ai" id="hb-ai"><p class="ai-h">이상치만 <span>정상 건은 숫자만, 이상만 빨간 카드</span></p><div class="ai-alerts">';
    var quiet = [];
    [['출석', ATTEND_URL, 'ext'], ['마감', '', 'hb'], ['기숙사', '#/dorm', ''], ['예산', '#/more/budget', '', '연말 집행·불용 위험']].forEach(function (c) {
      var list = an[c[0]], k = c[3] || c[0];
      if (list === null) { quiet.push(k + ' ' + NODATA); return; }
      if (!list.length) { quiet.push(k + ' 이상 없음'); return; }
      var lines = list.slice(0, 3).map(function (x) {
        return '<li>' + (typeof x === 'string' ? esc(x) : esc(x.title || NODATA) + ' <small>' + (x.late ? '지남' : '임박') + '</small>') + '</li>';
      }).join('');
      var head = '<span class="ai-ak">' + k + ' 이상</span><b class="ai-an">' + list.length + '</b>';
      var sub = k === '마감' ? '<span class="hb-sub">지남 ' + list.filter(function (x) { return x.late; }).length + '</span>' : '';
      var body = head + sub + '<ul>' + lines + '</ul>' + (list.length > 3 ? '<small class="ai-more">외 ' + (list.length - 3) + '건</small>' : '');
      if (c[2] === 'hb') h += '<button type="button" class="ai-alert" data-hb="마감임박" aria-label="마감 이상 ' + list.length + '건 · 누르면 목록을 마감임박으로 좁혀요">' + body + '</button>';
      else if (c[2] === 'ext') h += '<a class="ai-alert" href="' + c[1] + '" target="_blank" rel="noopener">' + body + '</a>';
      else h += '<button type="button" class="ai-alert" data-go="' + c[1] + '">' + body + '</button>';
    });
    h += '</div>';
    if (quiet.length) h += '<p class="ai-quiet">' + quiet.map(esc).join(' · ') + '</p>';
    h += '<div class="ai-grid">';
    /* (a) 자율도 3단 + 유보 잠금 */
    h += '<section class="ai-p"><h3>자율도 3단 · 유보 잠금</h3><div class="ai-lv">' + A.LEVELS.map(function (k, i) {
      return '<span><i>' + (i + 1) + '</i>' + esc(k) + ' <b>' + aiNum(s.levels && s.levels[k], esc) + '</b></span>';
    }).join('') + '</div><p class="ai-locks">' + A.LOCKS.map(function (k) {
      return '<span class="ai-lock">🔒 ' + esc(k) + ' ' + s.lockBy[k] + '</span>';
    }).join('') + '</p><p class="ai-n">잠긴 건 ' + s.locked + ' · 유보는 자율도와 상관없이 사람 손(자동 실행 안 함)' +
      '</p><p class="ai-n" id="ai-lv-default">기본값: ' + esc(A.DEFAULT_LEVEL) + '(임시) · 자율도 값이 없는 건 ' + s.levelsDefault + '</p></section>';
    /* (e) 경계 안/밖 */
    h += '<section class="ai-p"><h3>경계 안 · 밖</h3><div class="ai-lv"><span class="ai-out">경계 밖 <b>' + s.boundary['밖'] + '</b></span><span>경계 안 <b>' + s.boundary['안'] + '</b></span>' +
      (s.boundary['모름'] ? '<span>' + NODATA + ' <b>' + s.boundary['모름'] + '</b></span>' : '') + '</div>' +
      '<p class="ai-n">경계 밖 = 사람 판단(유보·유진님 몫·확인·판단). 봇은 선택지·근거만 붙여요. <b>추천이지 결정이 아님.</b></p></section>';
    /* (c) 보고 전 검사 */
    h += '<section class="ai-p"><h3>보고 전 검사</h3><table class="ai-ck"><tbody>' + ['근거', '유보', '3줄'].map(function (k) {
      var c = s.checks[k], has = c.pass + c.fail;
      return '<tr><th scope="row">' + k + '</th><td>' + (has ? '통과 ' + c.pass + ' · <span class="ai-bad">미달 ' + c.fail + '</span>' + (c.none ? ' · ' + NODATA + ' ' + c.none : '') : NODATA) + '</td></tr>';
    }).join('') + '<tr><th scope="row">판단요청</th><td>' + (s.judge === null ? NODATA : s.judge.length ? '<span class="ai-bad">' + s.judge.length + '건</span>' : '0건') + '</td></tr></tbody></table>' +
      '<p class="ai-n">근거 = 현황판 「점검」 칸. 같은 건 ' + A.JUDGE_AFTER + '회 미달이면 다시 쓰지 않고 판단요청으로 올려요.</p></section>';
    /* (d) 문서·규정 답 근거 */
    var ds = A.docs({ bot_status: hbData, regular_docs: aiSrc.regular_docs, docsearch: aiSrc.docsearch });
    h += '<section class="ai-p"><h3>문서·규정 답 근거</h3><ul class="ai-docs">' + ds.map(function (d) {
      return '<li><b>' + esc(d.name) + '</b> <span>' + (d.date ? esc(hbShort(d.date)) : '없음') + '</span><br><small>' + (d.doc ? esc(d.doc) : '없음') +
        ' · <a href="' + d.where + '">' + esc(d.whereLabel) + '</a></small></li>';
    }).join('') + '</ul><p class="ai-n">답은 내부 최신 문서를 먼저 찾고 출처를 붙여요. 내부 문서에 없으면 「없음」.</p></section>';
    /* (f) 반려 이유 한 줄 누적 */
    var rj = A.rejects(hbData);
    h += '<section class="ai-p"><h3>반려 이유 (한 줄씩 누적)</h3>' + (rj === null || !rj.length ? '<p class="muted small">' + NODATA + '</p>' :
      '<ul class="ai-rj">' + rj.slice(-5).reverse().map(function (r) { return '<li>' + esc(r.why) + '</li>'; }).join('') + '</ul>') +
      '<p class="ai-n">반려·수정할 때 이유 한 줄이 쌓이면 여기에 최근 5줄이 보여요.</p></section>';
    h += '</div></div>';
    return h;
  }
  function hbShort(s) { var p = String(s || '').split('-'); return p.length === 3 ? (+p[1]) + '.' + (+p[2]) + '.' : ''; }
  function aiChips(t, esc) {
    var A = window.HJAIFlow;
    if (!A || !t) return '';
    var c = A.locks(t).map(function (k) { return '<span class="ai-chip ai-lock">🔒 ' + esc(k) + '</span>'; });
    var b = A.boundary(t);
    if (b === '밖') c.push('<span class="ai-chip ai-out">경계 밖 · 추천만</span>');
    else if (b === '안') c.push('<span class="ai-chip">경계 안</span>');
    var l = A.explicitLevel(t); if (l) c.push('<span class="ai-chip">' + esc(l) + '</span>');
    if (A.precheck(t).judge) c.push('<span class="ai-chip ai-bad">판단요청</span>');
    return c.length ? '<span class="ai-chips">' + c.join('') + '</span>' : '';
  }
  function hbPaint(box, esc) {
    var H = window.HJHomeBoard, B = window.HJBots;
    var tasks = hbData && hbData.tasks;
    var h = '<div class="hb-head"><h2>업무 현황판</h2><span class="hb-src">' +
      (hbData ? '현황판 시트 · ' + esc(hbData.built_at || '') + ' (KST) 읽음' : '현황판 자료를 불러오지 못했어요') + '</span></div>';
    var today = B ? B.todayKST() : '';
    var c = (H && tasks) ? H.counts(tasks, today) : null;
    h += '<div class="hb-cards" role="group" aria-label="상태별 건수 · 누르면 목록을 그 상태로 좁혀요">';
    ['예정', '진행', '수정', '보류', '마감임박'].forEach(function (k) {
      var n = c ? c[k] : null;
      var none = n === null || n === undefined;
      h += '<button type="button" class="hb-card' + (k === '마감임박' ? ' hb-hot' : '') + (none ? ' hb-none' : '') + '" data-hb="' + k + '" aria-pressed="' + (hbFilter === k) + '"' + (none ? ' disabled' : '') + '>' +
        '<span class="hb-k">' + k + '</span><b class="hb-n">' + (none ? NODATA : n) + '</b>' +
        (k === '마감임박' && c ? '<span class="hb-sub" id="hb-late">지남 ' + c['지남'] + '</span>' : '') + '</button>';
    });
    h += '</div>';
    h += aiPaint(esc, today);
    if (H && tasks) {
      var rows = H.rows(tasks, today, hbFilter);
      var shown = hbAll ? rows : rows.slice(0, 12);
      h += '<p class="hb-cap">' + (hbFilter ? esc(hbFilter) + ' ' : '안 끝난 건 ') + rows.length + '건 · 마감 가까운 순' +
        (hbFilter ? ' <button type="button" class="linkish hb-clear" data-hbclear="1">전체 보기</button>' : '') + '</p>';
      h += '<div class="hb-scroll"><table class="hb-table"><thead><tr><th scope="col">날짜</th><th scope="col">제목</th><th scope="col">담당</th><th scope="col">마감일</th></tr></thead><tbody>';
      if (!shown.length) h += '<tr><td colspan="4" class="muted">' + NODATA + '</td></tr>';
      shown.forEach(function (r) {
        h += '<tr' + (r.soon ? ' class="hb-soon"' : '') + '>' +
          '<td class="hb-d">' + (r.date ? esc(hbShort(r.date)) : NODATA) + '</td>' +
          '<td class="hb-t"><span class="hb-st">' + esc(r.status || NODATA) + '</span> ' + esc(r.title || NODATA) + aiChips(r.task, esc) + '</td>' +
          '<td class="hb-o">' + esc(r.owner || NODATA) + '</td>' +
          '<td class="hb-due">' + (r.due ? esc(hbShort(r.due)) + '<small>' + esc(r.dueLabel) + '</small>' : NODATA) + (r.soon ? '<span class="sr-only"> 마감임박</span>' : '') + '</td></tr>';
      });
      h += '</tbody></table></div>';
      if (rows.length > 12) h += '<button type="button" class="btn-ghost small" data-hbmore="1">' + (hbAll ? '12건만 보기' : '전체 ' + rows.length + '건 보기') + '</button> ';
      h += '<button type="button" class="btn-ghost small" data-go="#/bots">봇 작업 현황에서 자세히</button>';
      h += '<p class="hb-note">날짜 = 현황판 마지막 갱신일 · 담당 = 맡은 봇 · 마감임박 = 마감 D-' + H.SOON_DAYS + ' 이내(오늘·지난 것 포함, 빨간색). 예정 = 「할 일」·「대기」. 「수정」 상태는 현황판에 없어 ' + NODATA + '.</p>';
    } else {
      h += '<p class="muted">' + NODATA + '</p>';
    }
    box.innerHTML = h;
    box.removeAttribute('aria-busy');
    box.querySelectorAll('[data-hb]').forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute('data-hb'); hbFilter = hbFilter === k ? '' : k; hbAll = false; hbPaint(box, esc); };
    });
    var cl = box.querySelector('[data-hbclear]'); if (cl) cl.onclick = function () { hbFilter = ''; hbPaint(box, esc); };
    var mo = box.querySelector('[data-hbmore]'); if (mo) mo.onclick = function () { hbAll = !hbAll; hbPaint(box, esc); };
    box.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { location.hash = b.getAttribute('data-go'); }; });
  }
  function boardCard() {
    return '<section class="card hb" id="home-board" aria-busy="true"><div class="hb-head"><h2>업무 현황판</h2><span class="hb-src">불러오는 중…</span></div>' +
      '<div class="hb-cards">' + ['예정', '진행', '수정', '보류', '마감임박'].map(function (k) { return '<div class="hb-card hb-sk"><span class="hb-k">' + k + '</span><b class="hb-n">–</b></div>'; }).join('') + '</div></section>';
  }
  function render(el, api) {
    if (!api.unlocked()) return renderPublic(el, api);
    var pack = api.pack();
    var rec = api.records();
    var today = new Date();
    var todos = (pack.entities.monthly_todos || []).filter(function (t) { return inThisMonth(t, today); });
    todos.sort(function (a, b) {
      var da = nextDate(a, today), db = nextDate(b, today);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
    var soon = ymd(addDays(today, 7));
    var work = (pack.entities.work_items || []).filter(function (w) { return w.status !== '완료'; });
    work.sort(function (a, b) { return String(a.due || '9999') < String(b.due || '9999') ? -1 : 1; });
    var cont = rec.continue || {};
    var task = (pack.entities.tasks || []).filter(function (t) { return t.id === cont.taskId; })[0];
    var day = (pack.entities.study_days || []).filter(function (d) { return d.day === cont.studyDay; })[0];
    var hasLocal = (rec.tasks && Object.keys(rec.tasks).length) || (rec.study && rec.study.done && Object.keys(rec.study.done).length) || (rec.questions && Object.keys(rec.questions).length);
    var backupOld = hasLocal && (!rec.lastBackupAt || (Date.now() - new Date(rec.lastBackupAt).getTime() > 14 * 86400000));

    var review = reviewItems(pack);
    var schedAll = (pack.entities.schedule && pack.entities.schedule.items) || [];
    var schedOpen = schedAll.filter(function (it) { return !it.done; }).length;
    var h = '<section class="hero"><p class="kicker">' + today.getFullYear() + '년 ' + (today.getMonth() + 1) + '월 ' + today.getDate() + '일</p><h1 class="hero-title">오늘 뭐부터 할까요?</h1></section>';
    h += boardCard();
    h += '<div class="home-rest">';
    h += ntCard();
    h += otEntry();
    // 봇 작업 현황(#/bots): 홈 맨 위에서 바로 들어가요. 숫자는 data/bot_status.json 을 읽은 뒤 채워요(유진님 10.21. 20:15 지시).
    h += '<button class="bs-entry" type="button" data-go="#/bots" id="home-bots"><span class="tile-ic purple">🤖</span><span class="bs-entry-tx"><b>봇 작업 현황</b><span class="tile-sub" id="home-bots-sub">지금 도는 일을 한 줄씩</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    // 학과·사람별 업무(#/who): 누가 무슨 일을 하나(유진님 10.22. 00:54 요청). 실명 없이 역할 표기만.
    h += '<button class="bs-entry" type="button" data-go="#/who" id="home-who"><span class="tile-ic teal">👥</span><span class="bs-entry-tx"><b>학과·사람별 업무</b><span class="tile-sub">누구한테 물을지 · 문제 55개</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    // 정례 문서 달력(#/regular-docs): 달마다 돌아오는 문서 격자(유진님 10.22. 「사이트에도 넣으라」).
    h += '<button class="bs-entry" type="button" data-go="#/regular-docs" id="home-regdocs"><span class="tile-ic teal">🗓️</span><span class="bs-entry-tx"><b>정례 문서 달력</b><span class="tile-sub">달마다 오는 문서 · 다가오는 달 예상</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    // 학사 연습(#/haksa): 통합학사행정 메뉴 모사. 실서버·저장 없음.
    h += '<button class="bs-entry" type="button" data-go="#/haksa" id="home-haksa"><span class="tile-ic blue">학</span><span class="bs-entry-tx"><b>학사 연습</b><span class="tile-sub">통합학사행정 메뉴 · 저장 없음</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    // 협조리스트 원큐(#/coop): 업무별 협조처·휴보강 경로·번호부 주업무(유진님 10.27. 「원큐에 협조리스트」).
    h += '<button class="bs-entry" type="button" data-go="#/coop" id="home-coop"><span class="tile-ic orange">🤝</span><span class="bs-entry-tx"><b>협조리스트 (원큐)</b><span class="tile-sub">오늘 Top5 · 부서·사람 · 규정 · 휴보강 경로</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    // 그래프(#/charts)·중요문서(#/docs): 대장 kv 261029 19:05 (유진님 「앞으로 앱에 이거 적용」「국토교통부 등 관련문서 앱에서 보일 수 있게」). 261029 21시 「적용해」: 거미줄 자리(협조 바로 아래)로 올림.
    h += '<button class="bs-entry" type="button" data-go="#/charts" id="home-charts"><span class="tile-ic blue">📊</span><span class="bs-entry-tx"><b>그래프</b><span class="tile-sub">일정 달력 · 글로컬 잔액 · 추세 · 강사료 구성</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    // 261102 유진님 16:27 「그리고 이거 붙여봐.」: 공공데이터 5셋(#/pubdata)
    h += '<button class="bs-entry" type="button" data-go="#/pubdata" id="home-pubdata"><span class="tile-ic blue">🗂</span><span class="bs-entry-tx"><b>공공데이터</b><span class="tile-sub">정비사 응시·취득 · 전국 vs 교육원 대조</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    h += '<button class="bs-entry" type="button" data-go="#/docs" id="home-docs"><span class="tile-ic teal">🏛</span><span class="bs-entry-tx"><b>중요문서</b><span class="tile-sub">국토교통부·산업인력공단 등 외부기관 · 웹으로만</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    // 내일 할 일(#/todo): 한 장 체크리스트(유진님 10.27. 「이런건 앱에 못띄워주나」).
    h += '<button class="bs-entry" type="button" data-go="#/todo" id="home-todo"><span class="tile-ic green">✅</span><span class="bs-entry-tx"><b>내일 할 일</b><span class="tile-sub">10.28 시드 · 한 장 리스트</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    // 문서등록대장 학습(#/docreg): 문제 풀며 문서등록대장 익히기(유진님 10.21. 20:47 지시). 진도는 자료를 읽은 뒤 채워요.
    h += '<button class="bs-entry" type="button" data-go="#/docreg" id="home-docreg"><span class="tile-ic teal">📑</span><span class="bs-entry-tx"><b>문서등록대장 학습</b><span class="tile-sub" id="home-docreg-sub">분류별 문제로 문서 익히기</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    // 문서대장 찾기(#/docsearch): 키워드·질문 검색·부족 부서(유진님 11.02. 「문서대장 부족한 부서랑, 키워드로 검색이나 ai 검색가능한 사이트를 앱 내에 만들어줘.」).
    h += '<button class="bs-entry" type="button" data-go="#/docsearch" id="home-docsearch"><span class="tile-ic blue">🔎</span><span class="bs-entry-tx"><b>문서대장 찾기</b><span class="tile-sub">키워드 · AI 질문(키 없이) · 부족 부서</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    h += card3d();
    h += '<p class="menu-group">바로가기</p><div class="tiles">' +
      tile('#/board', '📋', '오늘 할 일', work.length ? ('진행 중 ' + work.length + '건') : '업무 현황표', 'blue') +
      tile('#/schedule', '🗓️', '남은 일정', schedOpen ? ('남은 일 ' + schedOpen + '개') : '체크리스트', 'green') +
      tile('#/dorm', '🏠', '기숙사 현황판', '방 배정·도면', 'orange') +
      tile('#/study/must', '📌', '주무관 필독', '교육원·항공기술 요지', 'teal') +
      tile('#/study', '📚', '공부', '하루 10분·규정', 'teal') +
      tile('#/banner', '🪧', '현수막 만들기', '시안·예전 현수막', 'purple') +
      tile('#/3d', '🏫', '교육원 전경 3D', '앱 안에서 크게 보기', 'blue') +
      '</div>';
    h += '<section class="card"><h2>확인 필요</h2>';
    if (!review.length) h += '<p class="muted">표시해 둔 확인 필요가 없어요.</p>';
    review.forEach(function (item) {
      h += '<button class="list-btn" type="button" data-go="' + api.esc(item.href) + '"><span class="badge warn">확인 필요</span> <b>' + api.esc(item.title) + '</b><div class="item-meta">' + api.esc(item.why) + '</div></button>';
    });
    if (backupOld) h += '<div class="warnbox">2주가 지났어요. 더보기 → 설정에서 백업을 받아 두세요. 브라우저 저장은 지워질 수 있어요.</div>';
    (pack.corrections || []).forEach(function (c) {
      h += '<p class="muted">' + api.esc(c.date) + ' · ' + api.esc(c.text) + '</p>';
    });
    h += '</section>';

    if (window.APSchedule && pack.entities.schedule) {
      var schedItems = pack.entities.schedule.items || [];
      var schedCount = APSchedule.counts(schedItems, today);
      var schedNext = APSchedule.sortItems(schedItems).filter(function (it) { return !it.done; }).slice(0, 3);
      h += '<section class="card"><h2>남은 일정</h2><div class="statgrid"><div><b>' + schedCount.over + '</b><span>지남</span></div><div><b>' + schedCount.today + '</b><span>오늘</span></div><div><b>' + schedCount.week + '</b><span>이번 주</span></div><div><b>' + schedCount.open + '</b><span>남은 일</span></div></div>';
      if (!schedNext.length) h += '<p class="muted">남은 일정이 없어요.</p>';
      schedNext.forEach(function (it) {
        h += '<button class="list-btn" type="button" data-go="#/schedule/' + api.esc(it.id) + '"><b>' + api.esc(it.title) + '</b><div class="item-meta">' + api.esc(APSchedule.whenLabel(it, today)) + ' · ' + api.esc(APSchedule.dday(it, today)) + '</div></button>';
      });
      h += '<button class="btn-ghost small" type="button" data-go="#/schedule">남은 일정 열기</button></section>';
    }

    var latest = window.APNews ? APNews.byNewest(pack.entities.news || []).slice(0, 3) : [];
    h += '<section class="card"><h2>최근 소식</h2>';
    if (!latest.length) h += '<p class="muted">아직 소식이 없어요.</p>';
    latest.forEach(function (n) {
      h += '<button class="list-btn" type="button" data-go="#/news/' + api.esc(n.id) + '">' +
        (n.status === '확인 필요' ? '<span class="badge warn">확인 필요</span> ' : '') +
        (n.status === '취소' ? '<span class="badge no">취소</span> ' : '') +
        '<b' + (n.status === '취소' ? ' class="strike"' : '') + '>' + api.esc(n.title) + '</b><div class="item-meta">' + api.esc(n.date) + ' · ' + api.esc(n.category || '') + '</div></button>';
    });
    h += '<button class="btn-ghost small" type="button" data-go="#/news">교육원 소식</button></section>';

    var pcs = window.APComputers ? APComputers.summarize(pack.entities.computers || []) : null;
    h += '<section class="card"><h2>컴퓨터 현황</h2>';
    if (!pcs || !pcs.rows) h += '<p>엑셀봇 자료를 가져오면 여기에 보여요.</p><p class="muted">알려진 현황: 실제 37대, 교체대상 5대, 윈도우 버전 확인 중.</p>';
    else {
      h += '<div class="statgrid"><div><b>' + pcs.total + '</b><span>대수</span></div><div><b>' + pcs.unconfirmed + '</b><span>버전 미확인</span></div><div><b>' + pcs.replace + '</b><span>교체대상</span></div><div><b>' + pcs.excluded + '</b><span>대수 제외</span></div></div>';
    }
    h += '<button class="btn-ghost small" type="button" data-go="#/computers">컴퓨터 현황 열기</button></section>';

    var dormSeed = pack.entities.dorm;
    if (dormSeed && window.APDorm) {
      var dormSum = APDorm.summarize(dormSeed.rows, APDorm.confirmedAmount(pack), dormSeed.unit, dormSeed.months, {
        memo: dormSeed.roomMemo, genderSplitStatus: dormSeed.genderSplitStatus
      });
      h += '<section class="card"><h2>기숙사 현황판</h2><div class="statgrid"><div><b>' + (dormSeed.ojntHeadcount || dormSum.traineePlan) + '</b><span>연수생 인원' + (dormSeed.ojntHeadcount ? '(출석부)' : '') + '</span></div><div><b>' + dormSum.teachers + '</b><span>강사</span></div><div><b>' + dormSum.emptyRooms + '</b><span>빈방</span></div><div><b>' + (dormSum.needsConfirm ? '확인' : api.won(dormSum.fee).replace('원', '')) + '</b><span>' + (dormSum.needsConfirm ? '기숙사비 확인 필요' : '기숙사비(원)') + '</span></div></div>';
      if (dormSeed.ojntHeadcount) h += '<p class="item-meta">OJNT ' + dormSeed.ojntHeadcount + '명(출석부 기준)' + (dormSeed.ojntExcluded ? ' · 이번 인원 아님 ' + dormSeed.ojntExcluded + '명' : '') + '</p>';
      var dormAmt = APDorm.confirmedAmount(pack), dormHc = dormSeed.confirmedHeadcount;
      if (dormSeed.ojntHeadcount && dormHc && dormHc !== dormSeed.ojntHeadcount && dormAmt) h += '<p id="home-dorm-fee"><span class="badge warn">' + dormSeed.ojntHeadcount + '명 기준 재확인 필요</span> 기숙사운영비 ' + api.esc(api.won(dormAmt)) + '(' + dormHc + '명 기준)</p>';
      else if (dormSum.needsConfirm) h += '<p><span class="badge warn">확인 필요</span> 계산한 기숙사비가 예산의 확정액과 달라요.</p>';
      if (dormSum.genderNeedsConfirm) h += '<p><span class="badge warn">확인 필요</span> ' + api.esc(dormSeed.genderSplitNote || '미확정 인원의 성별 구성은 확인 필요예요.') + '</p>';
      if (dormSum.reservedRooms) h += '<p class="muted">여자 강사 전용 ' + dormSum.reservedRooms + '실은 연수생 빈방에서 빼요.</p>';
      h += '<p class="muted">' + api.esc(dormSeed.deadlineNote || '') + '</p>';
      h += '<button class="btn-ghost small" type="button" data-go="#/dorm">기숙사 도면 열기</button></section>';
    } else {
      h += '<section class="card"><h2>기숙사 현황판</h2><p class="muted">눌러서 바로 열어요.</p><button class="btn-ghost small" type="button" data-go="#/dorm">기숙사 현황판 열기</button></section>';
    }

    h += '<section class="card"><h2>이번 달 할 일</h2>';
    if (!todos.length) h += '<p class="muted">이번 달에 표시할 일이 없어요.</p>';
    todos.forEach(function (t) {
      var nd = nextDate(t, today);
      var label = nd ? (nd.getMonth() + 1) + '.' + nd.getDate() + '.' : (t.when || '날짜 확인 필요');
      var near = nd && ymd(nd) <= soon;
      h += '<div class="doc-card"><b>' + api.esc(t.title) + '</b> <span class="badge' + (near ? ' warn' : '') + '">' + api.esc(label) + '</span>';
      if (t.note) h += '<div class="item-meta">' + api.esc(t.note) + '</div>';
      h += '</div>';
    });
    h += '<button class="btn-ghost small" id="edit-month" type="button">매달 할 일 고치기</button></section>';

    h += '<section class="card"><h2>오늘 이어서 할 업무</h2>';
    if (!work.length) h += '<p class="muted">진행 중인 일이 없어요. 업무현황표에서 추가해요.</p>';
    work.slice(0, 5).forEach(function (w) {
      h += '<button class="list-btn" type="button" data-w="' + api.esc(w.id) + '"><b>' + api.esc(w.title) + '</b><div class="item-meta">' +
        api.esc(w.stage || '단계 없음') + (w.due ? ' · 마감 ' + api.esc(w.due) : '') + (w.amount ? ' · ' + api.esc(api.won(w.amount)) : ' · 금액 확인 필요') +
        '</div></button>';
    });
    h += '</section>';

    h += '<section class="card"><h2>이어서 하기</h2><div class="row">';
    if (task) h += '<button class="btn" type="button" data-go="#/practice/task/' + api.esc(task.id) + '">과제 · ' + api.esc(task.title) + '</button>';
    if (day) h += '<button class="btn" type="button" data-go="#/study/day/' + day.day + '">공부 ' + day.day + '일차</button>';
    if (cont.questionId) h += '<button class="btn" type="button" data-go="#/practice/quiz">문제 이어서</button>';
    if (!task && !day && !cont.questionId) h += '<p class="muted">아직 이어갈 기록이 없어요. 공부나 연습장에서 하나를 열어 보세요.</p>';
    h += '</div></section>';
    h += '</div>';

    el.innerHTML = h;
    el.classList.add('wide');
    var hbBox = el.querySelector('#home-board');
    if (hbBox) hbLoad().then(function () {
      if (!hbBox.isConnected) return;
      hbPaint(hbBox, api.esc);
      if (!aiSrc) aiAfterLoad(function () { aiLoad().then(function () { if (hbBox.isConnected) hbPaint(hbBox, api.esc); }); });
    });
    var ntBox = el.querySelector('#home-notice');
    if (ntBox) aiAfterLoad(function () { ntLoad().then(function () { if (ntBox.isConnected) ntPaint(ntBox, api.esc); }); });
    var edit = el.querySelector('#edit-month');
    if (edit) edit.onclick = function () { api.go('#/more/month'); };
    el.querySelectorAll('[data-w]').forEach(function (b) {
      b.onclick = function () { api.go('#/board/' + b.getAttribute('data-w')); };
    });
    el.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { api.go(b.getAttribute('data-go')); };
    });
    if (window.HJDocregPeek) window.HJDocregPeek().then(function (s) {
      var sub = document.getElementById('home-docreg-sub');
      if (!s || !sub) return;
      sub.textContent = s.done ? ('푼 문제 ' + s.done + ' / ' + s.total + ' · 틀린 문제 ' + s.wrong) : ('문제 ' + s.total + '개 · 내 업무 분류부터');
    });
    if (window.HJBotsPeek) window.HJBotsPeek().then(function (sec) {
      var sub = document.getElementById('home-bots-sub');
      if (!sec || !sub) return;
      var sure = sec.yujin.filter(function (t) { return t.yujin_src === '현황판'; }).length;
      sub.textContent = '유진님 몫 확정 ' + sure + ' · 마감 임박 ' + sec.soon.length + ' · 감사 위험 ' + sec.risk.length;
    });
  }

  function renderPublic(el, api) {
    var guide = api.guide();
    var news = (guide.sections || []).filter(function (s) { return s.id === 'news'; })[0];
    var h = otEntry() + '<section class="card"><p class="kicker">행정 업무 연습장</p><h1>오늘 찾을 일</h1>' +
      '<p>자료를 불러오지 못했어요. 새로고침해 주세요. 학생 안내는 바로 볼 수 있어요.</p>' +
      '<div class="row"><button class="btn" id="go-stu" type="button">학생 안내</button>' +
      '<button class="btn-ghost" id="go-admin" type="button">행정 업무 열기</button></div></section>';
    h += card3d();
    h += '<section class="card"><h2>공지</h2>';
    if (!news) h += '<p class="muted">공지가 없어요.</p>';
    else h += '<button class="list-btn" type="button" id="go-news"><b>' + api.esc(news.title) + '</b><div class="item-meta">' + api.esc(guide.notice || '') + '</div></button>';
    h += '</section>';
    el.innerHTML = h;
    el.querySelector('#go-stu').onclick = function () { api.go('#/students'); };
    el.querySelector('#go-admin').onclick = function () { api.go('#/board'); };
    var newsBtn = el.querySelector('#go-news');
    if (newsBtn) newsBtn.onclick = function () { api.go('#/students/news'); };
    el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { api.go(b.getAttribute('data-go')); }; });
  }

  ShellModules.home = { id: 'home', tab: '홈', icon: icon, render: render };
})();

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
  function card3d() {
    return '<section class="card home3d"><div class="home3d-head"><h2>교육원 전경 3D</h2>' +
      '<button class="btn-ghost small" type="button" data-go="#/3d">전체 화면</button></div>' + verBtns() +
      '<div class="home3d-stage"><iframe data-3dframe="embed" title="교육원 전경 3D 미리보기" src="' + window.HJ3D.src(true).replace(/&/g, '&amp;') + '" loading="lazy"></iframe></div>' +
      '<p class="muted small">층 버튼을 눌러 보세요. 화면을 누르면 크게 돌려 볼 수 있어요. 호실번호는 3D 사이트에 입력한 값 그대로예요. ' +
      '<a href="https://silseupdong-3d.yujin06344.workers.dev/" target="_blank" rel="noopener">편집은 3D 사이트(PIN) ↗</a></p></section>';
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
    // 봇 작업 현황(#/bots): 홈 맨 위에서 바로 들어가요. 숫자는 data/bot_status.json 을 읽은 뒤 채워요(유진님 10.21. 20:15 지시).
    h += '<button class="bs-entry" type="button" data-go="#/bots" id="home-bots"><span class="tile-ic purple">🤖</span><span class="bs-entry-tx"><b>봇 작업 현황</b><span class="tile-sub" id="home-bots-sub">지금 도는 일을 한 줄씩</span></span><span class="bs-entry-go" aria-hidden="true">›</span></button>';
    h += card3d();
    h += '<div class="tiles">' +
      tile('#/board', '📋', '오늘 할 일', work.length ? ('진행 중 ' + work.length + '건') : '업무 현황표', 'blue') +
      tile('#/schedule', '🗓️', '남은 일정', schedOpen ? ('남은 일 ' + schedOpen + '개') : '체크리스트', 'green') +
      tile('#/dorm', '🏠', '기숙사 현황판', '방 배정·도면', 'orange') +
      tile('#/banner', '🪧', '현수막 만들기', '시안·예전 현수막', 'purple') +
      tile('#/3d', '🏫', '교육원 전경 3D', '앱 안에서 크게 보기', 'blue') +
      tile('#/study', '📚', '공부', '하루 10분', 'teal') +
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
      h += '<section class="card"><h2>기숙사 현황판</h2><div class="statgrid"><div><b>' + dormSum.traineePlan + '</b><span>연수생 인원</span></div><div><b>' + dormSum.teachers + '</b><span>강사</span></div><div><b>' + dormSum.emptyRooms + '</b><span>빈방</span></div><div><b>' + (dormSum.needsConfirm ? '확인' : api.won(dormSum.fee).replace('원', '')) + '</b><span>' + (dormSum.needsConfirm ? '기숙사비 확인 필요' : '기숙사비(원)') + '</span></div></div>';
      if (dormSum.needsConfirm) h += '<p><span class="badge warn">확인 필요</span> 계산한 기숙사비가 예산의 확정액과 달라요.</p>';
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

    el.innerHTML = h;
    var edit = el.querySelector('#edit-month');
    if (edit) edit.onclick = function () { api.go('#/more/month'); };
    el.querySelectorAll('[data-w]').forEach(function (b) {
      b.onclick = function () { api.go('#/board/' + b.getAttribute('data-w')); };
    });
    el.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { api.go(b.getAttribute('data-go')); };
    });
    if (window.HJBotsPeek) window.HJBotsPeek().then(function (sec) {
      var sub = document.getElementById('home-bots-sub');
      if (sec && sub) sub.textContent = '유진님 몫 ' + sec.yujin.length + ' · 마감 임박 ' + sec.soon.length + ' · 감사 위험 ' + sec.risk.length;
    });
  }

  function renderPublic(el, api) {
    var guide = api.guide();
    var news = (guide.sections || []).filter(function (s) { return s.id === 'news'; })[0];
    var h = '<section class="card"><p class="kicker">행정 업무 연습장</p><h1>오늘 찾을 일</h1>' +
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

(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20"/></svg>';

  function daysOf(api) { return api.pack().entities.study_days || []; }
  function doneMap(api) { return (api.records().study && api.records().study.done) || {}; }

  function render(el, api) {
    var parts = api.route().parts;
    if (parts[1] === 'day' && parts[2]) return dayView(el, api, Number(parts[2]));
    if (parts[1] === 'rule' && parts[2]) return regView(el, api, parts[2]);
    if (parts[1] === 'must') return mustView(el, api);
    if (parts[1] === 'changelog') return changelogView(el, api);
    var days = daysOf(api);
    var done = doneMap(api);
    var nDone = days.filter(function (d) { return done[d.day]; }).length;
    var pct = days.length ? Math.round(nDone / days.length * 100) : 0;
    var leftMin = (days.length - nDone) * 10;
    var today = days.filter(function (d) { return !done[d.day]; })[0] || days[days.length - 1];
    var h = '<section class="card"><p class="kicker">하루 10분</p><h1>공부</h1>' +
      '<div class="statgrid"><div><b>' + pct + '%</b><span class="muted">진도</span></div><div><b>' + leftMin + '분</b><span class="muted">남은 시간</span></div></div>' +
      '<div class="bar" style="margin-top:10px"><i style="width:' + pct + '%"></i></div></section>';
    h += '<section class="card must-entry"><p class="kicker">주무관 필독</p><h2>교육원·항공기술 규정 요지</h2>' +
      '<p class="muted">두 기관을 섞지 말 것 · ATIMS 10일 · 정원·시수 · 출석·시험 · 교관·기록·유효기간</p>' +
      '<button class="btn block" id="go-must" type="button">필독 10가지 열기</button></section>';
    h += '<section class="card cl-entry"><p class="kicker">변경이력 · 학습</p><h2>카드로 보는 연습장 변화</h2>' +
      '<p class="muted">필독·학생안내·3D·LMS·봇현황·기숙사·배포 — 표지를 넘기며 요지를 읽어요</p>' +
      '<button class="btn block" id="go-changelog" type="button">변경이력 카드 열기</button></section>';
    if (today) {
      h += '<section class="card"><p class="kicker">오늘의 카드</p><h2>' + today.day + '일차 · ' + api.esc(today.title) + '</h2>' +
        '<p>' + api.esc(today.goal || '') + '</p><button class="btn block" id="open-today" type="button">오늘 공부 열기</button>' +
        '<button class="btn-ghost block" id="go-practice" type="button">연습장</button></section>';
    }
    var topic = '', stage = '';
    days.forEach(function (d) {
      if (d.topic !== topic) { topic = d.topic; stage = ''; h += '<h2 class="stage">' + api.esc(topic) + '</h2>'; }
      if (d.stage !== stage) { stage = d.stage; h += '<p class="kicker">' + api.esc(stage) + '</p>'; }
      h += '<button class="day' + (today && today.day === d.day ? ' on' : '') + '" type="button" data-day="' + d.day + '"><span class="n">' + d.day + '</span><span><b>' + api.esc(d.title) + '</b>' +
        (done[d.day] ? ' <span class="badge ok">함</span>' : '') + '</span></button>';
    });
    var regs = api.pack().entities.regulations || [];
    var pin = { g8: 1, g11: 1, g12: 1, g13: 1, g14: 1 };
    var pinned = regs.filter(function (r) { return pin[r.id]; });
    var rest = regs.filter(function (r) { return !pin[r.id]; });
    h += '<section class="card"><h2>알아야 할 규정</h2><p class="muted">' + regs.length + '개. 조문과 원문 위치만 적혀 있어요.</p>';
    if (pinned.length) {
      h += '<p class="menu-group">교육원·필독 관련</p>';
      pinned.forEach(function (r) {
        h += '<button class="list-btn pin-reg" type="button" data-reg="' + api.esc(r.id) + '"><b>' + api.esc(r.name) + '</b> <span class="badge ok">필독</span><div class="item-meta">' + api.esc(r.summary || '') + '</div></button>';
      });
      h += '<p class="menu-group">그 밖 규정</p>';
    }
    rest.forEach(function (r) {
      h += '<button class="list-btn" type="button" data-reg="' + api.esc(r.id) + '"><b>' + api.esc(r.name) + '</b><div class="item-meta">' + api.esc(r.summary || '') + '</div></button>';
    });
    h += '</section>';
    el.innerHTML = h;
    var open = el.querySelector('#open-today');
    if (open && today) open.onclick = function () { api.go('#/study/day/' + today.day); };
    var prac = el.querySelector('#go-practice');
    if (prac) prac.onclick = function () { api.go('#/practice'); };
    var gm = el.querySelector('#go-must');
    if (gm) gm.onclick = function () { api.go('#/study/must'); };
    var gc = el.querySelector('#go-changelog');
    if (gc) gc.onclick = function () { api.go('#/study/changelog'); };
    el.querySelectorAll('[data-day]').forEach(function (b) {
      b.onclick = function () { api.go('#/study/day/' + b.getAttribute('data-day')); };
    });
    el.querySelectorAll('[data-reg]').forEach(function (b) {
      b.onclick = function () { api.go('#/study/rule/' + b.getAttribute('data-reg')); };
    });
  }

  function dayView(el, api, n) {
    var d = daysOf(api).filter(function (x) { return x.day === n; })[0];
    if (!d) { el.innerHTML = '<section class="card"><p>없는 날이에요.</p></section>'; return; }
    var on = !!doneMap(api)[d.day];
    var h = '<button class="linkish" id="back" type="button">← 공부</button><section class="card">' +
      '<p class="kicker">' + api.esc(d.topic) + ' · ' + api.esc(d.stage) + ' · ' + (d.minutes || 10) + '분</p>' +
      '<h1>' + d.day + '. ' + api.esc(d.title) + '</h1>' +
      '<p><b>목표</b><br>' + api.esc(d.goal || '') + '</p>';
    if (d.core && d.core.length) {
      h += '<h2>핵심</h2><ul>';
      d.core.forEach(function (c) { h += '<li>' + api.esc(c) + '</li>'; });
      h += '</ul>';
    }
    if (d.example) h += '<h2>예시</h2><p>' + api.esc(d.example) + '</p>';
    h += '<h2>확인 문제</h2>';
    (d.questions || []).forEach(function (q, i) {
      h += '<div class="q-card"><b>' + (i + 1) + '.</b> ' + api.esc(q.q) +
        '<div id="ans-' + i + '" class="hidden okbox" style="margin-top:8px">' + api.esc(q.a || '') + '</div>' +
        '<button class="btn-ghost small" type="button" data-ans="' + i + '">답 보기</button></div>';
    });
    if (d.basis) h += '<p class="muted"><b>근거</b><br>' + api.esc(d.basis) + '</p>';
    if (d.link) h += '<p>' + api.esc(d.link) + '</p>';
    if (d.review) h += '<h2>단계 종합 확인</h2><div class="pre">' + api.esc(d.review) + '</div>';
    h += '<button class="btn block" id="did" type="button">' + (on ? '함 (다시 누르면 취소)' : '함') + '</button></section>';
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/study'); };
    el.querySelectorAll('[data-ans]').forEach(function (b) {
      b.onclick = function () {
        var box = document.getElementById('ans-' + b.getAttribute('data-ans'));
        box.classList.toggle('hidden');
      };
    });
    el.querySelector('#did').onclick = function () {
      api.markStudy(d.day, !on).then(function () { api.toast(on ? '취소했어요.' : '오늘 공부를 했어요.'); api.refresh(); });
    };
  }



  var changelogCache = null;
  function loadChangelog() {
    if (!changelogCache) {
      changelogCache = fetch(new URL('data/changelog_cards.json', document.baseURI).href, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('changelog'); return r.json(); })
        .catch(function () { return null; });
    }
    return changelogCache;
  }
  function changelogView(el, api) {
    var parts = api.route().parts;
    var detailId = parts[2] || '';
    el.innerHTML = '<button class="linkish" id="back" type="button">← 공부</button><section class="card"><p class="muted">불러오는 중…</p></section>';
    el.querySelector('#back').onclick = function () { api.go('#/study'); };
    loadChangelog().then(function (d) {
      if (!d || !d.items || !d.items.length) {
        el.innerHTML = '<button class="linkish" id="back" type="button">← 공부</button><section class="card"><p>변경이력 자료를 못 불러왔어요.</p></section>';
        el.querySelector('#back').onclick = function () { api.go('#/study'); };
        return;
      }
      if (detailId) {
        var hit = d.items.filter(function (it) { return it.id === detailId; })[0];
        if (!hit) {
          el.innerHTML = '<button class="linkish" id="back" type="button">← 변경이력</button><section class="card"><p>없는 카드예요.</p></section>';
          el.querySelector('#back').onclick = function () { api.go('#/study/changelog'); };
          return;
        }
        return changelogDetail(el, api, d, hit);
      }
      changelogStage(el, api, d);
    });
  }
  function changelogStage(el, api, d) {
    var items = d.items;
    var focus = 0;
    var h = '<button class="linkish" id="back" type="button">← 공부</button>' +
      '<section class="cl-hero card">' +
      '<p class="kicker">' + api.esc(d.subtitle || '변경이력 · 학습 카드') + '</p>' +
      '<h1>' + api.esc(d.title || '변경이력') + '</h1>' +
      '<p class="muted">오른쪽 표지를 넘기면 왼쪽 요지가 따라가요. 표지를 누르면 상세 패널이 열려요.</p></section>' +
      '<div class="cl-stage" id="cl-stage">' +
      '<div class="cl-left" id="cl-left" aria-live="polite"></div>' +
      '<div class="cl-right">' +
      '<div class="cl-rail" id="cl-rail" tabindex="0" role="listbox" aria-label="변경이력 표지">' +
      items.map(function (it, i) {
        return '<button class="cl-cover tone-' + api.esc(it.tone || 'sky') + '" type="button" role="option" data-i="' + i + '" data-id="' + api.esc(it.id) + '" aria-label="' + api.esc((it.ver || '') + ' ' + (it.title || '')) + '">' +
          '<span class="cl-cover-emoji" aria-hidden="true">' + api.esc(it.emoji || '🃏') + '</span>' +
          '<span class="cl-cover-ver">' + api.esc(it.ver || '') + '</span>' +
          '<span class="cl-cover-label">' + api.esc(it.label || '') + '</span>' +
          '<span class="cl-cover-title">' + api.esc(it.title || '') + '</span>' +
          '<span class="cl-cover-tag">' + api.esc(it.tag || '') + '</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<p class="cl-hint muted">스크롤 · 화살표 키 · 표지 클릭</p>' +
      '</div></div>';
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/study'); };
    var left = el.querySelector('#cl-left');
    var rail = el.querySelector('#cl-rail');
    var covers = Array.prototype.slice.call(el.querySelectorAll('.cl-cover'));
    function paintLeft(i) {
      focus = Math.max(0, Math.min(items.length - 1, i));
      var it = items[focus];
      left.innerHTML =
        '<p class="cl-kicker">' + api.esc(it.tag || '') + (it.date ? ' · ' + api.esc(it.date) : '') + '</p>' +
        '<div class="cl-ver" aria-hidden="true">' + api.esc(it.ver || '') + '</div>' +
        '<p class="cl-label">' + api.esc(it.label || '') + '</p>' +
        '<h2 class="cl-title">' + api.esc(it.title || '') + '</h2>' +
        '<p class="cl-summary">' + api.esc(it.summary || '') + '</p>' +
        '<button class="btn" type="button" id="cl-open">이 카드 상세 보기</button>';
      covers.forEach(function (c, idx) {
        c.classList.toggle('on', idx === focus);
        c.setAttribute('aria-selected', idx === focus ? 'true' : 'false');
      });
      var open = left.querySelector('#cl-open');
      if (open) open.onclick = function () { api.go('#/study/changelog/' + it.id); };
    }
    function scrollToFocus(smooth) {
      var c = covers[focus];
      if (!c || !rail) return;
      var leftPad = (rail.clientWidth - c.offsetWidth) / 2;
      var x = c.offsetLeft - Math.max(0, leftPad);
      rail.scrollTo({ left: x, behavior: smooth ? 'smooth' : 'auto' });
    }
    function nearestIndex() {
      if (!rail || !covers.length) return 0;
      var mid = rail.scrollLeft + rail.clientWidth / 2;
      var best = 0, bestDist = Infinity;
      covers.forEach(function (c, i) {
        var cx = c.offsetLeft + c.offsetWidth / 2;
        var dist = Math.abs(cx - mid);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      return best;
    }
    var ticking = false;
    rail.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var n = nearestIndex();
        if (n !== focus) paintLeft(n);
      });
    }, { passive: true });
    covers.forEach(function (c) {
      c.addEventListener('click', function () {
        var i = Number(c.getAttribute('data-i'));
        paintLeft(i);
        scrollToFocus(true);
        api.go('#/study/changelog/' + c.getAttribute('data-id'));
      });
    });
    rail.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
        ev.preventDefault(); paintLeft(focus + 1); scrollToFocus(true);
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
        ev.preventDefault(); paintLeft(focus - 1); scrollToFocus(true);
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault(); api.go('#/study/changelog/' + items[focus].id);
      }
    });
    paintLeft(0);
    requestAnimationFrame(function () { scrollToFocus(false); });
  }
  function changelogDetail(el, api, d, it) {
    var h = '<button class="linkish" id="back" type="button">← 변경이력</button>' +
      '<section class="cl-detail-head card tone-' + api.esc(it.tone || 'sky') + '">' +
      '<p class="cl-kicker">' + api.esc(it.tag || '') + (it.date ? ' · ' + api.esc(it.date) : '') + '</p>' +
      '<div class="cl-ver sm">' + api.esc(it.ver || '') + '</div>' +
      '<h1>' + api.esc(it.emoji || '') + ' ' + api.esc(it.title || '') + '</h1>' +
      '<p>' + api.esc(it.summary || '') + '</p></section>' +
      '<p class="menu-group">상세 패널 · 눌러서 설명</p>' +
      '<div class="cl-panels" id="cl-panels">';
    (it.panels || []).forEach(function (p, i) {
      h += '<button class="cl-panel tone-' + api.esc(it.tone || 'sky') + '" type="button" data-pi="' + i + '" aria-expanded="false">' +
        '<span class="cl-panel-t">' + api.esc(p.t || '') + '</span>' +
        '<span class="cl-panel-d" hidden>' + api.esc(p.d || '') + '</span>' +
        '<span class="cl-panel-tip" role="tooltip">' + api.esc(p.d || '') + '</span>' +
        '</button>';
    });
    h += '</div>';
    var idx = d.items.indexOf(it);
    h += '<div class="cl-navrow">';
    if (idx > 0) h += '<button class="btn-ghost" type="button" id="cl-prev">← ' + api.esc(d.items[idx - 1].label || '이전') + '</button>';
    if (idx >= 0 && idx < d.items.length - 1) h += '<button class="btn-ghost" type="button" id="cl-next">' + api.esc(d.items[idx + 1].label || '다음') + ' →</button>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelector('#back').onclick = function () { api.go('#/study/changelog'); };
    var prev = el.querySelector('#cl-prev');
    var next = el.querySelector('#cl-next');
    if (prev) prev.onclick = function () { api.go('#/study/changelog/' + d.items[idx - 1].id); };
    if (next) next.onclick = function () { api.go('#/study/changelog/' + d.items[idx + 1].id); };
    el.querySelectorAll('.cl-panel').forEach(function (b) {
      function toggle() {
        var on = b.classList.toggle('open');
        b.setAttribute('aria-expanded', on ? 'true' : 'false');
        var dEl = b.querySelector('.cl-panel-d');
        if (dEl) dEl.hidden = !on;
      }
      b.addEventListener('click', toggle);
      b.addEventListener('mouseenter', function () { b.classList.add('hover'); });
      b.addEventListener('mouseleave', function () { b.classList.remove('hover'); });
    });
  }

  var mustCache = null;
  function loadMust() {
    if (!mustCache) {
      mustCache = fetch(new URL('data/필독_교육원규정.json', document.baseURI).href, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('must'); return r.json(); })
        .catch(function () { return null; });
    }
    return mustCache;
  }
  function mustView(el, api) {
    el.innerHTML = '<button class="linkish" id="back" type="button">← 공부</button><section class="card"><p class="muted">불러오는 중…</p></section>';
    el.querySelector('#back').onclick = function () { api.go('#/study'); };
    loadMust().then(function (d) {
      if (!d) {
        el.innerHTML = '<button class="linkish" id="back" type="button">← 공부</button><section class="card"><p>필독 자료를 못 불러왔어요.</p></section>';
        el.querySelector('#back').onclick = function () { api.go('#/study'); };
        return;
      }
      var h = '<button class="linkish" id="back" type="button">← 공부</button>' +
        '<section class="card"><p class="kicker">주무관 필독</p><h1>' + api.esc(d.title || '주무관 필독') + '</h1>' +
        '<p>' + api.esc(d.subtitle || '') + '</p>' +
        '<p class="muted">원문 요지 · ' + api.esc(d.source_note || '') + '</p></section>';
      (d.cards || []).forEach(function (c, i) {
        h += '<section class="card must-card"><p class="kicker">' + (i + 1) + '. ' + api.esc(c.k || '') + '</p>' +
          '<h2>' + api.esc(c.t || '') + '</h2><p>' + api.esc(c.d || '') + '</p></section>';
      });
      h += '<section class="card"><h2>원문 규정 카드</h2><p class="muted">앱 안 원문 보기(RegDocs)로 이어져요.</p>';
      (d.reg_links || []).forEach(function (r) {
        h += '<button class="list-btn" type="button" data-reg="' + api.esc(r.id) + '"><b>' + api.esc(r.label || r.id) + '</b></button>';
      });
      h += '<p class="muted" style="margin-top:10px">keep 원문: ' + api.esc(d.keep_path || '') + '</p></section>';
      el.innerHTML = h;
      el.querySelector('#back').onclick = function () { api.go('#/study'); };
      el.querySelectorAll('[data-reg]').forEach(function (b) {
        b.onclick = function () { api.go('#/study/rule/' + b.getAttribute('data-reg')); };
      });
    });
  }

  function regView(el, api, id) {
    var r = (api.pack().entities.regulations || []).filter(function (x) { return x.id === id; })[0];
    if (!r) { el.innerHTML = '<section class="card"><p>없는 규정이에요.</p></section>'; return; }
    el.innerHTML = '<button class="linkish" id="back" type="button">← 공부</button><section class="card"><h1>' + api.esc(r.name) + '</h1>' +
      '<p><b>꼭 알 조문</b><br>' + api.esc(r.articles || '확인 필요') + '</p>' +
      '<p><b>한 줄</b><br>' + api.esc(r.summary || '') + '</p>' +
      '<div data-source-slot><p><b>원문</b><br>' + api.esc(r.source || '확인 필요') + '</p></div>' +
      '<div data-regdocs-slot></div>' +
      '<p class="muted">익히는 시간(추정) ' + api.esc(r.minutes || '') + '</p></section>';
    el.querySelector('#back').onclick = function () { api.go('#/study'); };
    if (window.SourceLink) window.SourceLink.fill(el, 'regulations:' + r.id, r.source || '확인 필요', api.esc);
    if (window.RegDocs) window.RegDocs.fill(el, 'regulations:' + r.id, api.esc);
  }

  ShellModules.study = { id: 'study', tab: '공부', icon: icon, render: render };
})();

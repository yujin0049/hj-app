/* 인트라넷 메뉴 한 곳 (유진님 11.11. 「ㅇㅋ 해」「중요한건 인트라넷이라는거지」): 모든 화면을 왼쪽 메뉴 하나에서 열어요.
   데스크톱(1024px 이상) = 왼쪽 고정 메뉴, 폰 = 머리줄 「메뉴」 버튼으로 여닫는 서랍(아래 탭은 그대로).
   새 화면 없음: 줄마다 이미 있는 #/ 화면이나 공식 출석 주소로만 가요. 디자인: 브랜드 C Datum Line(#4CC3FF 선 · Hahmlet). */
(function (root) {
  'use strict';
  var ATTEND = 'https://hj-attend.yujin06344.workers.dev/';
  var MENU = [
    { group: '', items: [['#/home', '홈 · 현황판']] },
    { group: '업무', items: [['#/status', '지출·원인행위 건현황'], ['#/ot-attach', '원인행위 붙임'], ['#/board', '업무현황표'], ['#/work', '실무']] },
    { group: '출석', items: [[ATTEND, '출석부 (공식)', 'ext']] },
    { group: '문서', items: [['#/docs', '중요문서'], ['#/docsearch', '문서대장 찾기'], ['#/docreg', '문서등록대장 학습'], ['#/regular-docs', '정례 문서 달력']] },
    { group: '일정', items: [['#/calendar', '계획 달력'], ['#/schedule', '남은 일정'], ['#/todo', '내일 할 일']] },
    { group: '봇보고/현황판', items: [['#/bots', '봇 작업 현황'], ['#/charts', '그래프'], ['#/chat', '대장↔클로드 방']] },
    { group: '그 밖', items: [['#/students', '학생 안내'], ['#/study', '공부'], ['#/more', '더보기']] }
  ];
  root.HJIntranetMenu = MENU;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function html() {
    var h = '<div class="in-brand"><span class="in-kicker">DATUM · 인트라넷</span><b>행정 업무 연습장</b></div>';
    MENU.forEach(function (g) {
      h += '<div class="in-group">' + (g.group ? '<p class="in-gh">' + esc(g.group) + '</p>' : '');
      g.items.forEach(function (it) {
        var ext = it[2] === 'ext';
        h += '<a class="in-link" href="' + esc(it[0]) + '"' + (ext ? ' target="_blank" rel="noopener" data-ext="1"' : ' data-route="' + esc(it[0].slice(2).split('/')[0]) + '"') + '>' +
          esc(it[1]) + (ext ? ' <span aria-hidden="true">↗</span>' : '') + '</a>';
      });
      h += '</div>';
    });
    return h;
  }
  function current() {
    var h = (location.hash || '#/home').replace(/^#\/?/, '').split(/[/?]/)[0] || 'home';
    if (h === 'tomorrow') h = 'todo';
    if (h === 'practice') h = 'study';
    return h;
  }
  function mark() {
    var cur = current();
    document.querySelectorAll('#side .in-link[data-route]').forEach(function (a) {
      var on = a.getAttribute('data-route') === cur;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function setOpen(open) {
    document.documentElement.classList.toggle('in-open', !!open);
    var b = document.getElementById('in-toggle');
    if (b) b.setAttribute('aria-expanded', String(!!open));
  }
  function font() { /* 문서대장 찾기와 같은 글꼴 링크(id ds-font) 하나만, 그리기 막지 않음(display=swap) */
    if (document.getElementById('ds-font')) return;
    var l = document.createElement('link');
    l.id = 'ds-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@400;600;700&display=swap';
    document.head.appendChild(l);
  }
  function build() {
    font();
    var shell = document.getElementById('shell');
    if (!shell || document.getElementById('side')) return;
    var side = document.createElement('nav');
    side.id = 'side';
    side.className = 'in-side';
    side.setAttribute('aria-label', '인트라넷 메뉴');
    side.innerHTML = html();
    shell.insertBefore(side, shell.firstChild);
    var dim = document.createElement('div');
    dim.className = 'in-dim';
    dim.onclick = function () { setOpen(false); };
    shell.appendChild(dim);
    var top = shell.querySelector('.top');
    if (top) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'in-toggle'; b.className = 'in-toggle';
      b.setAttribute('aria-controls', 'side'); b.setAttribute('aria-expanded', 'false');
      b.innerHTML = '<span aria-hidden="true">☰</span> 메뉴';
      b.onclick = function () { setOpen(!document.documentElement.classList.contains('in-open')); };
      top.insertBefore(b, top.firstChild);
    }
    side.addEventListener('click', function (e) { if (e.target.closest('.in-link')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    root.addEventListener('hashchange', mark);
    mark();
  }
  if (document.readyState !== 'loading') build(); else document.addEventListener('DOMContentLoaded', build);
})(window);

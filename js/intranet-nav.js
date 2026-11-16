/* 인트라넷 메뉴 한 곳: js/registry.js 의 HJMenu 만 본다.
   데스크톱(1024px 이상) = 왼쪽 고정 메뉴, 폰 = 머리줄 「메뉴」 버튼으로 여닫는 서랍(아래 탭은 그대로).
   디자인: 브랜드 C Datum Line(#4CC3FF 선 · Hahmlet). */
(function (root) {
  'use strict';
  var LOCKS = ['로그인', '결제', '영구삭제', '외부발송', '상신'];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function groups() {
    return (root.HJNav && root.HJNav.sideGroups) ? root.HJNav.sideGroups() : [];
  }
  function html() {
    var h = '<div class="in-brand"><span class="in-kicker">DATUM · 인트라넷</span><b>행정 업무 연습장</b></div>';
    groups().forEach(function (g) {
      h += '<div class="in-group">' + (g.group ? '<p class="in-gh">' + esc(g.group) + '</p>' : '');
      g.items.forEach(function (it) {
        var ext = !!it.ext;
        h += '<a class="in-link" href="' + esc(it.href) + '"' + (ext ? ' target="_blank" rel="noopener" data-ext="1"' : ' data-route="' + esc(it.id) + '"') + '>' +
          esc(it.name) + (ext ? ' <span aria-hidden="true">↗</span>' : '') + '</a>';
      });
      h += '</div>';
    });
    h += '<p class="in-lock" id="in-lock"><span aria-hidden="true">🔒</span> 유보 · 사람 손<br><small>' + LOCKS.map(esc).join(' · ') + '</small></p>';
    return h;
  }
  function current() {
    var h = (location.hash || '#/home').replace(/^#\/?/, '').split(/[/?]/)[0] || 'home';
    if (h === 'tomorrow') h = 'todo';
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
  function font() {
    if (document.getElementById('ds-font')) return;
    var l = document.createElement('link');
    l.id = 'ds-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@400;600;700&display=swap';
    document.head.appendChild(l);
  }
  function build() {
    var later = function () { (root.requestIdleCallback || function (f) { setTimeout(f, 200); })(font); };
    if (document.readyState === 'complete') later(); else root.addEventListener('load', later);
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

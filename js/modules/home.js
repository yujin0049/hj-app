(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5z"/></svg>';
  var NODATA = '데이터 없음';

  function ymdKST() {
    if (window.HJFresh) return window.HJFresh.todayKST();
    var d = new Date(Date.now() + 9 * 3600000);
    function pad(n) { return String(n).padStart(2, '0'); }
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function getJson(path) {
    return fetch(new URL(path, document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(path); return r.json(); });
  }

  function staleHtml(meta, esc) {
    if (!window.HJCal || !window.HJCal.staleness) return '';
    var st = window.HJCal.staleness(meta);
    if (!st || !st.warn) return '';
    return '<p class="cl-stale" id="home-stale">⚠ 자료가 최신이 아닐 수 있어요 — ' + esc(st.why) + '</p>';
  }

  function statusLine(status, esc) {
    var F = window.HJFresh;
    if (!F) return '<p class="fresh-line fresh-none" id="fresh-line">' + esc(NODATA) + '</p>';
    return F.lineHtml(status, null, esc);
  }

  function paint(el, api, src) {
    var esc = api.esc;
    var today = ymdKST();
    var status = src.status;
    var meta = src.meta;
    var tasks = (status && status.tasks) || [];
    var Core = window.HJHomeCore;
    var items = Core ? Core.todayItems(tasks, today, 3) : [];
    var overdue = Core ? Core.overdueCount(tasks, today) : 0;
    var loaded = !!status;
    var d = today.split('-');
    var dayLabel = d.length === 3 ? (Number(d[0]) + '년 ' + Number(d[1]) + '월 ' + Number(d[2]) + '일') : today;

    var h = '<section class="hero home-today"><p class="kicker">' + esc(dayLabel) + '</p>';
    h += '<h1 class="hero-title">오늘 할 일</h1></section>';
    h += staleHtml(meta, esc);
    h += statusLine(status, esc);
    h += '<section class="card home-today-card" id="home-today">';
    if (!loaded) {
      h += '<p class="muted">' + esc(NODATA) + '</p>';
    } else if (!items.length) {
      h += '<p class="muted">오늘 남은 할 일이 없어요.</p>';
    } else {
      items.forEach(function (it, i) {
        h += '<button class="list-btn" type="button" data-go="' + esc(it.href) + '">' +
          '<span class="td-num">' + (i + 1) + '</span> <b>' + esc(it.title || NODATA) + '</b>' +
          '<div class="item-meta">' + esc(it.status || '할 일') + '</div></button>';
      });
    }
    if (loaded && overdue) {
      h += '<p class="muted home-overdue">지난 마감 ' + overdue + '건은 <button class="linkish" type="button" data-go="#/status">지출·원인행위 건현황</button>에서 보세요.</p>';
    }
    h += '<button class="btn-ghost small" type="button" data-go="#/todo" id="home-todo">할 일 전체</button>';
    h += '</section>';
    el.innerHTML = h;
    el.classList.add('wide');
    el.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { api.go(b.getAttribute('data-go')); };
    });
  }

  function render(el, api) {
    if (!api.unlocked()) return renderPublic(el, api);
    el.innerHTML = '<section class="card sk" aria-busy="true"><p class="muted">불러오는 중…</p><i></i><i></i><i></i></section>';
    Promise.all([
      getJson('data/status.json').catch(function () { return null; }),
      getJson('data/meta.json').catch(function () { return null; })
    ]).then(function (a) {
      paint(el, api, { status: a[0], meta: a[1] });
    });
  }

  function renderPublic(el, api) {
    var h = '<section class="hero home-today"><p class="kicker">행정 업무 연습장</p><h1 class="hero-title">오늘 할 일</h1></section>';
    h += '<p class="fresh-line fresh-none" id="fresh-line">' + api.esc(NODATA) + '</p>';
    h += '<section class="card"><p>자료를 불러오지 못했어요. 새로고침해 주세요. 학생 안내는 바로 볼 수 있어요.</p>' +
      '<div class="row"><button class="btn" id="go-stu" type="button">학생 안내</button></div></section>';
    el.innerHTML = h;
    el.querySelector('#go-stu').onclick = function () { api.go('#/students'); };
  }

  ShellModules.home = { id: 'home', tab: '홈', icon: icon, render: render };
})();

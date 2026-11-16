/* 신입 업무 가이드 (#/office-guide) — 261116 춘식이 배분(유진님 11.9 「출석앱 끝나면 이거 해」, 대장 착수 OK).
   참고 사이트(구조·기능만): docs/dreamy/ref_analysis.md. 10쪽 안내 + 목차 + 인쇄 + 주소 복사 + 첫 출근 체크(이 기기만).
   브랜드 C Datum Line(#4CC3FF · Hahmlet). 실명·실제 연락처 없음. 본문이 비면 「데이터 없음」. */
(function (root) {
  'use strict';
  var CSS = [
    '.og{--sky:#4CC3FF;--sky-dim:rgba(76,195,255,.34);--sky-faint:rgba(76,195,255,.10);--ink:#EAF6FF;--mute:#8FA9BA;--bg:#05121A;--card:#071821;',
    'color:var(--ink);background:var(--bg);font-family:Hahmlet,Pretendard,"Apple SD Gothic Neo",serif;border-radius:20px;padding:0 0 36px;margin:0 auto;box-sizing:border-box;max-width:1180px;overflow-wrap:anywhere}',
    '.og-hero{text-align:center;padding:28px 18px 20px;border-bottom:1px solid var(--sky-dim);background:linear-gradient(180deg,rgba(76,195,255,.10),transparent)}',
    '.og-hero small{display:block;color:var(--sky);font-weight:700;letter-spacing:.14em;font-size:12.8px}',
    '.og-hero h1{font-family:Hahmlet,serif;font-weight:700;font-size:clamp(26px,5vw,42px);line-height:1.25;margin:10px 0 8px;color:#fff}',
    '.og-hero p{margin:0 auto;max-width:36em;color:var(--mute);font-size:15px;line-height:1.6}',
    '.og-tools{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px}',
    '.og-tools button{min-height:44px;border:0;border-radius:999px;background:var(--sky);color:#000;padding:10px 18px;font:700 14px Hahmlet,serif;cursor:pointer}',
    '.og-tools button.og-ghost{background:transparent;color:var(--sky);border:1px solid var(--sky-dim)}',
    '.og-wrap{display:grid;grid-template-columns:220px minmax(0,1fr);gap:20px;padding:20px 16px 0}',
    '.og-nav{position:sticky;top:12px;align-self:start;background:var(--card);border:1px solid var(--sky-dim);border-radius:16px;padding:14px}',
    '.og-nav strong{display:block;margin:0 0 10px;color:var(--sky);font-size:13px}',
    '.og-nav a{display:block;color:var(--ink);text-decoration:none;padding:8px 8px;border-radius:8px;font-size:13px;min-height:36px;box-sizing:border-box}',
    '.og-nav a:hover,.og-nav a.on{background:var(--sky-faint);color:#fff}',
    '.og-page{background:var(--card);border:1px solid var(--sky-dim);border-radius:16px;padding:22px 24px;margin:0 0 16px}',
    '.og-lab{font-size:12.8px;font-weight:700;letter-spacing:.14em;color:var(--sky)}',
    '.og-page h2{font-family:Hahmlet,serif;font-size:22px;color:#fff;margin:18px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--sky)}',
    '.og-page h3{font-family:Hahmlet,serif;font-size:17px;margin:22px 0 8px;color:#fff}',
    '.og-page p,.og-page li{margin:6px 0;font-size:15px;line-height:1.75;color:var(--ink)}',
    '.og-page ul,.og-page ol{margin:6px 0;padding-left:1.2em}',
    '.og-tbl{width:100%;border-collapse:collapse;margin:10px 0;font-size:15px}',
    '.og-tbl th,.og-tbl td{border-bottom:1px solid var(--sky-dim);text-align:left;padding:8px 6px;vertical-align:top}',
    '.og-tbl th{color:var(--sky);font-weight:700}',
    '.og-tpl{margin:8px 0;padding:12px 14px;border-left:3px solid var(--sky);background:var(--sky-faint);border-radius:0 10px 10px 0;white-space:pre-wrap;font-size:14px;line-height:1.7;color:var(--ink)}',
    '.og-note{font-size:13px;color:var(--mute);margin:8px 0}',
    '.og-empty{text-align:center;padding:28px 12px;color:var(--mute);border:1px solid var(--sky-dim);border-radius:16px;background:var(--card)}',
    '.og-check{list-style:none;margin:8px 0;padding:0}',
    '.og-check li{margin:0 0 6px}',
    '.og-check label{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:var(--sky-faint);border-radius:10px;cursor:pointer;font-size:15px;min-height:44px;box-sizing:border-box}',
    '.og-check input{accent-color:#4CC3FF;width:18px;height:18px;margin-top:3px;flex:0 0 auto}',
    '.og-foot{text-align:center;color:var(--mute);font-size:13px;padding:8px 16px 0}',
    '@media(max-width:760px){.og-wrap{display:block;padding:14px 12px 0}.og-nav{position:static;margin-bottom:14px}.og-nav a{display:inline-block;font-size:12.8px;min-height:32px}.og-page{padding:18px 14px}.og-page h2{font-size:20px}.og-hero{padding:22px 14px 16px}}',
    '@media print{' +
    '#hj-stamp,.og-nav,.og-tools,.tabs,.in-side,.in-dim,.in-toggle,.top,.og-foot,.toast{display:none !important}' +
    'html,body,#shell,#view{background:#fff !important;color:#111 !important}' +
    '.og,.og *{color:#111 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.og,.og-hero,.og-page,.og-wrap,.og-check label{background:#fff !important;box-shadow:none !important}' +
    '.og{border-radius:0}.og-wrap{display:block}.og-hero{background:none !important;border:0}' +
    '.og-page{border:1px solid #ccc;break-inside:auto;page-break-inside:auto}' +
    '.og-hero h1,.og-page h2,.og-page h3,.og-lab{color:#000 !important;break-after:avoid;page-break-after:avoid;break-inside:avoid}' +
    '.og-keep{break-inside:avoid;page-break-inside:avoid}' +
    '.og-tpl{background:#f4f4f4 !important;color:#111 !important;break-inside:avoid;page-break-inside:avoid}' +
    '.og-tbl,table,.og-check{break-inside:avoid;page-break-inside:avoid}' +
    '}'
  ].join('');

  function style() {
    if (document.getElementById('og-style')) return;
    var s = document.createElement('style');
    s.id = 'og-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function font() {
    if (document.getElementById('ds-font') || document.getElementById('og-font')) return;
    var l = document.createElement('link');
    l.id = 'og-font';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@400;600;700&display=swap';
    document.head.appendChild(l);
  }
  function core() {
    if (root.HJOfficeGuide) return Promise.resolve(root.HJOfficeGuide);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = new URL('js/office-guide-core.js?v=2', document.baseURI).href;
      s.onload = function () { res(root.HJOfficeGuide); };
      s.onerror = function () { rej(new Error('js/office-guide-core.js')); };
      document.body.appendChild(s);
    });
  }
  function loadState(G) {
    try {
      return G.readChecks(root.localStorage ? localStorage.getItem(G.STORE) : '');
    } catch (e) {
      return G.readChecks({});
    }
  }
  function saveState(G, st) {
    try {
      if (root.localStorage) localStorage.setItem(G.STORE, G.writeChecks(st));
    } catch (e) { /* 사파리 사설 등: 화면만 유지 */ }
  }
  function blockHtml(esc, b) {
    var i, h, n;
    if (b.t === 'h2') return '<h2>' + esc(b.text) + '</h2>';
    if (b.t === 'h3') return '<h3>' + esc(b.text) + '</h3>';
    if (b.t === 'p') return '<p>' + esc(b.text) + '</p>';
    if (b.t === 'note') return '<p class="og-note">※ ' + esc(b.text) + '</p>';
    if (b.t === 'ul') {
      return '<ul>' + (b.items || []).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>';
    }
    if (b.t === 'ol') {
      n = b.start ? ' start="' + Number(b.start) + '"' : '';
      return '<ol' + n + '>' + (b.items || []).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ol>';
    }
    if (b.t === 'table') {
      h = '<div class="scroll"><table class="og-tbl"><thead><tr>' + (b.head || []).map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      (b.rows || []).forEach(function (r) {
        h += '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      });
      return h + '</tbody></table></div>';
    }
    if (b.t === 'tpl') {
      return '<pre class="og-tpl">' + (b.lines || []).map(function (ln) { return esc(ln); }).join('\n') + '</pre>';
    }
    if (b.t === 'checks') return '';
    return '';
  }
  function checksHtml(esc, G, st, b) {
    var all = G.checklist();
    var items = (G.checklistSlice ? G.checklistSlice(b && b.from, b && b.to) : all);
    if (!items.length) return '<p class="og-empty">' + esc(G.NODATA) + '</p>';
    var n = G.checkedCount(st);
    var h = '<p class="og-note">이 기기에서만 기억해요. ' + n + ' / ' + all.length + '</p><ul class="og-check">';
    items.forEach(function (it) {
      h += '<li><label><input type="checkbox" data-og-check="' + esc(it.id) + '"' + (st[it.id] ? ' checked' : '') + '> ' + esc(it.text) + '</label></li>';
    });
    return h + '</ul>';
  }
  function renderBlocks(esc, G, st, blocks) {
    var h = '', i = 0, b, n;
    blocks = blocks || [];
    while (i < blocks.length) {
      b = blocks[i];
      n = blocks[i + 1];
      if ((b.t === 'h2' || b.t === 'h3') && n && n.t === 'checks') {
        h += '<div class="og-keep">' + blockHtml(esc, b) + checksHtml(esc, G, st, n) + '</div>';
        i += 2;
      } else if (b.t === 'checks') {
        h += checksHtml(esc, G, st, b);
        i += 1;
      } else {
        h += blockHtml(esc, b);
        i += 1;
      }
    }
    return h;
  }
  function paint(el, api, G) {
    var esc = api.esc;
    var list = G.pages();
    var empty = G.emptyText(list);
    var cur = G.pageFromRoute(api.route().parts);
    var st = loadState(G);
    var h = '<div class="og" id="og"><header class="og-hero"><small>OFFICE STARTER GUIDE</small><h1>신입사원 필수 업무 가이드</h1>' +
      '<p>첫 사무직 입사 전에 알아두면 좋은 회사생활 기초 모음집</p>' +
      '<div class="og-tools"><button type="button" id="og-print">인쇄 / PDF 저장</button>' +
      '<button type="button" class="og-ghost" id="og-copy">현재 페이지 주소 복사</button></div></header>';
    if (empty) {
      el.innerHTML = h + '<div class="og-wrap"><p class="og-empty">' + esc(G.NODATA) + '</p></div></div>';
    } else {
      h += '<div class="og-wrap"><nav class="og-nav" aria-label="가이드 목차"><strong>목차 · ' + list.length + '페이지</strong>';
      G.navItems().forEach(function (n) {
        h += '<a href="' + esc(G.href(n.id)) + '"' + (cur === n.id ? ' class="on" aria-current="location"' : '') + '>' + esc(n.label) + '</a>';
      });
      h += '</nav><main>';
      list.forEach(function (p) {
        var blocks = p.blocks || [];
        var lab = '<div class="og-lab">PAGE ' + String(p.no).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0') + '</div>';
        h += '<section class="og-page" id="og-' + esc(p.id) + '">';
        if (blocks[0] && blocks[0].t === 'checks') {
          h += '<div class="og-keep">' + lab + checksHtml(esc, G, st, blocks[0]) + '</div>' + renderBlocks(esc, G, st, blocks.slice(1));
        } else {
          h += lab + renderBlocks(esc, G, st, blocks);
        }
        h += '</section>';
      });
      h += '</main></div><p class="og-foot">신입사원 필수 업무 가이드 · 회사마다 규정이 다를 수 있어요</p></div>';
      el.innerHTML = h;
    }
    var pr = el.querySelector('#og-print');
    if (pr) pr.onclick = function () { root.print(); };
    var cp = el.querySelector('#og-copy');
    if (cp) cp.onclick = function () {
      var url = String(location.href || '');
      var done = function (ok) {
        if (api.toast) api.toast(ok ? '주소를 복사했어요.' : '주소창에서 링크를 복사해 주세요.');
        else root.alert(ok ? '주소를 복사했어요' : '주소창에서 링크를 복사해 주세요');
      };
      if (root.navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      } else done(false);
    };
    el.querySelectorAll('[data-og-check]').forEach(function (inp) {
      inp.onchange = function () {
        var next = G.toggleCheck(loadState(G), inp.getAttribute('data-og-check'));
        saveState(G, next);
        var lab = inp.closest('.og-page');
        if (!lab) return;
        var hold = lab.id;
        /* 체크만 다시 그림: 스크롤 유지 */
        var y = root.scrollY;
        paint(el, api, G);
        if (hold) {
          var t = document.getElementById(hold);
          if (t) t.scrollIntoView({ block: 'nearest' });
          else root.scrollTo(0, y);
        }
      };
    });
    if (cur) {
      var target = document.getElementById('og-' + cur);
      if (target && target.scrollIntoView) target.scrollIntoView({ block: 'start' });
    }
  }
  function render(el, api) {
    style();
    font();
    el.classList.add('wide');
    el.innerHTML = '<section class="card sk" aria-busy="true"><p class="muted">불러오는 중…</p><i></i><i></i><i></i></section>';
    core().then(function (G) {
      if (!G) throw new Error('guide');
      paint(el, api, G);
    }).catch(function () {
      el.innerHTML = '<section class="card"><h2>신입사원 필수 업무 가이드</h2><p>' + (root.HJOfficeGuide && root.HJOfficeGuide.NODATA ? root.HJOfficeGuide.NODATA : '데이터 없음') + '</p></section>';
    });
  }
  if (root.ShellModules) root.ShellModules['office-guide'] = { id: 'office-guide', tab: '신입 가이드', icon: '', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

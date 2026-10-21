/* 파일 찾기 (유진님 10.21. 08:51 「파일 알아서 찾는게 넘힘들어」「연습장에도 그런 링크」)
   ① 낱말 → 옵시디언 검색 열기 / 앱 안 검색 / PC 파일색인 명령 복사(find_file.py)
   ② 업무 낱말판 ③ 다운로드 정리 3단계(download_sort.py 명령 복사) ④ 이름 짓기 규칙
   실제 파일 목록·F: 경로·이름은 저장소에 없어요. 결과는 유진님 PC·옵시디언에서만 보여요. */
(function (root) {
  'use strict';
  var F = root.HJFileFind;
  var CSS = '.ff-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.ff-row input{flex:1;min-width:160px}' +
    '.ff-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}' +
    '.ff-cmd{font-family:monospace;font-size:13px;background:var(--soft);border-radius:8px;padding:6px 8px;word-break:break-all}';
  function style() {
    if (document.getElementById('ff-style')) return;
    var s = document.createElement('style'); s.id = 'ff-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function copy(api, text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { api.toast('복사했어요: ' + text); }, function () { api.toast(text); });
    } else api.toast(text);
  }
  function cfg() {
    return fetch(new URL('data/config.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
  }
  function paint(el, api, c) {
    var esc = api.esc, vault = c.obsidianVault || '';
    var h = '<button class="linkish" id="back" type="button">← 더보기</button>' +
      '<section class="card"><p class="kicker">파일 찾기</p><h1>무엇을 찾을까요?</h1>' +
      '<p class="muted">낱말을 적고 버튼을 누르세요. 옵시디언은 이 기기에서 열려요. PC 파일은 명령을 복사해 업무 PC에서 붙여 넣어요.</p>' +
      '<div class="ff-row"><input id="ff-q" type="search" placeholder="예: 특강 견적, 기숙사 신청서"></div>' +
      '<div class="ff-row">' +
      (vault ? '<button class="btn" id="ff-obs" type="button">옵시디언에서 찾기</button>' : '') +
      '<button class="btn-ghost" id="ff-app" type="button">앱 안에서 찾기</button>' +
      '<button class="btn-ghost" id="ff-pc" type="button">PC 파일 찾기 명령 복사</button></div>' +
      '<p class="muted">PC 명령은 옵시디언 볼트의 「99 봇/스크립트」 폴더에서 실행해요. 최신판부터, 같은 내용 사본은 묶어서 보여 줘요.</p></section>';
    h += '<section class="card"><h2>업무별로 찾기</h2><div class="ff-grid">';
    F.TOPICS.forEach(function (t, i) {
      h += '<button class="list-btn" type="button" data-topic="' + i + '"><b>' + esc(t.name) + '</b><div class="item-meta">' + esc(t.words.join(' · ')) + '</div></button>';
    });
    h += '</div></section>';
    h += '<section class="card"><h2>내려받은 파일 정리</h2>' +
      '<p class="muted">새로 받은 파일(D:\\ 맨 위, 카카오톡 받은 파일)을 이름 낱말로 보고 넣을 폴더를 제안해요. 지우지 않고, 덮어쓰지 않아요. 못 고른 파일은 그대로 둬요. 개인정보 서류는 자동으로 옮기지 않아요.</p>';
    F.SORT_CMDS.forEach(function (s, i) {
      h += '<p><b>' + esc(s.step) + '</b></p><div class="ff-row"><span class="ff-cmd" style="flex:1">' + esc(s.cmd) + '</span>' +
        '<button class="btn-ghost" type="button" data-cmd="' + i + '">복사</button></div>';
    });
    h += '<p class="muted">규칙 파일: 볼트 「99 봇/스크립트/download_sort_rules.json」. 폴더가 바뀌면 춘식이에게 말해 주세요.</p></section>';
    h += '<section class="card"><h2>다음에 찾기 쉽게 이름 짓기</h2><ul>' +
      '<li><b>YYMMDD_내용_v01</b> (예: 261021_특강재료견적_v01.pdf)</li>' +
      '<li>업무 낱말(특강·강사료·기숙사·견적…)을 이름에 꼭 넣기 → 자동 정리가 맞춰요</li>' +
      '<li>문서번호가 있으면 이름에 같이(예: 항공정비과-1827)</li></ul>' +
      '<p class="muted">왜: 파일 이름이 곧 검색어예요. 이름만 잘 지어도 찾기·정리가 절반은 끝나요.</p></section>';
    el.innerHTML = h;
    var qEl = el.querySelector('#ff-q');
    function q() { return F.clean(qEl.value); }
    function need() { if (!q()) { api.toast('찾을 낱말을 적어 주세요.'); return false; } return true; }
    el.querySelector('#back').onclick = function () { api.go('#/more'); };
    var obs = el.querySelector('#ff-obs');
    if (obs) obs.onclick = function () { if (need()) location.href = F.obsidianSearchUrl(vault, q()); };
    el.querySelector('#ff-app').onclick = function () { if (need()) api.go('#/search/' + encodeURIComponent(q())); };
    el.querySelector('#ff-pc').onclick = function () { if (need()) copy(api, F.findCmd(q())); };
    el.querySelectorAll('[data-topic]').forEach(function (b) {
      b.onclick = function () { qEl.value = F.TOPICS[+b.getAttribute('data-topic')].q; qEl.focus(); };
    });
    el.querySelectorAll('[data-cmd]').forEach(function (b) {
      b.onclick = function () { copy(api, F.SORT_CMDS[+b.getAttribute('data-cmd')].cmd); };
    });
  }
  function render(el, api) {
    style();
    var tb = document.querySelector('.tabs [data-tab="more"]');
    if (tb) tb.classList.add('on');
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    cfg().then(function (c) { paint(el, api, c || {}); });
  }
  if (root.ShellModules) root.ShellModules.filefind = { id: 'filefind', tab: '', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

/* 학과·사람별 업무 (#/who): 문서등록대장 3개(2026.3.~10.) 분석으로 「누가 무슨 일을 하나」를 카드와 문제로 익혀요.
   출처: 유진님 10.22. 00:54 요청(대장 전달). 공개 사이트라 교직원 실명은 넣지 않고 역할 표기만 써요(대응표는 볼트에만).
   직위를 결재 패턴으로 짐작한 것은 「추측」 표시를 하고 문제 정답으로 쓰지 않아요.
   화면: #/who(카드) · #/who/quiz?cat= */
(function (root) {
  'use strict';
  var data = null, sess = null;
  var CSS = [
    '.wh-head{padding:4px 2px 0}.wh-head h1{margin:0 0 2px}.wh-head p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45}',
    '.wh-card{background:var(--card);border-radius:20px;padding:16px;margin:12px 0}.wh-card h2{font-size:1.02rem;margin:0 0 6px}',
    '.wh-m{font-size:.8rem;color:var(--muted);line-height:1.5;margin:4px 0}.wh-p{padding:12px 0;border-top:1px solid var(--line)}.wh-p:first-of-type{border-top:0}',
    '.wh-p b{font-size:.95rem}.wh-g{font-size:.68rem;font-weight:700;color:var(--warn);background:var(--warnbg);border-radius:6px;padding:1px 6px;margin-left:6px}',
    '.wh-chips{display:flex;flex-wrap:wrap;gap:6px}.wh-chips button{border:0;border-radius:999px;padding:8px 12px;background:var(--soft);color:var(--ink-2);font-size:.84rem;font-weight:600;cursor:pointer}',
    '.wh-go{width:100%;border:0;border-radius:14px;padding:14px;background:var(--navy);color:#fff;font-weight:700;font-size:.98rem;cursor:pointer;margin-top:10px}',
    '.wh-ch{display:block;width:100%;border:0;border-radius:14px;background:var(--soft);padding:14px;margin:0 0 8px;text-align:left;font-size:.95rem;line-height:1.4;color:var(--ink);cursor:pointer}',
    '.wh-ch.ok{background:var(--okbg);color:#037A4B;font-weight:700}.wh-ch.no{background:var(--nobg);color:var(--no)}',
    '.wh-ans{border-radius:14px;padding:12px 14px;margin:6px 0 10px;font-size:.88rem;line-height:1.5}.wh-ans.ok{background:var(--okbg)}.wh-ans.no{background:var(--nobg)}.wh-ans b{display:block}',
    '.wh-q h2{font-size:1.08rem;line-height:1.45;margin:8px 0 14px}'
  ].join('\n');
  function style() { if (document.getElementById('wh-style')) return; var s = document.createElement('style'); s.id = 'wh-style'; s.textContent = CSS; document.head.appendChild(s); }
  function load() {
    if (data) return Promise.resolve(data);
    return fetch(new URL('data/who.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('who'); return r.json(); })
      .then(function (j) { data = j; return j; }).catch(function () { return null; });
  }
  function catName(id) { var c = (data.cats || []).filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; }
  function home(el, api) {
    var esc = api.esc;
    var dep = data.depts.map(function (d) {
      return '<section class="wh-card" data-dept="' + esc(d.id) + '"><h2>' + esc(d.name) + ' <small class="wh-m">문서 ' + d.n.toLocaleString('ko-KR') + '건 · 받은 공문 ' + d.recv.toLocaleString('ko-KR') + ' · 직접 ' + d.own.toLocaleString('ko-KR') + '</small></h2>' +
        '<p class="wh-m">많은 일: ' + esc(d.top.join(' · ')) + ' · 바쁜 달 ' + esc(d.busy) + '</p><p style="margin:6px 0 0;font-size:.9rem;line-height:1.5">' + esc(d.line) + '</p><p class="wh-m">결재: ' + esc(d.who) + '</p></section>';
    }).join('');
    var ppl = data.people.map(function (p) {
      return '<div class="wh-p"><b>' + esc(p.label) + '</b>' + (p.guess ? '<span class="wh-g">추측</span>' : '') +
        '<p class="wh-m">' + esc(p.dept) + (p.n ? ' · 대장 ' + p.n.toLocaleString('ko-KR') + '건' : '') + ' — ' + esc(p.role) + '</p>' +
        (p.top3.length ? '<p class="wh-m">맡는 일 Top3: ' + esc(p.top3.join(' · ')) + '</p>' : '') +
        (p.refs.length ? '<p class="wh-m">대표 문서: ' + esc(p.refs.join(', ')) + '</p>' : '') +
        '<p class="wh-m">이럴 때 물어라: ' + esc(p.ask) + '</p></div>';
    }).join('');
    var chips = '<button type="button" data-cat="">전체 ' + data.questions.length + '</button>' + data.cats.map(function (c) {
      var n = data.questions.filter(function (q) { return q.cat === c.id; }).length;
      return '<button type="button" data-cat="' + esc(c.id) + '">' + esc(c.name) + ' ' + n + '</button>';
    }).join('');
    el.innerHTML = '<div class="wh-head"><h1>학과·사람별 업무</h1><p>문서등록대장 3개(2026.3.~10.)로 본 「누가 무슨 일을 하나」예요. 이름 대신 역할로 적었어요.</p></div>' +
      '<section class="wh-card" id="wh-quiz-pick"><h2>문제 풀기</h2><p class="wh-m">유진님 업무와 겹치는 행정지원과 지출 흐름·국토부 심사부터 나와요.</p><div class="wh-chips">' + chips + '</div></section>' +
      dep + '<section class="wh-card" id="wh-people"><h2>사람별 카드 <small class="wh-m">' + data.people.length + '명 · 추측 ' + data.guess_n + '</small></h2>' + ppl + '</section>' +
      '<p class="wh-m" style="padding:0 4px 20px">왜: 누구한테 물어야 하는지 알면 일이 빨라져요. 「추측」은 결재 패턴으로 짐작한 거라 확인 전까지 정답으로 쓰지 않아요.</p>';
    el.querySelectorAll('[data-cat]').forEach(function (b) { b.onclick = function () { sess = null; api.go('#/who/quiz' + (b.getAttribute('data-cat') ? '?cat=' + b.getAttribute('data-cat') : '')); }; });
  }
  function quiz(el, api, route) {
    var esc = api.esc, m = /cat=([a-z]+)/.exec(route.query || ''), cat = m ? m[1] : '';
    if (!sess || sess.cat !== cat) sess = { cat: cat, list: data.questions.filter(function (q) { return !cat || q.cat === cat; }), i: 0, picked: null, ok: 0 };
    if (sess.i >= sess.list.length) {
      el.innerHTML = '<section class="wh-card"><h2>다 풀었어요 · ' + sess.ok + ' / ' + sess.list.length + '</h2><button class="wh-go" type="button" id="wh-back">처음으로</button></section>';
      el.querySelector('#wh-back').onclick = function () { sess = null; api.go('#/who'); }; return;
    }
    var q = sess.list[sess.i], pk = sess.picked;
    var ch = q.choices.map(function (c, i) {
      var cls = pk === null ? '' : (i === q.answer ? 'ok' : (i === pk ? 'no' : ''));
      return '<button class="wh-ch ' + cls + '" type="button" data-ch="' + i + '"' + (pk !== null ? ' disabled' : '') + '>' + esc(c) + '</button>';
    }).join('');
    var ans = pk === null ? '' : '<div class="wh-ans ' + (pk === q.answer ? 'ok' : 'no') + '"><b>' + (pk === q.answer ? '정답이에요' : '아쉬워요. 정답: ' + esc(q.choices[q.answer])) + '</b>왜: ' + esc(q.why) +
      '<p class="wh-m">근거 문서: ' + esc(q.ref.length ? q.ref.join(', ') : '문서등록대장 분석 v01 집계') + '</p></div><button class="wh-go" type="button" id="wh-next">' + (sess.i + 1 < sess.list.length ? '다음 문제' : '결과 보기') + '</button>';
    el.innerHTML = '<div class="wh-head"><p><a href="#/who">‹ 그만 풀기</a></p></div><section class="wh-card wh-q" id="wh-quiz"><p class="wh-m">' + esc(catName(q.cat)) + ' · ' + (sess.i + 1) + ' / ' + sess.list.length + '</p><h2>' + esc(q.q) + '</h2>' + ch + ans + '</section>';
    el.querySelectorAll('[data-ch]').forEach(function (b) { b.onclick = function () { if (sess.picked !== null) return; sess.picked = +b.getAttribute('data-ch'); if (sess.picked === q.answer) sess.ok++; quiz(el, api, route); }; });
    var nx = el.querySelector('#wh-next');
    if (nx) nx.onclick = function () { sess.i++; sess.picked = null; quiz(el, api, route); window.scrollTo(0, 0); };
  }
  function render(el, api) {
    style();
    var route = api.route();
    function go() { return (route.parts[1] === 'quiz') ? quiz(el, api, route) : home(el, api); }
    if (data) return go();
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    load().then(function (d) { if (!d) { el.innerHTML = '<section class="card"><p>⚠ 자료(data/who.json)를 못 불러왔어요. 새로고침해 주세요.</p></section>'; return; } go(); });
  }
  if (root.ShellModules) root.ShellModules.who = { id: 'who', tab: '사람별', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

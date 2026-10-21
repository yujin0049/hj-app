/* 문서등록대장 학습 (#/docreg): 항공정비과 문서등록대장(2026.3.~10.)을 분류별 객관식 문제로 풀며 익혀요.
   출처: 유진님 10.21. 20:47 「세세하게 분류해서!!! 저기 연습장에 좀 올려줘봐 문제를 풀면서 좀 학습해야겠어」(대장 전달).
   자료 data/docreg.json(공개 행만, 사람 이름 ○○○ 처리, 기안자·결재자 칸 없음). 푼 기록·틀린 문제는 이 기기 localStorage 에만.
   화면: #/docreg(처음) · #/docreg/quiz?cat=&type=&mode= · #/docreg/cat/<id> · #/docreg/month */
(function (root) {
  'use strict';
  var data = null, tried = false;
  var sess = null; /* {key, list, i, picked, okN} */
  var CSS = [
    '.dr-head{padding:4px 2px 0}.dr-head h1{margin:0 0 2px}.dr-head p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45}',
    '.dr-card{background:var(--card);border-radius:20px;padding:16px;margin:12px 0}',
    '.dr-card h2{font-size:1.02rem;margin:0 0 4px;display:flex;justify-content:space-between;align-items:baseline}.dr-card h2 small{font-size:.8rem;color:var(--muted);font-weight:500}',
    '.dr-why{font-size:.78rem;color:var(--muted);margin:0 0 8px;line-height:1.45}',
    '.dr-big{display:flex;gap:8px}.dr-big button{flex:1;border:0;border-radius:14px;padding:14px 8px;font-size:.95rem;font-weight:700;cursor:pointer}',
    '.dr-go{background:var(--navy);color:#fff}.dr-re{background:var(--nobg);color:var(--no)}.dr-re[disabled]{background:var(--soft);color:var(--muted)}',
    '.dr-bar{height:6px;border-radius:3px;background:var(--soft);overflow:hidden;margin:8px 0 4px}.dr-bar i{display:block;height:100%;background:var(--navy)}',
    '.dr-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:none}.dr-chips::-webkit-scrollbar{display:none}',
    '.dr-chips button{flex:0 0 auto;border:0;border-radius:999px;padding:7px 12px;background:var(--soft);color:var(--ink-2);font-size:.84rem;font-weight:600;cursor:pointer}',
    '.dr-chips button.on{background:var(--ink);color:#fff}',
    '.dr-cat{display:flex;align-items:center;gap:12px;width:100%;border:0;background:none;padding:12px 0;border-top:1px solid var(--line);text-align:left;cursor:pointer;color:var(--ink)}',
    '.dr-cat:first-of-type{border-top:0}.dr-cat .tx{flex:1;min-width:0}.dr-cat b{font-size:.96rem}.dr-cat .s{display:block;font-size:.76rem;color:var(--muted);margin-top:2px}',
    '.dr-cat .pin{font-size:.66rem;font-weight:700;color:var(--navy);background:var(--blue-soft);border-radius:6px;padding:1px 6px;margin-left:6px;vertical-align:2px}',
    '.dr-cat .n{font-size:.8rem;color:var(--ink-2);font-weight:700;white-space:nowrap;text-align:right}.dr-cat .n small{display:block;color:var(--muted);font-weight:500}',
    '.dr-mini{height:3px;border-radius:2px;background:var(--soft);margin-top:6px;overflow:hidden}.dr-mini i{display:block;height:100%;background:var(--ok)}',
    '.dr-link{display:block;width:100%;border:0;background:none;color:var(--navy);font-weight:600;font-size:.86rem;padding:8px 0 0;text-align:left;cursor:pointer}',
    '.dr-q .meta{font-size:.78rem;color:var(--muted);display:flex;justify-content:space-between}',
    '.dr-q h2{display:block;font-size:1.1rem;line-height:1.45;margin:8px 0 14px;font-weight:700}',
    '.dr-ch{display:block;width:100%;border:0;border-radius:14px;background:var(--soft);padding:14px;margin:0 0 8px;text-align:left;font-size:.95rem;line-height:1.4;color:var(--ink);cursor:pointer}',
    '.dr-ch.ok{background:var(--okbg);color:#037A4B;font-weight:700}.dr-ch.no{background:var(--nobg);color:var(--no)}.dr-ch[disabled]{cursor:default}',
    '.dr-ans{border-radius:14px;padding:12px 14px;margin:6px 0 10px;font-size:.88rem;line-height:1.5}.dr-ans.ok{background:var(--okbg)}.dr-ans.no{background:var(--nobg)}',
    '.dr-ans b{display:block;margin-bottom:2px}.dr-ref{font-size:.78rem;color:var(--ink-2);margin-top:6px}.dr-ref span{display:block;color:var(--muted)}',
    '.dr-next{width:100%;border:0;border-radius:14px;padding:14px;background:var(--navy);color:#fff;font-weight:700;font-size:.98rem;cursor:pointer}',
    '.dr-row{padding:10px 0;border-top:1px solid var(--line);font-size:.86rem;line-height:1.4}.dr-row:first-of-type{border-top:0}',
    '.dr-row .m{display:block;font-size:.74rem;color:var(--muted);margin-top:2px}',
    '.dr-tag{display:inline-block;font-size:.7rem;font-weight:700;border-radius:6px;padding:1px 6px;margin-right:4px;background:var(--blue-soft);color:var(--navy-2)}',
    '.dr-mo{display:grid;grid-template-columns:44px 1fr;gap:8px;padding:10px 0;border-top:1px solid var(--line)}.dr-mo:first-of-type{border-top:0}',
    '.dr-mo>b{font-size:.95rem}.dr-foot{font-size:.76rem;color:var(--muted);padding:4px 4px 20px;line-height:1.5}',
    '.dr-err{background:var(--warnbg);color:var(--warn);border-radius:14px;padding:10px 12px;font-size:.84rem}'
  ].join('\n');
  function style() {
    if (document.getElementById('dr-style')) return;
    var s = document.createElement('style'); s.id = 'dr-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function load() {
    if (data) return Promise.resolve(data);
    if (tried) return Promise.resolve(null);
    tried = true;
    return fetch(new URL('data/docreg.json', document.baseURI).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('docreg'); return r.json(); })
      .then(function (j) { data = j; data._idx = root.HJDocreg.docIndex(j.docs); return j; })
      .catch(function () { tried = false; return null; });
  }
  function getProg() {
    var s = null;
    try { s = localStorage.getItem(root.HJDocreg.STORE); } catch (e) { /* 저장 못 함 */ }
    return root.HJDocreg.parseProgress(s);
  }
  function setProg(p) { try { localStorage.setItem(root.HJDocreg.STORE, JSON.stringify(p)); } catch (e) { /* 저장 못 함 */ } }
  function qs(query) {
    var o = {};
    String(query || '').split('&').forEach(function (kv) {
      if (!kv) return; var i = kv.indexOf('=');
      try { o[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = decodeURIComponent(i < 0 ? '' : kv.slice(i + 1)); } catch (e) { /* 무시 */ }
    });
    return o;
  }
  function catName(id) {
    var c = (data.cats || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : id;
  }
  function subName(id) {
    var out = id;
    (data.cats || []).forEach(function (c) { (c.subs || []).forEach(function (s) { if (s.id === id) out = s.name; }); });
    return out;
  }
  function quizHash(o) {
    var p = [];
    ['cat', 'type', 'mode'].forEach(function (k) { if (o[k]) p.push(k + '=' + encodeURIComponent(o[k])); });
    return '#/docreg/quiz' + (p.length ? '?' + p.join('&') : '');
  }
  var typeSel = '';
  function home(el, api) {
    var D = root.HJDocreg, esc = api.esc, prog = getProg(), qsAll = data.questions || [];
    var st = D.stats(qsAll, prog), cats = D.orderCats(data.cats);
    var tc = D.countBy(qsAll, 'type');
    var chips = D.TYPES.map(function (t) {
      var n = t.id ? (tc[t.id] || 0) : qsAll.length;
      return '<button type="button" data-type="' + esc(t.id) + '" class="' + (typeSel === t.id ? 'on' : '') + '">' + esc(t.name) + ' ' + n + '</button>';
    }).join('');
    var rows = cats.map(function (c) {
      var s = D.stats(qsAll, prog, c.id);
      var pin = D.PRIORITY.indexOf(c.id) >= 0 ? '<span class="pin">내 업무</span>' : '';
      return '<button class="dr-cat" type="button" data-cat="' + esc(c.id) + '"><span class="tx"><b>' + esc(c.name) + '</b>' + pin +
        '<span class="s">' + esc(c.desc || '') + '</span><div class="dr-mini"><i style="width:' + s.pct + '%"></i></div></span>' +
        '<span class="n">' + s.done + '/' + s.total + '문제<small>문서 ' + (c.n || 0) + '건</small></span></button>';
    }).join('');
    el.innerHTML =
      '<div class="dr-head"><h1>문서등록대장 학습</h1><p>' + esc(data.source || '') + ' ' + (data.total || 0).toLocaleString('ko-KR') + '건을 나눠 문제로 만들었어요. 풀면서 「이 문서는 누가 어디로 언제」를 익혀요.</p></div>' +
      '<section class="dr-card" id="dr-prog"><h2>내 진도 <small id="dr-count">' + st.done + ' / ' + st.total + '문제</small></h2>' +
      '<div class="dr-bar"><i style="width:' + st.pct + '%"></i></div>' +
      '<p class="dr-why">맞힘 ' + st.ok + ' · 틀린 문제 ' + st.wrong + ' (이 기기에만 저장)</p>' +
      '<div class="dr-big"><button class="dr-go" type="button" id="dr-start">' + (st.done ? '이어서 풀기' : '처음부터 풀기') + '</button>' +
      '<button class="dr-re" type="button" id="dr-wrong"' + (st.wrong ? '' : ' disabled') + '>틀린 문제 ' + st.wrong + '</button></div></section>' +
      '<section class="dr-card" id="dr-cats"><h2>분류 골라 풀기 <small>' + cats.length + '개 분류</small></h2>' +
      '<p class="dr-why">문제 종류를 먼저 고르면 그 종류만 나와요. 「내 업무」 표시는 유진님 업무와 가까운 분류예요.</p>' +
      '<div class="dr-chips" id="dr-types">' + chips + '</div>' + rows + '</section>' +
      '<section class="dr-card"><h2>정례 문서 달력 <small>' + (data.recurring || []).length + '묶음</small></h2>' +
      '<p class="dr-why">해마다·학기마다 돌아오는 문서를 달별로 모았어요. 2026년 기록 기준이라 「내년에도 이맘때」로 보면 돼요.</p>' +
      '<button class="dr-link" type="button" data-go="#/docreg/month">달별로 보기 ›</button></section>' +
      '<p class="dr-foot">자료: ' + esc(data.source || '') + ' (공개 문서 ' + (data.public_rows || 0) + '건만, 사람 이름은 ○○○). 판단·문제: Claude Code, 검산: 춘식이.<br>' +
      '왜 이렇게: 한성진 선생님처럼 제목만 보고 「내부결재인지, 어디로 보내는지, 언제 하는 일인지」 바로 아는 눈을 기르려고, 유진님 업무와 가까운 분류부터 풀게 했어요.</p>';
    el.querySelector('#dr-start').onclick = function () { sess = null; api.go(quizHash({ type: typeSel, mode: st.done && st.done < st.total ? 'new' : '' })); };
    el.querySelector('#dr-wrong').onclick = function () { sess = null; api.go(quizHash({ mode: 'wrong' })); };
    el.querySelectorAll('[data-type]').forEach(function (b) { b.onclick = function () { typeSel = b.getAttribute('data-type'); home(el, api); }; });
    el.querySelectorAll('[data-cat]').forEach(function (b) { b.onclick = function () { api.go('#/docreg/cat/' + encodeURIComponent(b.getAttribute('data-cat'))); }; });
    el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { api.go(b.getAttribute('data-go')); }; });
  }
  function catPage(el, api, id) {
    var D = root.HJDocreg, esc = api.esc, prog = getProg();
    var c = (data.cats || []).filter(function (x) { return x.id === id; })[0];
    if (!c) { api.go('#/docreg'); return; }
    var s = D.stats(data.questions, prog, id);
    var docs = (data.docs || []).filter(function (d) { return d.cat === id; });
    var subs = (c.subs || []).map(function (sb) {
      var ex = docs.filter(function (d) { return d.sub === sb.id; }).slice(0, 2).map(function (d) { return esc(d.t); }).join(' / ');
      return '<div class="dr-row"><b>' + esc(sb.name) + '</b> <small class="muted">' + (sb.n || 0) + '건</small><span class="m">' + esc(sb.desc || '') + (ex ? '<br>예: ' + ex : '') + '</span></div>';
    }).join('');
    var tc = D.countBy(D.pick(data.questions, { cat: id }), 'type');
    var btns = D.TYPES.filter(function (t) { return !t.id || tc[t.id]; }).map(function (t) {
      return '<button type="button" data-type="' + esc(t.id) + '">' + esc(t.name) + ' ' + (t.id ? tc[t.id] : s.total) + '</button>';
    }).join('');
    var rec = (data.recurring || []).filter(function (r) { return r.cat === id; });
    el.innerHTML =
      '<div class="dr-head"><p><a href="#/docreg">‹ 문서등록대장 학습</a></p><h1>' + esc(c.name) + '</h1><p>' + esc(c.desc || '') + ' · 문서 ' + (c.n || 0).toLocaleString('ko-KR') + '건</p></div>' +
      '<section class="dr-card"><h2>풀기 <small>' + s.done + ' / ' + s.total + '문제</small></h2><div class="dr-bar"><i style="width:' + s.pct + '%"></i></div>' +
      '<p class="dr-why">눌러서 바로 시작해요. 안 푼 문제부터 나와요.</p><div class="dr-chips" id="dr-ctypes">' + btns + '</div>' +
      (s.wrong ? '<button class="dr-link" type="button" id="dr-cwrong">이 분류 틀린 문제 ' + s.wrong + '개 다시 ›</button>' : '') + '</section>' +
      '<section class="dr-card" id="dr-subs"><h2>하위 분류 <small>' + (c.subs || []).length + '개</small></h2>' + subs + '</section>' +
      (rec.length ? '<section class="dr-card"><h2>이 분류 정례 문서 <small>' + rec.length + '묶음</small></h2>' + rec.map(function (r) {
        return '<div class="dr-row"><span class="dr-tag">' + esc(r.pattern) + '</span><b>' + esc(r.name) + '</b><span class="m">' + esc(r.why || '') + '</span></div>';
      }).join('') + '</section>' : '');
    el.querySelectorAll('[data-type]').forEach(function (b) {
      b.onclick = function () { sess = null; var t = b.getAttribute('data-type'); var left = D.pick(data.questions, { cat: id, type: t, mode: 'new' }, prog).length; api.go(quizHash({ cat: id, type: t, mode: left ? 'new' : '' })); };
    });
    var w = el.querySelector('#dr-cwrong');
    if (w) w.onclick = function () { sess = null; api.go(quizHash({ cat: id, mode: 'wrong' })); };
  }
  function monthPage(el, api) {
    var D = root.HJDocreg, esc = api.esc, bm = D.byMonth(data.recurring);
    var order = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
    var rows = order.filter(function (m) { return bm[m]; }).map(function (m) {
      return '<div class="dr-mo"><b>' + m + '월</b><div>' + bm[m].map(function (r) {
        return '<div style="margin-bottom:6px;font-size:.86rem"><span class="dr-tag">' + esc(catName(r.cat)) + '</span>' + esc(r.name) + ' <small class="muted">' + esc(r.pattern) + '</small></div>';
      }).join('') + '</div></div>';
    }).join('');
    el.innerHTML = '<div class="dr-head"><p><a href="#/docreg">‹ 문서등록대장 학습</a></p><h1>정례 문서 달력</h1><p>2026년 3~10월 기록에서 반복된 문서예요. 11~2월은 기록이 없어 비어 있어요.</p></div>' +
      '<section class="dr-card" id="dr-months">' + (rows || '<p class="muted">정례 문서가 없어요.</p>') + '</section>';
  }
  function quiz(el, api, route) {
    var D = root.HJDocreg, esc = api.esc, o = qs(route.query);
    var key = [o.cat || '', o.type || '', o.mode || ''].join('|');
    if (!sess || sess.key !== key) sess = { key: key, list: D.pick(data.questions, o, getProg()), i: 0, picked: null, okN: 0 };
    var back = o.cat ? '#/docreg/cat/' + encodeURIComponent(o.cat) : '#/docreg';
    var title = (o.mode === 'wrong' ? '틀린 문제 ' : '') + (o.cat ? catName(o.cat) : '전체') + (o.type ? ' · ' + D.TYPES.filter(function (t) { return t.id === o.type; })[0].name : '');
    if (!sess.list.length || sess.i >= sess.list.length) {
      var done = sess.list.length;
      el.innerHTML = '<div class="dr-head"><p><a href="' + back + '">‹ 돌아가기</a></p><h1>' + esc(title) + '</h1></div><section class="dr-card" id="dr-end">' +
        (done ? '<h2>다 풀었어요 <small>' + sess.okN + ' / ' + done + ' 맞힘</small></h2><p class="dr-why">틀린 문제는 처음 화면 「틀린 문제」에서 다시 풀 수 있어요.</p>' :
          '<h2>풀 문제가 없어요</h2><p class="dr-why">' + (o.mode === 'wrong' ? '틀린 문제가 없어요. 잘했어요!' : '이 조건의 문제는 다 풀었어요.') + '</p>') +
        '<div class="dr-big"><button class="dr-go" type="button" id="dr-again">처음 화면으로</button></div></section>';
      el.querySelector('#dr-again').onclick = function () { sess = null; api.go('#/docreg'); };
      return;
    }
    var q = sess.list[sess.i], picked = sess.picked;
    var ch = q.choices.map(function (c, i) {
      var cls = '';
      if (picked !== null) { if (i === +q.answer) cls = 'ok'; else if (i === picked) cls = 'no'; }
      return '<button class="dr-ch ' + cls + '" type="button" data-ch="' + i + '"' + (picked !== null ? ' disabled' : '') + '>' + esc(c) + '</button>';
    }).join('');
    var ans = '';
    if (picked !== null) {
      var ok = picked === +q.answer;
      var refs = (q.ref || []).map(function (no) {
        var d = data._idx[no];
        return '<span>' + esc(D.shortNo(no)) + (d ? ' · ' + esc(d.d || '') + ' · ' + esc(d.t) : '') + '</span>';
      }).join('');
      ans = '<div class="dr-ans ' + (ok ? 'ok' : 'no') + '" id="dr-ans"><b>' + (ok ? '정답이에요' : '아쉬워요. 정답: ' + esc(q.choices[+q.answer])) + '</b>왜: ' + esc(q.why || '') +
        '<div class="dr-ref">근거 문서' + refs + '</div></div>' +
        '<button class="dr-next" type="button" id="dr-next">' + (sess.i + 1 < sess.list.length ? '다음 문제' : '결과 보기') + '</button>';
    }
    el.innerHTML = '<div class="dr-head"><p><a href="' + back + '">‹ 그만 풀기</a></p></div>' +
      '<section class="dr-card dr-q" id="dr-quiz"><div class="meta"><span>' + esc(title) + '</span><span id="dr-pos">' + (sess.i + 1) + ' / ' + sess.list.length + '</span></div>' +
      '<div class="dr-bar"><i style="width:' + Math.round(sess.i * 100 / sess.list.length) + '%"></i></div>' +
      '<p class="dr-why" style="margin:8px 0 0"><span class="dr-tag">' + esc(catName(q.cat)) + '</span>' + esc(D.TYPES.filter(function (t) { return t.id === q.type; }).map(function (t) { return t.name; })[0] || '') + '</p>' +
      '<h2>' + esc(q.q) + '</h2>' + ch + ans + '</section>';
    el.querySelectorAll('[data-ch]').forEach(function (b) {
      b.onclick = function () {
        if (sess.picked !== null) return;
        var g = D.grade(q, +b.getAttribute('data-ch'));
        sess.picked = g.chosen; if (g.ok) sess.okN++;
        setProg(D.record(getProg(), q, g.ok));
        quiz(el, api, route);
      };
    });
    var nx = el.querySelector('#dr-next');
    if (nx) nx.onclick = function () { sess.i++; sess.picked = null; quiz(el, api, route); window.scrollTo(0, 0); };
  }
  function render(el, api) {
    style();
    if (!root.HJDocreg) { el.innerHTML = '<section class="card"><div class="dr-err">⚠ 계산 파일(js/docreg-core.js)을 못 불러왔어요. 새로고침해 주세요.</div></section>'; return; }
    var route = api.route();
    function go() {
      var p = route.parts[1] || '';
      if (p === 'quiz') return quiz(el, api, route);
      if (p === 'cat') return catPage(el, api, route.parts[2] || '');
      if (p === 'month') return monthPage(el, api);
      return home(el, api);
    }
    if (data) return go();
    el.innerHTML = '<section class="card"><p class="muted">불러오는 중…</p></section>';
    load().then(function (d) {
      if (!d) { el.innerHTML = '<section class="card"><div class="dr-err" id="dr-err">⚠ 문서등록대장 자료(data/docreg.json)를 불러오지 못했어요. 인터넷을 확인하고 새로고침해 주세요.</div></section>'; return; }
      go();
    });
  }
  root.HJDocregPeek = function () {
    return load().then(function (d) { return d ? root.HJDocreg.stats(d.questions, getProg()) : null; });
  };
  if (root.ShellModules) root.ShellModules.docreg = { id: 'docreg', tab: '문서대장', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

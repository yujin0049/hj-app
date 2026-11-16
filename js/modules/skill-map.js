/* 역량맵 (#/skill-map) — 일 글을 붙여 칸을 찾고, 이 기기 퀴즈 점수로 약한 칸을 보여 주며, 「일 끝내기」로 3문항을 푼다.
   브랜드 C(#4CC3FF, Hahmlet). 자료·문제 없으면 「데이터 없음」 / 「문제 준비 중(데이터 없음)」. 외부 API 없음. */
(function (root) {
  'use strict';
  var CSS = [
    '#sm{max-width:1100px;margin:0 auto;padding:0 0 56px;box-sizing:border-box;color:#EAF6FF;font-family:Hahmlet,Pretendard,sans-serif}',
    '#sm *{box-sizing:border-box}',
    '#sm .sm-head{padding:6px 0 10px}',
    '#sm .sm-kicker{margin:0;font-size:.72rem;letter-spacing:.14em;color:#4CC3FF;font-weight:700}',
    '#sm h1{margin:2px 0 6px;font-size:1.38rem;letter-spacing:-.03em;color:#05121A;font-weight:800}',
    '#sm .sm-lead{margin:0;font-size:.86rem;color:#3A4A55;line-height:1.5}',
    '#sm .sm-paste{background:#0B1C26;border:1px solid #1E3A4A;border-radius:16px;padding:12px;margin:10px 0 14px}',
    '#sm .sm-paste label{display:block;font-size:.8rem;font-weight:700;color:#4CC3FF;margin:0 0 6px}',
    '#sm #sm-text{width:100%;min-height:110px;resize:vertical;border:1px solid #2A4A5C;border-radius:12px;background:#05121A;color:#EAF6FF;font:inherit;font-size:16px;padding:10px 12px;line-height:1.5}',
    '#sm #sm-text::placeholder{color:#6E8796}',
    '#sm #sm-text:focus{outline:2px solid #4CC3FF;outline-offset:1px}',
    '#sm .sm-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}',
    '#sm .sm-btn{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid #4CC3FF;background:transparent;color:#4CC3FF;font:inherit;font-weight:700;cursor:pointer}',
    '#sm .sm-btn.pri{background:#4CC3FF;color:#05121A;border-color:#4CC3FF}',
    '#sm .sm-btn:disabled{opacity:.45;cursor:not-allowed}',
    '#sm .sm-hint{margin:8px 0 0;font-size:.8rem;color:#9BB0C0;line-height:1.45}',
    '#sm .sm-legend{display:flex;flex-wrap:wrap;gap:10px 14px;font-size:.78rem;color:#9BB0C0;margin:0 0 12px}',
    '#sm .sm-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:middle}',
    '#sm .sm-dot.on{background:#4CC3FF}',
    '#sm .sm-dot.weak{background:#E8A317}',
    '#sm .sm-dot.wait{background:transparent;border:1.5px dashed #6E8796}',
    '#sm .sm-map{display:grid;grid-template-columns:1fr;gap:10px}',
    '@media (min-width:900px){#sm .sm-map{grid-template-columns:repeat(4,1fr);gap:12px}}',
    '#sm .sm-branch{background:#0B1C26;border:1px solid #1E3A4A;border-radius:16px;padding:12px 12px 8px;min-width:0}',
    '#sm .sm-branch h2{margin:0 0 8px;font-size:.95rem;color:#4CC3FF;letter-spacing:.04em}',
    '#sm .sm-node{display:block;width:100%;text-align:left;margin:0 0 8px;padding:9px 10px;border-radius:12px;border:1px solid #2A4A5C;background:#05121A;color:#EAF6FF;font:inherit;font-size:.86rem;font-weight:700;line-height:1.35;cursor:default}',
    '#sm .sm-node.on{border-color:#4CC3FF;box-shadow:inset 0 0 0 1px #4CC3FF;background:#0A2A38}',
    '#sm .sm-node.weak{border-color:#E8A317;color:#FFD789}',
    '#sm .sm-node.on.weak{box-shadow:inset 0 0 0 1px #4CC3FF;border-color:#E8A317}',
    '#sm .sm-node.wait{border-style:dashed;color:#8AA0AE;font-weight:600}',
    '#sm .sm-node small{display:block;font-weight:600;font-size:.72rem;color:#8AA0AE;margin-top:3px}',
    '#sm .sm-empty{text-align:center;padding:22px 10px;color:#9BB0C0;background:#0B1C26;border:1px solid #1E3A4A;border-radius:14px}',
    '#sm .sm-quiz{background:#0B1C26;border:1px solid #1E3A4A;border-radius:16px;padding:14px;margin:14px 0 0}',
    '#sm .sm-quiz h2{margin:0 0 8px;font-size:1.05rem;color:#fff}',
    '#sm .sm-q{margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid #1E3A4A}',
    '#sm .sm-q:last-of-type{border-bottom:0}',
    '#sm .sm-q p{margin:0 0 8px;font-weight:700;line-height:1.45}',
    '#sm .sm-choice{display:block;width:100%;text-align:left;margin:0 0 6px;padding:10px 12px;min-height:44px;border-radius:12px;border:1px solid #2A4A5C;background:#05121A;color:#EAF6FF;font:inherit;cursor:pointer}',
    '#sm .sm-choice[aria-pressed="true"]{border-color:#4CC3FF;background:#0A2A38}',
    '#sm .sm-choice.ok{border-color:#3DDC97;background:#0B2A1C}',
    '#sm .sm-choice.no{border-color:#E85D4C;background:#2A1210}',
    '#sm .sm-exp{margin:8px 0 0;font-size:.84rem;color:#C9D9E4;line-height:1.5}',
    '#sm .sm-src{margin:4px 0 0;font-size:.76rem;color:#8AA0AE}',
    '#sm .sm-result{font-weight:800;color:#4CC3FF;margin:0 0 8px}'
  ].join('');

  var st = {
    meta: null, kw: null, bank: null, text: '', hits: [],
    scores: { scores: {} }, quiz: null, picks: [], graded: false, err: ''
  };

  function style() {
    if (document.getElementById('sm-style')) return;
    var s = document.createElement('style');
    s.id = 'sm-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  function getJson(f) {
    return fetch(new URL(f, document.baseURI).href, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(f);
      return r.json();
    });
  }
  function core() {
    if (root.HJSkillMap) return Promise.resolve(root.HJSkillMap);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = new URL('js/skill-map-core.js?v=1', document.baseURI).href;
      s.onload = function () { res(root.HJSkillMap); };
      s.onerror = function () { rej(new Error('js/skill-map-core.js')); };
      document.body.appendChild(s);
    });
  }
  function C() { return root.HJSkillMap; }

  function reloadScores() {
    var ids = C().knownIds(st.meta);
    st.scores = C().readScores(root.localStorage, ids);
  }

  function runMatch() {
    var M = C();
    st.hits = M.match(st.text, st.kw);
    st.quiz = null; st.picks = []; st.graded = false;
  }

  function hitIds() { return st.hits.map(function (h) { return h.id; }); }

  function nodeClass(id) {
    var M = C(), cls = 'sm-node';
    if (hitIds().indexOf(id) >= 0) cls += ' on';
    if (M.isWeak(st.scores.scores, id)) cls += ' weak';
    if (!M.isReady(st.bank, id)) cls += ' wait';
    return cls;
  }

  function nodeNote(id) {
    var M = C();
    if (!M.isReady(st.bank, id)) return M.PENDING;
    var r = M.rate(st.scores.scores, id);
    if (r == null) return '';
    var pct = Math.round(r * 100);
    return (M.isWeak(st.scores.scores, id) ? '약함 · ' : '') + '최근 정답률 ' + pct + '%';
  }

  function paintMap(esc) {
    var M = C(), h = '', branches = (st.meta && st.meta.branches) || [];
    if (!branches.length) return '<p class="sm-empty">' + M.EMPTY + '</p>';
    h += '<div class="sm-legend"><span><i class="sm-dot on"></i>오늘 글과 맞음</span><span><i class="sm-dot weak"></i>퀴즈에서 약한 칸</span><span><i class="sm-dot wait"></i>' + M.PENDING + '</span></div>';
    h += '<div class="sm-map">';
    branches.forEach(function (b) {
      h += '<section class="sm-branch"><h2>' + esc(b.name) + '</h2>';
      (b.items || []).forEach(function (id) {
        var c = M.compById(st.meta, id);
        var name = c ? c.name : id;
        var note = nodeNote(id);
        h += '<div class="' + nodeClass(id) + '" data-id="' + esc(id) + '">' + esc(name);
        if (note) h += '<small>' + esc(note) + '</small>';
        h += '</div>';
      });
      h += '</section>';
    });
    h += '</div>';
    return h;
  }

  function paintQuiz(esc) {
    var M = C();
    if (!st.quiz) return '';
    if (!st.quiz.length) {
      return '<section class="sm-quiz" id="sm-quiz"><h2>일 끝내기</h2><p class="sm-empty">' +
        (hitIds().length ? M.PENDING : M.EMPTY) + '</p></section>';
    }
    var h = '<section class="sm-quiz" id="sm-quiz"><h2>일 끝내기 · ' + st.quiz.length + '문항</h2>';
    if (st.graded) {
      var ok = 0;
      st.quiz.forEach(function (q, i) { if (st.picks[i] === q.answer) ok += 1; });
      h += '<p class="sm-result">' + ok + ' / ' + st.quiz.length + '</p>';
    }
    st.quiz.forEach(function (q, qi) {
      var comp = M.compById(st.meta, q.competency);
      h += '<div class="sm-q"><p>' + (qi + 1) + '. ' + esc(q.q) + '</p>';
      if (comp) h += '<p class="sm-src">' + esc(comp.name) + '</p>';
      (q.choices || []).forEach(function (ch, ci) {
        var cls = 'sm-choice';
        var pressed = st.picks[qi] === ci;
        if (st.graded) {
          if (ci === q.answer) cls += ' ok';
          else if (pressed) cls += ' no';
        }
        h += '<button type="button" class="' + cls + '" data-q="' + qi + '" data-c="' + ci + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + esc(ch) + '</button>';
      });
      if (st.graded) {
        h += '<p class="sm-exp">' + esc(q.explain || '') + '</p>';
        h += '<p class="sm-src">근거: ' + esc(q.src || M.EMPTY) + '</p>';
      }
      h += '</div>';
    });
    if (!st.graded) h += '<div class="sm-actions"><button type="button" class="sm-btn pri" id="sm-grade">채점</button></div>';
    h += '</section>';
    return h;
  }

  function paint(el, api) {
    var M = C(), esc = api.esc;
    var canQuiz = hitIds().some(function (id) { return M.isReady(st.bank, id); });
    var hint = '칸은 이 앱 안의 낱말 사전으로만 찾습니다. 점수는 이 기기에만 남습니다.';
    if (st.text && !st.hits.length) hint = '맞는 칸이 없습니다. ' + M.EMPTY;
    else if (st.hits.length) hint = '찾은 칸 ' + st.hits.length + '개. 「일 끝내기」로 그 칸에서 문항 3개를 풉니다.';
    el.innerHTML = '<div id="sm">' +
      '<header class="sm-head"><p class="sm-kicker">SKILL MAP</p><h1>역량맵</h1>' +
      '<p class="sm-lead">새 일 글을 붙여 넣으면 16개 칸 가운데 관련된 것을 밝힙니다. 갈래는 돈·문서·사람·운영입니다.</p></header>' +
      '<div class="sm-paste"><label for="sm-text">새 일 글</label>' +
      '<textarea id="sm-text" placeholder="새 일 글을 붙여 넣으세요. 보기 글은 넣지 않습니다.">' + esc(st.text) + '</textarea>' +
      '<div class="sm-actions">' +
      '<button type="button" class="sm-btn pri" id="sm-find">칸 찾기</button>' +
      '<button type="button" class="sm-btn" id="sm-quiz-btn"' + (canQuiz ? '' : ' disabled') + '>일 끝내기</button>' +
      '</div><p class="sm-hint" id="sm-hint">' + esc(hint) + '</p></div>' +
      paintMap(esc) + paintQuiz(esc) + '</div>';
    var ta = el.querySelector('#sm-text');
    ta.oninput = function (e) { st.text = e.target.value; };
    el.querySelector('#sm-find').onclick = function () {
      st.text = ta.value;
      runMatch();
      paint(el, api);
    };
    el.querySelector('#sm-quiz-btn').onclick = function () {
      st.text = ta.value;
      runMatch();
      st.quiz = M.drawQuiz(st.bank, hitIds(), 3);
      st.picks = st.quiz.map(function () { return null; });
      st.graded = false;
      paint(el, api);
      var box = el.querySelector('#sm-quiz');
      if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    var grade = el.querySelector('#sm-grade');
    if (grade) grade.onclick = function () {
      if (!st.quiz || st.quiz.some(function (q, i) { return st.picks[i] == null; })) {
        api.toast && api.toast('모든 문항에 답을 고르세요.');
        return;
      }
      var results = st.quiz.map(function (q, i) {
        return { competency: q.competency, correct: st.picks[i] === q.answer };
      });
      st.scores = M.applyResults(st.scores, results);
      M.writeScores(root.localStorage, st.scores);
      st.graded = true;
      paint(el, api);
    };
    el.querySelectorAll('.sm-choice').forEach(function (b) {
      if (st.graded) return;
      b.onclick = function () {
        var qi = Number(b.getAttribute('data-q')), ci = Number(b.getAttribute('data-c'));
        st.picks[qi] = ci;
        paint(el, api);
        var box = el.querySelector('#sm-quiz');
        if (box && box.scrollIntoView) { /* keep place: no jump */ }
      };
    });
  }

  function render(el, api) {
    style();
    if (st.meta && st.kw && st.bank) return paint(el, api);
    el.innerHTML = '<section class="card sk" aria-busy="true"><p class="muted">불러오는 중…</p><i></i><i></i><i></i></section>';
    core().then(function () {
      return Promise.all([
        getJson('data/skill_map/competencies.json'),
        getJson('data/skill_map/keywords.json'),
        getJson('data/skill_map/questions.json')
      ]);
    }).then(function (a) {
      if (!a[0] || !(a[0].competencies || []).length) throw new Error('empty');
      st.meta = a[0]; st.kw = a[1]; st.bank = a[2];
      reloadScores();
      if (el.isConnected) paint(el, api);
    }).catch(function () {
      var msg = (root.HJSkillMap && root.HJSkillMap.EMPTY) || '데이터 없음';
      el.innerHTML = '<section class="card"><h2>역량맵</h2><p class="muted">' + msg + '</p></section>';
    });
  }

  if (root.ShellModules) root.ShellModules['skill-map'] = { id: 'skill-map', tab: '역량맵', icon: '', render: render };
})(typeof window !== 'undefined' ? window : globalThis);

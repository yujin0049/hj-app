/* 문서등록대장 학습(#/docreg) 계산 부분. 화면 없이 node 로도 시험해요(tests/docreg_core.test.js).
   자료 data/docreg.json 은 99 봇/스크립트/docreg_build.py 가 만들어요(사람 이름 없음). */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.HJDocreg = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var PRIORITY = ['aero', 'glocal', 'ojnt', 'budget'];
  var TYPES = [
    { id: '', name: '전체' },
    { id: 'kind', name: '문서 성격' },
    { id: 'to', name: '보내는 곳' },
    { id: 'when', name: '언제 하나' },
    { id: 'cat', name: '어느 분류' }
  ];
  var STORE = 'hj-docreg-v1';

  /* 유진님 업무와 가까운 분류(경남항공교육원·글로컬·OJNT·지출)를 맨 앞에, 나머지는 건수 많은 순 */
  function orderCats(cats) {
    return (cats || []).slice().sort(function (a, b) {
      var pa = PRIORITY.indexOf(a.id), pb = PRIORITY.indexOf(b.id);
      if (pa < 0) pa = 99; if (pb < 0) pb = 99;
      if (pa !== pb) return pa - pb;
      if (a.id === 'etc' || b.id === 'etc') return a.id === 'etc' ? 1 : -1;
      return (b.n || 0) - (a.n || 0);
    });
  }
  function emptyProgress() { return { v: 1, done: {}, wrong: [] }; }
  function parseProgress(s) {
    try {
      var o = typeof s === 'string' ? JSON.parse(s) : s;
      if (!o || typeof o !== 'object' || typeof o.done !== 'object' || !Array.isArray(o.wrong)) return emptyProgress();
      return { v: 1, done: o.done || {}, wrong: o.wrong.filter(function (x) { return typeof x === 'string'; }) };
    } catch (e) { return emptyProgress(); }
  }
  function catRank(cat) { var i = PRIORITY.indexOf(cat); return i < 0 ? 99 : i; }
  /* 풀 문제 고르기. opt: {cat, type, mode: 'all'|'new'|'wrong'} — 순서는 분류 우선순위 → 원래 순서(고정, 다시 열어도 같음) */
  function pick(questions, opt, prog) {
    opt = opt || {}; prog = prog || emptyProgress();
    var wrong = {};
    prog.wrong.forEach(function (id) { wrong[id] = 1; });
    var list = (questions || []).filter(function (q) {
      if (opt.cat && q.cat !== opt.cat) return false;
      if (opt.type && q.type !== opt.type) return false;
      if (opt.mode === 'wrong') return !!wrong[q.id];
      if (opt.mode === 'new') return !prog.done[q.id];
      return true;
    });
    if (!opt.cat) {
      list = list.map(function (q, i) { return { q: q, i: i }; })
        .sort(function (a, b) { return (catRank(a.q.cat) - catRank(b.q.cat)) || (a.i - b.i); })
        .map(function (x) { return x.q; });
    }
    return list;
  }
  function grade(q, choice) {
    return { ok: +choice === +q.answer, answer: q.answer, chosen: +choice };
  }
  /* 기록: 맞히면 틀린 목록에서 빼고, 틀리면 넣어요(맨 앞에 새로). 새 객체를 돌려줘요. */
  function record(prog, q, ok, now) {
    var p = parseProgress(JSON.parse(JSON.stringify(prog || emptyProgress())));
    var d = p.done[q.id] || { n: 0, ok: 0 };
    d.n += 1; if (ok) d.ok += 1;
    d.last = ok ? 1 : 0; d.at = now || Date.now();
    p.done[q.id] = d;
    p.wrong = p.wrong.filter(function (id) { return id !== q.id; });
    if (!ok) p.wrong.unshift(q.id);
    return p;
  }
  function stats(questions, prog, cat) {
    prog = prog || emptyProgress();
    var wrongSet = {};
    prog.wrong.forEach(function (id) { wrongSet[id] = 1; });
    var s = { total: 0, done: 0, ok: 0, wrong: 0 };
    (questions || []).forEach(function (q) {
      if (cat && q.cat !== cat) return;
      s.total++;
      var d = prog.done[q.id];
      if (d) { s.done++; if (d.last) s.ok++; }
      if (wrongSet[q.id]) s.wrong++;
    });
    s.pct = s.total ? Math.round(s.done * 100 / s.total) : 0;
    return s;
  }
  function countBy(questions, key) {
    var o = {};
    (questions || []).forEach(function (q) { o[q[key]] = (o[q[key]] || 0) + 1; });
    return o;
  }
  /* 정례 문서를 달마다 묶기(3~12월, 1·2월). months 가 없으면 빼요. */
  function byMonth(recurring) {
    var m = {};
    (recurring || []).forEach(function (r) {
      (r.months || []).forEach(function (mo) { (m[mo] = m[mo] || []).push(r); });
    });
    return m;
  }
  function docIndex(docs) {
    var o = {};
    (docs || []).forEach(function (d) { o[d.no] = d; });
    return o;
  }
  /* 「항공해양방산학부항공정비과-1855」 → 「항공정비과-1855」(화면에서 짧게) */
  function shortNo(no) { return String(no || '').replace(/^항공해양방산학부/, ''); }
  return { PRIORITY: PRIORITY, TYPES: TYPES, STORE: STORE, orderCats: orderCats, emptyProgress: emptyProgress, parseProgress: parseProgress,
    pick: pick, grade: grade, record: record, stats: stats, countBy: countBy, byMonth: byMonth, docIndex: docIndex, shortNo: shortNo };
});

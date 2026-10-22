/* 정례 문서 달력 계산(#/regular-docs). 화면 없이 node 로도 시험해요: node --test tests/regular_docs_core.test.js
   달 순서는 학년도 기준 3월 → 2월. 「다가오는 달」은 이번 달 다음 달부터 2월까지(10월이면 11·12·1·2월). */
(function (root) {
  'use strict';
  var ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
  function pos(m) { return ORDER.indexOf(+m); }
  /* 고른 분류만(빈 값이면 전체) */
  function filter(docs, cat) {
    return (docs || []).filter(function (d) { return !cat || d.cat === cat; });
  }
  function countByCat(docs) {
    var o = {};
    (docs || []).forEach(function (d) { o[d.cat] = (o[d.cat] || 0) + 1; });
    return o;
  }
  /* 달별 칸 수: {●: n, ○: n} */
  function monthCounts(docs) {
    var o = {};
    ORDER.forEach(function (m) { o[m] = { rec: 0, exp: 0 }; });
    (docs || []).forEach(function (d) {
      Object.keys(d.marks || {}).forEach(function (k) {
        if (!o[k]) return;
        if (d.marks[k] === '●') o[k].rec++; else if (d.marks[k] === '○') o[k].exp++;
      });
    });
    return o;
  }
  /* 다가오는 달: 이번 달 다음부터 학년도 끝(2월)까지. 2월이면 없음. 학년도 밖이면(없음) 빈 목록 */
  function upcomingMonths(now) {
    var p = pos(now);
    if (p < 0) return [];
    return ORDER.slice(p + 1);
  }
  /* 한 달의 문서 목록(● 먼저, 그다음 ○, 같은 표시끼리는 원래 순서) */
  function monthList(docs, m) {
    var rec = [], exp = [];
    (docs || []).forEach(function (d) {
      var v = (d.marks || {})[String(m)];
      if (v === '●') rec.push(d); else if (v === '○') exp.push(d);
    });
    return rec.concat(exp).map(function (d) { return { doc: d, mark: d.marks[String(m)] }; });
  }
  /* 다가오는 ○: [{m, docs:[...]}] (○가 있는 달만) */
  function upcoming(docs, now) {
    return upcomingMonths(now).map(function (m) {
      return { m: m, docs: (docs || []).filter(function (d) { return (d.marks || {})[String(m)] === '○'; }) };
    }).filter(function (x) { return x.docs.length; });
  }
  /* 같은 문서들이 여러 달 이어지면 한 묶음으로: [{ms:[11,12,1,2], docs}] (휴대폰에서 같은 목록 4번 안 보이게) */
  function upcomingGroups(docs, now) {
    var out = [];
    upcoming(docs, now).forEach(function (x) {
      var key = x.docs.map(function (d) { return d.name; }).join('\n'), last = out[out.length - 1];
      if (last && last.key === key) last.ms.push(x.m); else out.push({ key: key, ms: [x.m], docs: x.docs });
    });
    return out.map(function (g) { return { ms: g.ms, docs: g.docs }; });
  }
  /* 칸 모양: 이번 달 열 / 다가오는 ○ 를 화면이 강조할 수 있게 class 이름 */
  function cellClass(mark, m, now) {
    var c = [];
    if (+m === +now) c.push('now');
    if (mark === '●') c.push('rec');
    if (mark === '○') { c.push('exp'); if (upcomingMonths(now).indexOf(+m) >= 0) c.push('soon'); }
    return c.join(' ');
  }
  var api = { ORDER: ORDER, filter: filter, countByCat: countByCat, monthCounts: monthCounts,
    upcomingMonths: upcomingMonths, monthList: monthList, upcoming: upcoming, upcomingGroups: upcomingGroups, cellClass: cellClass };
  root.HJRegularDocs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* 현황판 건별 수치화 공용 계산 (브라우저·node 같이 씀). 자료: data/hyunhwang_score.json (현황판 → 99 봇/스크립트/hyunhwang_score.py).
   진행률 = 끝난 단계 수 ÷ 전체 단계 수(정수 반올림, 스크립트가 계산). 이 파일은 요약 숫자·정렬만(오늘 기준 마감은 보는 날 다시 셈).
   출처: 대장 전달 유진님 10.22. 14:51 「현황판을 따로 수치화… 건당 어찌 처리해야 하고 진행률」. 개인정보 없음(T번호·업무 이름·단계 이름만). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HJScore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var DAY = 86400000;
  function toUTC(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function dLeft(t, today) { return /^\d{4}-\d\d-\d\d$/.test(t.due || '') ? Math.round((toUTC(t.due) - toUTC(today)) / DAY) : null; }
  function isOpen(t) { return !t.cancelled && t.owner !== '-' && !/^완료/.test(t.status || ''); }
  /* 요약 4개(+참고): 전체 건수 · 평균 진행률(취소 뺌) · 유진님 몫(안 끝난 건) · 마감 window일 이내(안 끝난 건, 오늘~+window) */
  function summary(tasks, today, win) {
    win = win == null ? 7 : win;
    var live = tasks.filter(function (t) { return !t.cancelled; });
    var open = live.filter(isOpen);
    var avg = live.length ? Math.round(live.reduce(function (a, t) { return a + (+t.pct || 0); }, 0) / live.length) : 0;
    return {
      all: tasks.length, avg_pct: avg, cancelled: tasks.length - live.length, open: open.length,
      yujin: open.filter(function (t) { return t.owner === '유진님'; }).length,
      due7: open.filter(function (t) { var n = dLeft(t, today); return n !== null && n >= 0 && n <= win; }).length,
      overdue: open.filter(function (t) { var n = dLeft(t, today); return n !== null && n < 0; }).length,
      window: win
    };
  }
  /* 안 끝난 건: 마감 가까운 순(마감 없음은 뒤), 같으면 진행률 낮은 순 */
  function openSorted(tasks, today) {
    return tasks.filter(isOpen).sort(function (a, b) {
      var x = dLeft(a, today), y = dLeft(b, today);
      x = x === null ? 1e6 : x; y = y === null ? 1e6 : y;
      if (x !== y) return x - y;
      if (a.pct !== b.pct) return a.pct - b.pct;
      return a.t < b.t ? -1 : a.t > b.t ? 1 : 0;
    });
  }
  function dueLabel(t, today) {
    var n = dLeft(t, today);
    if (n === null) return { cls: 'none', label: '마감 없음' };
    if (n < 0) return { cls: 'late', label: (-n) + '일 지남' };
    if (n === 0) return { cls: 'today', label: '오늘 마감' };
    return { cls: n <= 3 ? 'soon' : 'later', label: 'D-' + n };
  }
  function stepText(t) { return (t.done || 0) + '/' + (t.total || 0) + '단계'; }
  function oDiffText(t) { return t.o_diff == null ? '' : '현황판 ' + t.o + '%와 ' + (t.o_diff > 0 ? '+' : '') + t.o_diff; }
  return { dLeft: dLeft, isOpen: isOpen, summary: summary, openSorted: openSorted, dueLabel: dueLabel, stepText: stepText, oDiffText: oDiffText };
});

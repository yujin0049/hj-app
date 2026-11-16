/* 홈 「오늘 할 일」 계산. 마감이 오늘인 남은 일만, 최대 3개. 지난 마감은 세만 하고 목록에 넣지 않음. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HJHomeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var DONE = { '완료': 1, '취소': 1, '끝남': 1, '끝': 1 };
  function isDone(st, doneFlag) {
    if (doneFlag === true) return true;
    var m = String(st || '').trim().match(/^(완료|취소|끝남|끝)/);
    return !!(m && DONE[m[1]]);
  }
  function todayItems(tasks, today, limit) {
    limit = limit == null ? 3 : limit;
    var out = [];
    (tasks || []).forEach(function (t) {
      if (!t) return;
      if (isDone(t.status, t.done)) return;
      if (!t.due || t.due !== today) return;
      out.push({
        id: t.id || t.t || '',
        title: t.title || '',
        due: t.due,
        status: t.status || '',
        href: t.href || (t.t ? '#/status' : '#/todo')
      });
    });
    out.sort(function (a, b) {
      return String(a.id).localeCompare(String(b.id), 'ko');
    });
    return out.slice(0, limit);
  }
  function overdueCount(tasks, today) {
    var n = 0;
    (tasks || []).forEach(function (t) {
      if (!t || isDone(t.status, t.done)) return;
      if (t.due && t.due < today) n += 1;
    });
    return n;
  }
  return { todayItems: todayItems, overdueCount: overdueCount, isDone: isDone };
});

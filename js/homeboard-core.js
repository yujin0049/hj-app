/* 홈 현황판 공용 계산 (브라우저·node 같이 씀). 자료: data/bot_status.json 의 tasks(현황판 시트 「업무」 탭에서 스크립트가 만든 것).
   새 입력 없음. 현황판 상태 글자(raw)를 카드 5개로 묶기만 해요. 매핑이 없는 카드는 null → 화면에 「데이터 없음」.
   마감임박 = 안 끝난 건 중 마감 D-3 이내(오늘·지난 것 포함). 3일은 botstatus-core.js due() 의 기존 기준을 그대로 씀. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HJHomeBoard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var B = (typeof module === 'object' && module.exports) ? require('./botstatus-core.js') : root.HJBots;
  var SOON_DAYS = 3; /* botstatus-core.js due(): n <= 3 이면 soon */
  /* 카드 → 현황판 상태 글자. 빈 배열 = 현황판에 그런 상태가 없음(「데이터 없음」) */
  var MAP = {
    '예정': ['할 일', '대기'],
    '진행': ['진행 중'],
    '수정': [],
    '보류': ['보류']
  };
  var CARDS = ['예정', '진행', '수정', '보류', '마감임박'];
  var DONE_RAW = /^(완료|취소)/;
  function isOpen(t) { return t.state !== '끝' && !DONE_RAW.test(t.raw || ''); }
  function cardOf(t) {
    for (var k in MAP) if (MAP[k].indexOf(t.raw) >= 0) return k;
    return '';
  }
  function soon(t, today) {
    if (!isOpen(t)) return false;
    var c = B.due(t, today).cls;
    return c === 'late' || c === 'today' || c === 'soon';
  }
  /* 마감 지난 것(안 끝난 건, 마감 < 오늘): 마감임박 카드 아래 「지남 N」 */
  function overdue(t, today) { return isOpen(t) && B.due(t, today).cls === 'late'; }
  /* 카드 숫자: 매핑 없는 카드는 null. 지남 = 마감임박 중 이미 지난 것 */
  function counts(tasks, today) {
    var o = {};
    CARDS.forEach(function (k) { o[k] = (k === '마감임박' || MAP[k].length) ? 0 : null; });
    o['지남'] = 0;
    (tasks || []).forEach(function (t) {
      if (!isOpen(t)) return;
      var k = cardOf(t);
      if (k && o[k] !== null) o[k] += 1;
      if (soon(t, today)) o['마감임박'] += 1;
      if (overdue(t, today)) o['지남'] += 1;
    });
    return o;
  }
  /* 목록 줄: 안 끝난 건만, 마감 가까운 순. f = '' | 카드 이름 */
  function rows(tasks, today, f) {
    var open = (tasks || []).filter(isOpen).filter(function (t) {
      if (!f) return true;
      if (f === '마감임박') return soon(t, today);
      return cardOf(t) === f;
    });
    return B.sortTasks(open, today).map(function (t) {
      var d = B.due(t, today);
      return {
        t: t.t,
        date: t.updated ? String(t.updated).slice(0, 10) : '',
        title: t.title || '',
        owner: t.bot || '',
        due: t.due || '',
        dueLabel: d.label,
        status: t.raw || '',
        card: cardOf(t),
        soon: soon(t, today)
      };
    });
  }
  return { SOON_DAYS: SOON_DAYS, MAP: MAP, CARDS: CARDS, isOpen: isOpen, cardOf: cardOf, soon: soon, overdue: overdue, counts: counts, rows: rows };
});

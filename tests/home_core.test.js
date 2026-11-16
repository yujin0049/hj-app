// 홈 오늘 할 일 3개: node --test tests/home_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/home-core.js');

const TODAY = '2026-11-16';
const tasks = [
  { t: 'T1', title: '오늘 일', due: '2026-11-16', status: '할 일' },
  { t: 'T2', title: '지난 일', due: '2026-11-10', status: '진행 중' },
  { t: 'T3', title: '끝난 오늘', due: '2026-11-16', status: '완료' },
  { t: 'T4', title: '오늘 둘째', due: '2026-11-16', status: '진행 중' },
  { t: 'T5', title: '내일', due: '2026-11-17', status: '할 일' },
  { t: 'T6', title: '오늘 셋째', due: '2026-11-16', status: '확인 필요' },
  { t: 'T7', title: '오늘 넷째', due: '2026-11-16', status: '할 일' }
];

test('오늘 남은 일만 최대 3개, 지난 마감은 빼 둔다', () => {
  const got = H.todayItems(tasks, TODAY, 3);
  assert.deepEqual(got.map((x) => x.t || x.id), ['T1', 'T4', 'T6']);
  assert.equal(got.length, 3);
  assert.ok(got.every((x) => x.due === TODAY));
});

test('지난 마감 건수만 센다', () => {
  assert.equal(H.overdueCount(tasks, TODAY), 1);
});

test('자료가 없거나 오늘 남은 일이 없으면 빈 목록', () => {
  assert.deepEqual(H.todayItems(null, TODAY, 3), []);
  assert.deepEqual(H.todayItems([], TODAY, 3), []);
  assert.deepEqual(H.todayItems([{ title: '끝', due: TODAY, status: '취소' }], TODAY, 3), []);
});

// 날짜 계산 시험: node --test tests/calendar_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calendar-core.js');

test('KST 오늘: UTC 15:00 이후는 한국 다음 날', () => {
  assert.equal(C.todayKST(Date.UTC(2026, 9, 20, 14, 59)), '2026-10-20');
  assert.equal(C.todayKST(Date.UTC(2026, 9, 20, 15, 0)), '2026-10-21');
  assert.equal(C.todayKST(Date.UTC(2026, 11, 31, 15, 30)), '2027-01-01');
});
test('D-day·D-3·지연·끝남', () => {
  const t = '2026-10-21';
  assert.deepEqual(C.dueState('2026-10-21', t, '할 일'), { cls: 'today', n: 0, label: 'D-day' });
  assert.equal(C.dueState('2026-10-24', t, '진행 중').cls, 'soon');
  assert.equal(C.dueState('2026-10-24', t, '진행 중').label, 'D-3');
  assert.equal(C.dueState('2026-10-25', t, '진행 중').cls, 'later');
  assert.deepEqual(C.dueState('2026-10-08', t, '확인 필요'), { cls: 'late', n: -13, label: '지연 13일' });
  assert.equal(C.dueState('2026-10-08', t, '완료').cls, 'done');
  assert.equal(C.dueState('2026-10-08', t, '취소').cls, 'done');
  assert.equal(C.dueState('', t, '할 일').cls, 'none');
  assert.equal(C.dueState('2026-10-08', t, '취소(결재 회수 완료)').cls, 'done');
});
test('날짜 차이: 달·해 넘김, 윤년', () => {
  assert.equal(C.diffDays('2026-10-31', '2026-11-01'), 1);
  assert.equal(C.diffDays('2026-12-31', '2027-01-01'), 1);
  assert.equal(C.diffDays('2028-02-28', '2028-03-01'), 2);
  assert.equal(C.addDays('2026-11-27', 7), '2026-12-04');
});
test('주 경계: 일요일 시작', () => {
  assert.equal(C.weekday('2026-10-21'), 3); // 수
  assert.equal(C.weekStart('2026-10-21'), '2026-10-18');
  assert.equal(C.weekStart('2026-10-18'), '2026-10-18'); // 일요일은 그날
  assert.equal(C.weekStart('2026-10-24'), '2026-10-18'); // 토요일
  assert.equal(C.weekStart('2027-01-02'), '2026-12-27'); // 해 넘김
  assert.deepEqual(C.weekDays('2026-11-01').slice(0, 2), ['2026-11-01', '2026-11-02']);
});
test('월 칸: 42칸, 일요일부터', () => {
  const g = C.monthGrid(2026, 10);
  assert.equal(g.length, 42);
  assert.equal(g[0], '2026-09-27');
  assert.equal(C.weekday(g[0]), 0);
  assert.ok(g.includes('2026-10-31'));
  assert.equal(C.monthGrid(2026, 11)[0], '2026-11-01');
});
test('거르기', () => {
  const x = { bot: '엑셀봇', status: '진행 중', group: 'OJNT', lane: 'yujin' };
  assert.ok(C.pass(x, { lanes: { yujin: 1 } }));
  assert.ok(!C.pass(x, { lanes: { prof: 1 } }));
  assert.ok(!C.pass(x, { bot: '규정봇' }));
  assert.ok(!C.pass(x, { group: '특강' }));
  assert.ok(!C.pass({ status: '완료' }, {}));
  assert.ok(C.pass({ status: '완료' }, { showDone: true }));
});
test('오래됨·실패 경고', () => {
  const now = Date.parse('2026-10-22T12:00+09:00');
  assert.equal(C.staleness({ refreshed_iso: '2026-10-22T09:00+09:00', last_try_ok: true }, now).warn, false);
  assert.equal(C.staleness({ refreshed_iso: '2026-10-21T11:00+09:00', last_try_ok: true }, now).warn, true);
  assert.equal(C.staleness({ refreshed_iso: '2026-10-22T09:00+09:00', last_try_ok: false, last_try: 'x', refreshed_at: 'y' }, now).warn, true);
  assert.equal(C.staleness(null, now).warn, true);
});
test('화면 안 찾기(q): 낱말 모두·띄어쓰기 무시·T번호·꼬리표', () => {
  const x = { t: 'T012', title: '글로컬 출장 여비 정산', bot: '규정봇', group: '글로컬', status: '진행 중', yujin: ['결재·상신'] };
  assert.ok(C.matchQ(x, ''));
  assert.ok(C.matchQ(x, '  '));
  assert.ok(C.matchQ(x, '여비'));
  assert.ok(C.matchQ(x, '출장여비'));
  assert.ok(C.matchQ(x, '여비 규정봇'));
  assert.ok(!C.matchQ(x, '여비 교수님'));
  assert.ok(C.matchQ(x, 't012'));
  assert.ok(C.matchQ(x, '상신'));
  assert.ok(C.pass(x, { q: '정산' }));
  assert.ok(!C.pass(x, { q: '없는말' }));
  assert.ok(C.pass({ title: '하위', step: '서명 받기', status: '할 일' }, { q: '서명' }));
});

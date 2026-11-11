// 홈 현황판 계산 시험: node --test tests/homeboard_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/homeboard-core.js');

const T = (o) => Object.assign({ t: 'T001', title: '일', bot: '대장', state: '진행', raw: '진행 중', due: '', updated: '2026-11-10 09:00' }, o);
const today = '2026-11-11';

test('카드: 할 일·대기=예정, 진행 중=진행, 보류=보류, 수정은 매핑 없음(null)', () => {
  const c = H.counts([T({ raw: '할 일' }), T({ raw: '대기' }), T({ raw: '진행 중' }), T({ raw: '보류' }), T({ raw: '확인 필요' })], today);
  assert.equal(c['예정'], 2);
  assert.equal(c['진행'], 1);
  assert.equal(c['보류'], 1);
  assert.equal(c['수정'], null);
});

test('끝난 건(끝·완료·취소)은 세지 않음', () => {
  const c = H.counts([T({ state: '끝', raw: '완료', due: '2026-11-11' }), T({ raw: '취소(결재 회수 완료)', due: '2026-11-11' })], today);
  assert.equal(c['진행'], 0);
  assert.equal(c['마감임박'], 0);
});

test('마감임박: D-3 이내·오늘·지난 것은 넣고 D-4·마감 없음은 뺌', () => {
  const list = [T({ due: '2026-11-14' }), T({ due: '2026-11-11' }), T({ due: '2026-11-01' }), T({ due: '2026-11-15' }), T({ due: '' })];
  assert.equal(H.SOON_DAYS, 3);
  assert.equal(H.counts(list, today)['마감임박'], 3);
  assert.deepEqual(H.rows(list, today, '').map((r) => r.soon), [true, true, true, false, false]);
});

test('목록 줄: 날짜=갱신일, 담당=봇, 상태 좁히기', () => {
  const rows = H.rows([T({ raw: '보류', bot: '', updated: '' }), T({ raw: '진행 중' })], today, '보류');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].owner, '');
  assert.equal(rows[0].date, '');
  assert.equal(rows[0].card, '보류');
  assert.equal(H.rows([T({})], today, '')[0].date, '2026-11-10');
});

test('실제 자료(data/bot_status.json)로 돌려도 숫자가 맞물림', () => {
  const d = require('../data/bot_status.json');
  const c = H.counts(d.tasks, today);
  const open = H.rows(d.tasks, today, '');
  assert.equal(c['수정'], null);
  assert.equal(H.rows(d.tasks, today, '마감임박').length, c['마감임박']);
  assert.ok(c['예정'] + c['진행'] + c['보류'] <= open.length);
});

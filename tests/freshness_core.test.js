// 읽은 시각 / 오늘 사용 가능: node --test tests/freshness_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/freshness.js');

const DAY = 24 * 3600000;
// 2026-11-16 10:00 KST = 2026-11-16T01:00:00Z
const NOW = Date.parse('2026-11-16T01:00:00Z');

test('built_at 없으면 「데이터 없음」', () => {
  assert.equal(F.freshness(null, NOW).text, '데이터 없음');
  assert.equal(F.freshness({}, NOW).text, '데이터 없음');
  assert.equal(F.freshness({ built_at: '' }, NOW).text, '데이터 없음');
  assert.equal(F.freshness({ refreshed_at: '2026-11-16 09:00' }, NOW).text, '데이터 없음');
  assert.equal(F.lineHtml({}, NOW).includes('데이터 없음'), true);
  assert.equal(F.lineHtml({}, NOW).includes('fresh-none'), true);
});

test('오늘 읽은 자료는 오늘 사용 가능', () => {
  const r = F.freshness({ built_at: '2026-11-16 09:30' }, NOW);
  assert.equal(r.missing, false);
  assert.equal(r.usableToday, true);
  assert.equal(r.text, '읽은 시각 2026-11-16 09:30 (KST) / 오늘 사용 가능');
  assert.equal(F.lineHtml({ built_at: '2026-11-16 09:30' }, NOW).includes('fresh-ok'), true);
});

test('하루가 지난 자료는 오늘 사용 불가', () => {
  const r = F.freshness({ built_at: '2026-11-11 10:02' }, NOW);
  assert.equal(r.usableToday, false);
  assert.equal(r.text, '읽은 시각 2026-11-11 10:02 (KST) / 오늘 사용 불가');
  assert.equal(F.lineHtml({ built_at: '2026-11-11 10:02' }, NOW).includes('fresh-no'), true);
});

test('ISO 시각도 한국 날짜로 읽는다', () => {
  const r = F.freshness({ built_at: '2026-11-16T10:03+09:00' }, NOW);
  assert.equal(r.usableToday, true);
  const y = F.freshness({ built_at: '2026-11-15T23:00+09:00' }, NOW);
  assert.equal(y.usableToday, false);
});

test('오늘 날짜 경계(KST 자정)를 지킨다', () => {
  const justBefore = Date.parse('2026-11-15T14:59:59Z'); // 11-15 23:59:59 KST
  const justAfter = Date.parse('2026-11-15T15:00:00Z'); // 11-16 00:00 KST
  const data = { built_at: '2026-11-16 00:00' };
  assert.equal(F.freshness(data, justBefore).usableToday, false);
  assert.equal(F.freshness(data, justAfter).usableToday, true);
  assert.ok(DAY > 0);
});

// source_at 기준 오늘 사용 가능 · N일 전 자료: node --test tests/freshness_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/freshness.js');

const DAY = 24 * 3600000;
// 고정 시계: 2026-11-16 10:00 KST = 2026-11-16T01:00:00Z
const NOW = Date.parse('2026-11-16T01:00:00Z');

test('두 시각이 없으면 「데이터 없음」', () => {
  assert.equal(F.freshness(null, NOW).text, '데이터 없음');
  assert.equal(F.freshness({}, NOW).text, '데이터 없음');
  assert.equal(F.freshness({ built_at: '', source_at: '' }, NOW).text, '데이터 없음');
  assert.equal(F.freshness({ refreshed_at: '2026-11-16 09:00' }, NOW).text, '데이터 없음');
  assert.equal(F.lineHtml({}, NOW).includes('데이터 없음'), true);
  assert.equal(F.lineHtml({}, NOW).includes('fresh-none'), true);
});

test('원자료가 오늘이면 오늘 사용 가능(원자료·변환)', () => {
  const obj = { source_at: '2026-11-16T09:30:00+09:00', built_at: '2026-11-16T10:39:00+09:00' };
  const r = F.freshness(obj, NOW);
  assert.equal(r.missing, false);
  assert.equal(r.usableToday, true);
  assert.equal(r.daysAgo, 0);
  assert.equal(r.kind, 'converted');
  assert.equal(r.text, '원자료 11.16. 09:30 · 변환 10:39 / 오늘 사용 가능');
  assert.equal(F.lineHtml(obj, NOW).includes('fresh-ok'), true);
});

test('원자료가 N일 전이면 경고(원자료·변환)', () => {
  const obj = { source_at: '2026-11-11T19:14:19+09:00', built_at: '2026-11-16T10:39:46+09:00' };
  const r = F.freshness(obj, NOW);
  assert.equal(r.usableToday, false);
  assert.equal(r.daysAgo, 5);
  assert.equal(r.text, '원자료 11.11. 19:14 · 변환 10:39 / 5일 전 자료');
  assert.equal(F.lineHtml(obj, NOW).includes('fresh-no'), true);
});

test('git 커밋 시각만 있으면 마지막 수정으로 표시', () => {
  const obj = { source_at: '2026-11-10T15:31:53+09:00' };
  const r = F.freshness(obj, NOW);
  assert.equal(r.kind, 'git');
  assert.equal(r.usableToday, false);
  assert.equal(r.daysAgo, 6);
  assert.equal(r.text, '마지막 수정 11.10. 15:31 / 6일 전 자료');
  assert.equal(F.lineHtml(obj, NOW).includes('마지막 수정'), true);
  const pack = F.freshness({ source_at: '2026-10-29T20:31:51+09:00' }, NOW);
  assert.equal(pack.daysAgo, 18);
  assert.equal(pack.text, '마지막 수정 10.29. 20:31 / 18일 전 자료');
});

test('오늘 날짜 경계(KST 자정)는 source_at 기준', () => {
  const justBefore = Date.parse('2026-11-15T14:59:59Z'); // 11-15 23:59:59 KST
  const justAfter = Date.parse('2026-11-15T15:00:00Z'); // 11-16 00:00 KST
  const data = { source_at: '2026-11-16T00:00:00+09:00', built_at: '2026-11-16T00:01:00+09:00' };
  assert.equal(F.freshness(data, justBefore).usableToday, false);
  assert.equal(F.freshness(data, justAfter).usableToday, true);
  assert.ok(DAY > 0);
});

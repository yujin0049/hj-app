// 정례 문서 달력 계산 시험: node --test tests/regular_docs_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../js/regular-docs-core.js');

const D = (name, cat, marks) => ({ name, cat, cycle: '매월', n: 1, marks });
const docs = [
  D('가', 'a', { 3: '●', 10: '●', 11: '○', 12: '○', 1: '○', 2: '○' }),
  D('나', 'b', { 10: '●', 11: '○' }),
  D('다', 'a', { 4: '●' }),
];

test('달 순서는 3월부터 2월까지 12개', () => {
  assert.deepEqual(R.ORDER, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]);
});
test('분류 고르기: 빈 값이면 전체', () => {
  assert.equal(R.filter(docs, '').length, 3);
  assert.deepEqual(R.filter(docs, 'a').map((d) => d.name), ['가', '다']);
  assert.deepEqual(R.countByCat(docs), { a: 2, b: 1 });
});
test('다가오는 달: 10월이면 11·12·1·2월, 2월이면 없음', () => {
  assert.deepEqual(R.upcomingMonths(10), [11, 12, 1, 2]);
  assert.deepEqual(R.upcomingMonths(12), [1, 2]);
  assert.deepEqual(R.upcomingMonths(2), []);
  assert.deepEqual(R.upcomingMonths(13), []);
});
test('다가오는 ○ 묶음은 ○ 있는 달만', () => {
  const u = R.upcoming(docs, 10);
  assert.deepEqual(u.map((x) => [x.m, x.docs.length]), [[11, 2], [12, 1], [1, 1], [2, 1]]);
  assert.deepEqual(R.upcoming(docs, 12).map((x) => x.m), [1, 2]);
});
test('다가오는 달 묶기: 같은 문서가 이어지는 달은 한 묶음', () => {
  assert.deepEqual(R.upcomingGroups(docs, 10).map((g) => [g.ms, g.docs.length]), [[[11], 2], [[12, 1, 2], 1]]);
});
test('한 달 목록: ● 먼저, 그다음 ○', () => {
  const l = R.monthList([D('x', 'a', { 11: '○' }), D('y', 'a', { 11: '●' })], 11);
  assert.deepEqual(l.map((x) => x.doc.name + x.mark), ['y●', 'x○']);
});
test('달별 건수', () => {
  const c = R.monthCounts(docs);
  assert.deepEqual(c[10], { rec: 2, exp: 0 });
  assert.deepEqual(c[11], { rec: 0, exp: 2 });
});
test('칸 강조: 이번 달 now, 다가오는 ○ soon, 지난 ○ 는 soon 아님', () => {
  assert.equal(R.cellClass('●', 10, 10), 'now rec');
  assert.equal(R.cellClass('○', 11, 10), 'exp soon');
  assert.equal(R.cellClass('○', 11, 12), 'exp');
  assert.equal(R.cellClass('', 3, 10), '');
});
test('실제 자료: 56개, ○ 는 11~2월에만, 다가오는 달(10월 기준) 4달 모두 10건', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'regular_docs.json'), 'utf8'));
  assert.equal(j.docs.length, 56);
  for (const d of j.docs) for (const [m, v] of Object.entries(d.marks)) if (v === '○') assert.ok([11, 12, 1, 2].includes(+m), d.name);
  assert.deepEqual(R.upcoming(j.docs, 10).map((x) => x.docs.length), [10, 10, 10, 10]);
  assert.deepEqual(R.upcomingGroups(j.docs, 10).map((g) => g.ms), [[11, 12, 1, 2]]);
});

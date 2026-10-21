// 문서등록대장 학습 계산 시험: node --test tests/docreg_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/docreg-core.js');

const Q = (id, cat, type, answer) => ({ id, cat, type: type || 'kind', q: '문제', choices: ['가', '나', '다', '라'], answer: answer || 0, ref: ['항공해양방산학부항공정비과-1'], why: '이유' });
const qs = [Q('q1', 'hr'), Q('q2', 'glocal', 'to'), Q('q3', 'aero'), Q('q4', 'budget', 'when'), Q('q5', 'ojnt'), Q('q6', 'glocal')];

test('분류 순서: 경남항공교육원·글로컬·OJNT·지출 먼저, 기타는 맨 끝', () => {
  const l = D.orderCats([{ id: 'etc', n: 900 }, { id: 'hr', n: 300 }, { id: 'budget', n: 5 }, { id: 'student', n: 400 }, { id: 'glocal', n: 50 }, { id: 'aero', n: 1 }, { id: 'ojnt', n: 2 }]);
  assert.deepEqual(l.map((c) => c.id), ['aero', 'glocal', 'ojnt', 'budget', 'student', 'hr', 'etc']);
});
test('전체 풀기 순서도 내 업무 분류 먼저(같은 분류 안은 원래 순서)', () => {
  assert.deepEqual(D.pick(qs, {}).map((q) => q.id), ['q3', 'q2', 'q6', 'q5', 'q4', 'q1']);
});
test('분류·종류로 고르기', () => {
  assert.deepEqual(D.pick(qs, { cat: 'glocal' }).map((q) => q.id), ['q2', 'q6']);
  assert.deepEqual(D.pick(qs, { cat: 'glocal', type: 'to' }).map((q) => q.id), ['q2']);
});
test('채점과 기록: 틀리면 틀린 목록 맨 앞, 맞히면 빠짐', () => {
  let p = D.emptyProgress();
  assert.equal(D.grade(qs[0], 0).ok, true);
  assert.equal(D.grade(qs[0], '2').ok, false);
  p = D.record(p, qs[0], false, 1);
  p = D.record(p, qs[1], false, 2);
  assert.deepEqual(p.wrong, ['q2', 'q1']);
  assert.deepEqual(D.pick(qs, { mode: 'wrong' }, p).map((q) => q.id).sort(), ['q1', 'q2']);
  p = D.record(p, qs[0], true, 3);
  assert.deepEqual(p.wrong, ['q2']);
  assert.equal(p.done.q1.n, 2);
  assert.equal(p.done.q1.ok, 1);
  assert.equal(D.pick(qs, { mode: 'new' }, p).length, 4);
  const s = D.stats(qs, p);
  assert.deepEqual([s.total, s.done, s.ok, s.wrong, s.pct], [6, 2, 1, 1, 33]);
  assert.equal(D.stats(qs, p, 'glocal').wrong, 1);
});
test('기록 읽기: 깨진 값은 빈 기록', () => {
  assert.deepEqual(D.parseProgress('{깨짐'), D.emptyProgress());
  assert.deepEqual(D.parseProgress(null), D.emptyProgress());
  assert.deepEqual(D.parseProgress('{"done":{},"wrong":["q1",3]}').wrong, ['q1']);
});
test('정례 달별 묶음·문서번호 줄이기', () => {
  const m = D.byMonth([{ id: 'r1', months: [3, 9] }, { id: 'r2', months: [3] }, { id: 'r3' }]);
  assert.equal(m[3].length, 2); assert.equal(m[9].length, 1);
  assert.equal(D.shortNo('항공해양방산학부항공정비과-1855'), '항공정비과-1855');
});
test('실제 자료 data/docreg.json: 모양·정답 위치·근거 문서', () => {
  const f = path.join(__dirname, '..', 'data', 'docreg.json');
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const idx = D.docIndex(d.docs);
  const cats = new Set(d.cats.map((c) => c.id));
  for (const c of D.PRIORITY) assert.ok(cats.has(c), c);
  assert.ok(d.questions.length >= 200, '문제 수 ' + d.questions.length);
  const pos = [0, 0, 0, 0];
  for (const q of d.questions) {
    assert.equal(q.choices.length, 4, q.id);
    assert.ok(q.answer >= 0 && q.answer <= 3, q.id);
    pos[q.answer]++;
    assert.ok(q.ref.length && q.ref.every((r) => idx[r]), q.id + ' 근거');
    assert.ok(q.why && q.why.length >= 8, q.id + ' why');
    assert.ok(cats.has(q.cat), q.id);
  }
  for (const n of pos) assert.ok(n > d.questions.length * 0.12, '정답 위치 쏠림 ' + pos);
  for (const t of ['kind', 'to', 'when', 'cat']) assert.ok(d.questions.some((q) => q.type === t), t);
});

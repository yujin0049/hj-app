// 출석부 공용 기준(js/attend-core.js): node --test tests/attend_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/attend-core.js');
const A = globalThis.HJAttend;

test('상태 3가지(지각 포함) · 회차 id · 교시 시각', () => {
  assert.deepEqual(A.STATUS, { o: '출석', l: '지각', x: '결석' });
  assert.ok(A.validStatus('l') && A.validStatus('') && !A.validStatus('q'));
  assert.equal(A.sessionId('2026-10-14', 4, 6), '20261014-p4-6');
  assert.deepEqual(A.times(1, 3), ['09:00', '11:50']);
  assert.deepEqual(A.times(4, 6), ['13:00', '15:50']);
  assert.deepEqual(A.times(7, 8), ['16:00', '17:50']);
});

test('잠금: 수업 날짜 + 7일, 그날 밤 23:59 KST 까지 고칠 수 있음 · 풀면 안 잠김', () => {
  assert.equal(new Date(A.lockAt('2026-10-14')).toISOString(), '2026-10-21T14:59:59.999Z');
  const before = Date.parse('2026-10-21T23:59:00+09:00'), after = Date.parse('2026-10-22T00:00:01+09:00');
  assert.equal(A.isLocked('2026-10-14', 0, before), false);
  assert.equal(A.isLocked('2026-10-14', 0, after), true);
  assert.equal(A.isLocked('2026-10-14', 1, after), false);
  assert.equal(A.kstDate(Date.parse('2026-10-29T15:30:00Z')), '2026-10-30');
  assert.equal(A.hm('2026-10-30T02:05:00Z'), '11:05');
});

test('집계·출석률: 지각=출석으로 계산, 85% = 올림', () => {
  const c = A.summary([1, 2, 3, 4], { 1: { st: 'o' }, 2: { st: 'l' }, 3: { st: 'x' } });
  assert.deepEqual(c, { named: 4, here: 1, late: 1, away: 1, came: 2, unset: 1 });
  const ss = [{ id: 'a', hours: 3 }, { id: 'b', hours: 3 }, { id: 'c', hours: 2 }];
  const r = A.rates([1, 2], ss, { a: { 1: 'l', 2: 'x' }, b: { 1: 'o', 2: 'l' } });
  assert.equal(r[1].total, 8); assert.equal(r[1].need, 7);
  assert.deepEqual([r[1].came, r[1].away, r[1].rate, r[1].ok], [6, 0, 1, true]);
  assert.deepEqual([r[2].came, r[2].away, r[2].maxPossible, r[2].ok], [3, 3, 5, false]);
});

test('명단 읽기(CSV·JSON·줄) — 빈 칸은 버림', () => {
  assert.deepEqual(A.parseRoster('No,이름\n1,학생1\n2,"학생,2"\n3,'), ['학생1', '학생,2']);
  assert.deepEqual(A.parseRoster('["학생1"," 학생2 ",""]'), ['학생1', '학생2']);
  assert.deepEqual(A.parseRoster('학생1\n\n학생2'), ['학생1', '학생2']);
  assert.throws(() => A.parseRoster('{"x":1}'));
});

test('PDF: 라이브러리 없이 JPEG 쪽 → A4 PDF(xref 위치가 맞음)', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = A.makePdf([{ jpeg, w: 10, h: 14 }, { jpeg, w: 10, h: 14 }]);
  const s = Buffer.from(pdf).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4') && s.trimEnd().endsWith('%%EOF'));
  assert.match(s, /\/Count 2/);
  const xo = +s.match(/startxref\n(\d+)/)[1];
  assert.equal(s.slice(xo, xo + 4), 'xref');
  const offs = s.slice(xo).split('\n').slice(3, 3 + 7).map((l) => +l.slice(0, 10));
  offs.forEach((o, i) => assert.equal(s.slice(o, o + String(i + 1).length + 6), (i + 1) + ' 0 obj'));
});

test('공용 파일은 서버를 부르지 않음(fetch 없음) · API 주소는 https 이거나 빈칸', () => {
  const src = require('node:fs').readFileSync(require.resolve('../js/attend-core.js'), 'utf8');
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|localStorage/);
  assert.ok(A.API_BASE === '' || /^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(A.API_BASE));
});

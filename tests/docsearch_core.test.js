// 문서대장 찾기 계산 시험: node --test tests/docsearch_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/docsearch-core.js');
const R = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));

const docreg = { cats: [{ id: 'aero', name: '경남항공교육원', subs: [{ id: 'aero.ato', name: '국토부 전문교육기관' }] }, { id: 'trip', name: '출장', subs: [] }],
  docs: [
    { no: '항공해양방산학부항공정비과-10', t: '전문교육기관 현장심사 결과 보완 조치 결과 제출', kind: '대외 발신', cat: 'aero', sub: 'aero.ato', to: '국토교통부장관', d: '2026-09-02' },
    { no: '항공해양방산학부항공정비과-11', t: '국내 출장신청서', kind: '내부결재', cat: 'trip', sub: '', to: '내부결재', d: '2026-10-05' },
    { no: '항공해양방산학부항공정비과-12', t: '하반기 연구실 안전교육 이수 협조', kind: '대내 접수', cat: '', sub: '', to: '대학운영처/행정지원과', d: '2026-08-31' }] };
const extra = { rows: [['항공해양방산학부항공정비과-20', '출장결과보고서(표준화 회의 참석)', '2026-10-27', '내부결재', '내부결재', '교육원·전문교육기관']] };
const rows = D.buildRows(docreg, extra);

test('두 자료를 합쳐 최신 날짜 먼저, 번호는 짧게', () => {
  assert.deepEqual(rows.map((r) => r.short), ['항공정비과-20', '항공정비과-11', '항공정비과-10', '항공정비과-12']);
  assert.equal(rows[2].kind, '발신');
  assert.equal(rows[3].kind, '수신');
  assert.equal(rows[3].dept, '행정지원과');
});
test('키워드: 낱말 모두·번호·기간·부서', () => {
  assert.deepEqual(D.filter(rows, { q: '출장' }).map((r) => r.n), [20, 11]);
  assert.deepEqual(D.filter(rows, { q: '출장 결과' }).map((r) => r.n), [20]);
  assert.deepEqual(D.filter(rows, { no: '10' }).map((r) => r.n), [10]);
  assert.deepEqual(D.filter(rows, { from: '2026-10-01', to: '2026-10-31' }).map((r) => r.n), [20, 11]);
  assert.deepEqual(D.filter(rows, { dept: '행정지원과' }).map((r) => r.n), [12]);
  assert.equal(D.filter(rows, { q: '없는낱말' }).length, 0);
});
test('질문 낱말: 조사·멈춤말 빼기, 월·받은/보낸 읽기', () => {
  assert.deepEqual(D.terms('연구실 안전교육 관련 공문 언제 왔어?'), ['연구실', '안전교육']);
  assert.deepEqual(D.intent('10월에 받은 출장 문서'), { months: [10], kind: '수신' });
  assert.deepEqual(D.terms('10월에 받은 출장 문서'), ['출장']);
});
test('질문 검색: 같은 뜻 낱말로 넓혀 근거 번호를 돌려줌', () => {
  const a = D.ask(rows, '교육원 심사 결과는?');
  assert.equal(a.hits[0].r.n, 10);
  assert.ok(a.summary.evidence.includes('항공정비과-10'));
  const b = D.ask(rows, '여비 쓴 문서');      // 여비 → 출장 (같은 뜻)
  assert.ok(b.hits.some((h) => h.r.n === 11));
  assert.equal(D.ask(rows, '문서 알려줘').hits.length, 0);
});
test('실제 자료: 부족 부서 = 조사 MD(교육원 자체 없음·글로컬대학사업센터 10.10.~)', () => {
  const ds = R('data/docsearch.json');
  assert.equal(ds.registers.files, 16);
  assert.equal(ds.registers.depts, 13);
  assert.equal(ds.registers.rows.length, 13);
  assert.equal(ds.registers.base, '2026-10-30');
  const g = D.gaps(ds.registers);
  assert.deepEqual(g.map((r) => [r.dept, r.status, r.gap_from]), [['글로컬대학사업센터', '부족', '2026-10-10'], ['경남항공교육원 자체 대장', '대장 없음', null]]);
  const all = D.buildRows(R('data/docreg.json'), ds.extra);
  assert.equal(all.length, R('data/docreg.json').docs.length + ds.extra.rows.length);
  assert.ok(D.ask(all, '교육원 전문교육기관 심사 결과는?').summary.evidence.includes('항공정비과-1418'));
});

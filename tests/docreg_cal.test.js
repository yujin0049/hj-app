// 문서등록대장 달력 자료 읽기 시험: node --test tests/docreg_cal.test.js (가짜 자료, 시험 안에서만)
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/docreg-cal.js');

test('월별·날짜별·날짜별 목록 모양 읽기', () => {
  const c = C.normalize({
    total: 3, from: '2099-01-02', to: '2099-02-01',
    months: [{ ym: '2099-02', n: 1 }, { ym: '2099-01', n: 2 }],
    days: { '2099-01-02': 2, '2099-02-01': 1 },
    docs: { '2099-01-02': [{ no: '시험-1', t: '가짜 제목 하나', who: '가*짜' }, { no: '시험-2', t: '가짜 제목 둘', who: '' }], '2099-02-01': [{ no: '시험-3', t: '가짜 셋', who: '' }] },
  });
  assert.deepEqual(c.months.map((m) => m.ym), ['2099-01', '2099-02']);
  assert.equal(c.total, 3);
  assert.equal(c.days['2099-01-02'], 2);
  assert.equal(c.docs['2099-01-02'][0].who, '가*짜');
  assert.equal(c.from, '2099-01-02');
});
test('한글 키·날짜 안 목록·월별 없으면 날짜로 셈', () => {
  const c = C.normalize({ 날짜별: [{ date: '2099.03.05', docs: [{ 문서번호: '시험-9', 제목: '가짜', 담당자: '' }] }] });
  assert.deepEqual(c.months, [{ ym: '2099-03', n: 1 }]);
  assert.equal(c.days['2099-03-05'], 1);
  assert.equal(c.docs['2099-03-05'][0].no, '시험-9');
  assert.equal(c.total, 1);
});
test('빈 자료는 null (예시 숫자로 채우지 않음)', () => {
  assert.equal(C.normalize(null), null);
  assert.equal(C.normalize({}), null);
});
test('meta 묶음·docs_by_day·title/owner/kind 키', () => {
  const c = C.normalize({ meta: { total: 1, first_date: '2099-04-01', last_date: '2099-04-01', dept: '시험학부시험과', basis: '등록일자', masked_new_names: 0 },
    months: [{ month: '2099-04', count: 1 }], days: [{ date: '2099-04-01', count: 1 }],
    docs_by_day: { '2099-04-01': [{ no: '시험-5', title: '가짜', owner: '가*짜', kind: '수신' }] } });
  assert.equal(c.total, 1); assert.equal(c.title, '시험과'); assert.equal(c.basis, '등록일자'); assert.equal(c.masked, 0);
  assert.deepEqual(c.months, [{ ym: '2099-04', n: 1 }]);
  assert.deepEqual(c.docs['2099-04-01'][0], { no: '시험-5', t: '가짜', who: '가*짜', kind: '수신' });
});

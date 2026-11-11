// 남해캠 공지사항 계산 시험: node --test tests/notice_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const N = require('../js/notice-core.js');
const R = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));

const index = { article_url: 'https://www.namhae.ac.kr/namhae_01/web/cop/bbs/selectBoardArticle.do?bbsId=BBSMSTR_000000000284&nttId=',
  years: [{ y: '2026', n: 2, file: 'data/notices/2026.json' }, { y: '2025', n: 3, file: 'data/notices/2025.json' }, { y: '2024', n: 1, file: 'data/notices/2024.json' }] };
const rows = [
  { id: '30', no: 3, d: '2025-03-01', t: '수강신청 안내', dept: '교무처', k: 'ok', s: '수강신청 기간' },
  { id: '50', no: 5, d: '2026-11-04', t: '장학금 신청 안내', dept: '대학운영처', k: 'img' },
  { id: '40', no: 4, d: '2026-11-04', t: '기숙사 입사 안내', dept: '기숙사', k: 'pii', f: ['붙임1 신청서.hwp'] },
  { id: '10', no: 1, d: '2024-01-02', t: '시무식', dept: '교무처', k: 'fail' }
];

test('최신순: 날짜↓ 번호↓', () => {
  assert.deepEqual(N.sortRows(rows).map((r) => r.id), ['50', '40', '30', '10']);
  assert.deepEqual(N.latest(rows, 2).map((r) => r.id), ['50', '40']);
});
test('거르기: 낱말 모두·연도·부서·첨부 이름', () => {
  assert.deepEqual(N.filter(rows, { q: '안내' }).map((r) => r.id).sort(), ['30', '40', '50']);
  assert.deepEqual(N.filter(rows, { q: '신청 장학금' }).map((r) => r.id), ['50']);
  assert.deepEqual(N.filter(rows, { q: '신청서' }).map((r) => r.id), ['40']);
  assert.deepEqual(N.filter(rows, { y: '2025' }).map((r) => r.id), ['30']);
  assert.deepEqual(N.filter(rows, { dept: '교무처' }).map((r) => r.id).sort(), ['10', '30']);
  assert.equal(N.filter(rows, { q: '없는낱말' }).length, 0);
});
test('표시: 개인정보·이미지·실패 글은 요약 대신 안내', () => {
  assert.equal(N.kindLabel('pii'), '개인정보 포함·원문 링크만');
  assert.equal(N.kindLabel('img'), '본문 이미지·원문 보기');
  assert.equal(N.kindLabel('ok'), '');
});
test('원문 주소는 남해캠 게시판 + 숫자 nttId 만', () => {
  assert.ok(N.url(index, '46040').endsWith('&nttId=46040'));
  assert.equal(N.url(index, '1 or 1'), '');
  assert.equal(N.url({ article_url: 'https://example.org/?id=' }, '1'), '');
});
test('필요한 연도 파일만: 기본은 최신 해부터 필요한 만큼, 검색은 전부', () => {
  assert.deepEqual(N.yearsFor(index, {}, 2).map((x) => x.y), ['2026']);
  assert.deepEqual(N.yearsFor(index, {}, 4).map((x) => x.y), ['2026', '2025']);
  assert.deepEqual(N.yearsFor(index, { y: '2024' }).map((x) => x.y), ['2024']);
  assert.equal(N.yearsFor(index, { q: '장학' }).length, 3);
});
test('실제 자료: 목차와 연도 파일 건수가 맞고, 요약 없는 글은 안내가 있음, 본문 전문 없음', () => {
  const ix = R('data/notices.json');
  let n = 0;
  for (const y of ix.years) {
    const f = R(y.file);
    assert.equal(f.rows.length, y.n);
    n += f.rows.length;
    for (const r of f.rows) {
      assert.ok(['ok', 'pii', 'img', 'fail'].includes(r.k));
      if (r.k === 'ok') assert.ok(r.s && r.s.length <= ix.summary_len + 1);
      else assert.equal(r.s, undefined);
      assert.ok(N.url(ix, r.id));
    }
    assert.deepEqual(f.rows.map((r) => r.id), N.sortRows(f.rows).map((r) => r.id));
  }
  assert.equal(n, ix.n);
});

// 사람별 하는 일 팝업 읽기 시험: node --test tests/people_roles.test.js  (이름은 가짜 기호 P1·P2·D1)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../js/people-roles.js');
const P = globalThis.HJPeopleRoles;

const one = (o) => P.normalize({ meta: {}, people: [Object.assign({ id: 'person:P1', label: 'P1' }, o)] });

test('빈 파일·없는 사람은 「데이터 없음」', () => {
  assert.deepEqual(P.normalize(null), {});
  assert.deepEqual(P.normalize({ meta: {}, people: [] }), {});
  assert.match(P.html(P.find({}, 'P1'), 'P1'), /데이터 없음/);
});
test('저장소의 people_roles.json 은 비어 있음(예시 자료 금지)', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'people_roles.json'), 'utf8'));
  assert.equal(Object.keys(P.normalize(j)).length, 0);
});
test('정한 모양: id 로도 이름으로도 찾음, roles_summary 줄바꿈 → 최대 3줄, doc_nos·counts·period', () => {
  const m = one({ dept: 'D1', rank: '', rank_inferred: '팀장', rank_confidence: 'inferred', roles_summary: 'a\nb\nc\nd',
    doc_nos: ['D1-1', 'D1-2'], counts: { 기안: 3, 결재: 1200, 원기안: 0, 협조제목: 7 }, period: { first: '2024-03', last: '2026-10' } });
  assert.equal(P.find(m, 'person:P1'), P.find(m, 'P1 7000'));
  const h = P.html(P.find(m, 'P1'), 'P1');
  assert.equal((h.match(/<li/g) || []).length, 3);
  assert.match(h, /팀장 <span class="pr-tag">추정/);
  assert.match(h, /D1-1.*D1-2/);
  assert.match(h, /제목에 협조가 들어간 문서 수 7/);
  assert.match(h, /결재 1,200/);
  assert.match(h, /2024-03 ~ 2026-10/);
  assert.doesNotMatch(h, /pr-tag">추론/);
});
test('rank 가 있거나 확정이면 「추정」 없음', () => {
  assert.doesNotMatch(P.html(P.find(one({ rank: '팀장', roles_summary: 'a' }), 'P1'), 'P1'), /추정/);
  assert.doesNotMatch(P.html(P.find(one({ rank_inferred: '팀장', rank_confidence: '확정', roles_summary: 'a' }), 'P1'), 'P1'), /추정/);
});
test('inferred=true → 흐린 글자 + 「추론」, inferred_notes 표시', () => {
  const h = P.html(P.find(one({ roles_summary: ['a', 'b'], inferred: true, inferred_notes: '제목만 보고 추정' }), 'P1'), 'P1');
  assert.equal((h.match(/<li class="pr-inf">/g) || []).length, 2);
  assert.match(h, /pr-tag">추론/);
  assert.match(h, /제목만 보고 추정/);
});
test('함께 일하는 사람·부서는 거미줄 간선(같은 id)에서, 많은 순', () => {
  const sp = { nodes: [{ id: 'person:P1', label: 'P1', type: 'person' }, { id: 'person:P2', label: 'P2', type: 'person' },
    { id: 'dept:D1', label: 'D1', type: 'dept' }, { id: 'reg:R', label: 'R', type: 'reg' }],
  edges: [{ from: 'person:P1', to: 'dept:D1', weight: 2 }, { from: 'person:P2', to: 'person:P1', weight: 9, est: true },
    { from: 'person:P1', to: 'reg:R', weight: 50 }] };
  const c = P.collabFrom(sp, 'person:P1');
  assert.deepEqual(c.map((x) => [x.name, x.inferred]), [['P2', true], ['D1', false]]);
});
test('공개 페이지: 휴대전화·이메일 모양은 지우고, 글자는 이스케이프', () => {
  const h = P.html(P.find(one({ roles_summary: '문의 010-1234-5678 a@b.kr <b>x</b>' }), 'P1'), 'P1');
  assert.doesNotMatch(h, /010-1234|a@b\.kr|<b>x/);
});

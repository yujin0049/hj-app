// 협조 검색 + 거미줄 자료 합치기 시험: node --test tests/coop_graph.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../js/coop-graph.js');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'));
const SP = rd('dept_spider.json');
const PR = rd('people_roles.json');
const idx = G.build(SP, PR);

test('부서 이름으로 찾으면 하는 일·대장 건수·이어진 부서·규정·근거 파일(이름만)', () => {
  const b = SP.dept_role_board.find((x) => x.doc_n > 100);
  const r = G.search(idx, b.dept, []);
  const d = r.depts.find((x) => x.name === b.dept);
  assert.ok(d);
  assert.equal(d.docN, b.doc_n);
  assert.ok(d.links.length > 0 && d.links.length <= 5);
  assert.ok(d.links.every((l) => l.name !== b.dept));
  assert.ok(d.regs.length > 0);
  assert.ok(d.sources.every((s) => !/[/\\]|\.md$/.test(s)));
  const h = G.html(idx, r);
  assert.match(h, /#부서/);
  assert.match(h, /이어진 부서/);
  assert.match(h, /규정/);
});

test('사람: 추론·추정 표시, 협조 개수 이름, 관련 추정 규정, 전화·메일 없음', () => {
  const ppl = PR.people || [];
  if (!ppl.length) return; // 빈 파일이면 아래 「데이터 없음」 시험만
  const inf = ppl.find((p) => p.inferred && (p.roles_summary || []).length);
  const r = G.search(idx, '', [{ kind: 'person', label: '#' + inf.label, q: inf.label }]);
  assert.equal(r.persons[0].name, inf.label);
  const h = G.html(idx, r);
  assert.match(h, /추론/);
  assert.match(h, /제목에 협조가 들어간 문서 수/);
  assert.match(h, /원문기안/);
  if ((inf.regs || []).length) assert.match(h, /관련 추정 규정/);
  assert.doesNotMatch(h, /@|01[016789]-?\d{3,4}-?\d{4}/);
  const masked = ppl.find((p) => /^person:x/.test(p.id));
  if (masked) assert.ok(idx.persons[masked.label] && /\*/.test(masked.label));
});

test('직위 추정 → 「추정」', () => {
  const p = { id: 'person:가', label: '가', dept: SP.dept_role_board[0].dept, rank: null, rank_inferred: '주무관', rank_confidence: 'inferred', roles_summary: ['일'], counts: { 기안: 1 } };
  const i = G.build(null, { people: [p] });
  assert.match(G.html(i, G.search(i, '', [{ kind: 'person', q: '가' }])), /주무관 <span class="cg-tag">추정<\/span>/);
});

test('일 낱말 → 누구와 협조·어느 규정', () => {
  const reg = SP.reg_catalog.find((r) => (r.kws || []).length);
  const r = G.search(idx, reg.kws[0], []);
  assert.ok(r.guide);
  assert.ok(r.guide.regs.some((x) => x.name === reg.label));
  assert.ok(r.guide.depts.length > 0);
  assert.match(G.html(idx, r), /누구와 협조/);
});

test('#부서 #사람 칩 제안', () => {
  const b = SP.dept_role_board[0].dept;
  const s = G.suggest(idx, b.slice(0, 2));
  assert.ok(s.some((c) => c.kind === 'dept' && c.label === '#' + b));
});

test('사람 파일 비었거나 없음 → 데이터 없음, 거미줄만으로도 동작', () => {
  for (const pr of [null, { meta: {}, people: [] }]) {
    const i = G.build(SP, pr);
    const pn = SP.nodes.find((n) => n.type === 'person');
    const h = G.html(i, G.search(i, pn.label, []));
    assert.match(h, /데이터 없음/);
  }
  assert.equal(G.html(G.build(null, null), { depts: [], persons: [], guide: null }), '');
});

test('공개 화면 거름: 전화·메일·주민번호 지움, 파일 이름만', () => {
  const at = '@', ph = ['010', '1234', '5678'].join('-');
  assert.equal(G.safe('a b' + at + 'c.kr ' + ph), 'a');
  assert.equal(G.fileName('10 업무/x_v01.md'), 'x_v01');
});

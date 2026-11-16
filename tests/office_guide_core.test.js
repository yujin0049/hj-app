// 신입 업무 가이드 계산 시험: node --test tests/office_guide_core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/office-guide-core.js');

test('쪽·목차·체크리스트가 각 10개이고 id 가 맞다', () => {
  const pages = G.pages();
  const nav = G.navItems();
  const checks = G.checklist();
  assert.equal(pages.length, 10);
  assert.equal(nav.length, 10);
  assert.equal(checks.length, 10);
  assert.deepEqual(pages.map((p) => p.id), nav.map((n) => n.id));
  assert.deepEqual(pages.map((p) => p.id), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']);
  assert.deepEqual(checks.map((c) => c.id), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10']);
});

test('장 번호는 05 다음이 07 이고 06 장은 없다(원본과 같음)', () => {
  const heads = [];
  G.pages().forEach((p) => (p.blocks || []).forEach((b) => {
    if (b.t === 'h2') heads.push(b.text);
  }));
  assert.ok(heads.some((t) => t.startsWith('05.')));
  assert.ok(heads.some((t) => t.startsWith('07.')));
  assert.ok(!heads.some((t) => t.startsWith('06.')));
});

test('라우트에서 쪽을 읽고, 없는 값은 빈 칸', () => {
  assert.equal(G.pageFromRoute(['office-guide', 'p3']), 'p3');
  assert.equal(G.pageFromRoute(['office-guide', 'p10']), 'p10');
  assert.equal(G.pageFromRoute(['office-guide']), '');
  assert.equal(G.pageFromRoute(['office-guide', 'p99']), '');
  assert.equal(G.pageFromRoute(['office-guide', 'page1']), '');
  assert.equal(G.href('p4'), '#/office-guide/p4');
  assert.equal(G.pageById('p1').no, 1);
  assert.equal(G.pageById('px'), null);
});

test('본문이 비면 「데이터 없음」', () => {
  assert.equal(G.emptyText([]), '데이터 없음');
  assert.equal(G.emptyText(null), '데이터 없음');
  assert.equal(G.emptyText(G.pages()), '');
});

test('체크는 허용된 id 만 토글·저장하고 나머지는 버린다', () => {
  const a = G.readChecks({ c1: true, secret: true, c2: 1 });
  assert.equal(a.c1, true);
  assert.equal(a.c2, true);
  assert.equal(a.secret, undefined);
  assert.equal(Object.keys(a).length, 10);
  const b = G.toggleCheck(a, 'c1');
  assert.equal(b.c1, false);
  const c = G.toggleCheck(b, 'nope');
  assert.equal(G.checkedCount(c), 1);
  const d = G.readChecks('not-json');
  assert.equal(G.checkedCount(d), 0);
  assert.equal(JSON.parse(G.writeChecks({ c3: true })).c3, true);
});

test('안내문에 실제 전화 꼴·실명 호칭이 없다', () => {
  const blob = JSON.stringify(G.pages()) + JSON.stringify(G.checklist()) + JSON.stringify(G.navItems());
  assert.equal(/010[-\s]?\d{3,4}[-\s]?\d{4}/.test(blob), false);
  assert.equal(/[가-힣]{2,4}\s?(교수님|선생님|주무관|팀장님|과장님)/.test(blob), false);
  assert.ok(blob.indexOf('○○') >= 0);
});

test('체크리스트는 9쪽에 1–5, 10쪽에 6–10이고 id는 그대로다', () => {
  const p9 = G.pageById('p9').blocks.filter((b) => b.t === 'checks');
  const p10 = G.pageById('p10').blocks.filter((b) => b.t === 'checks');
  assert.equal(p9.length, 1);
  assert.equal(p10.length, 1);
  assert.deepEqual(G.checklistSlice(p9[0].from, p9[0].to).map((c) => c.id), ['c1', 'c2', 'c3', 'c4', 'c5']);
  assert.deepEqual(G.checklistSlice(p10[0].from, p10[0].to).map((c) => c.id), ['c6', 'c7', 'c8', 'c9', 'c10']);
  assert.deepEqual(G.checklist().map((c) => c.id), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10']);
  assert.equal(G.checklistSlice().length, 10);
});
